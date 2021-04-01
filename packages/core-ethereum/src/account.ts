import type { TransactionConfig } from 'web3-core'
import type HoprEthereum from '.'
import type { TransactionObject } from './tsc/web3/types'
import type { HoprToken } from './tsc/web3/HoprToken'
import Web3 from 'web3'
import { durations, u8aToHex, isExpired } from '@hoprnet/hopr-utils'
import NonceTracker from './nonce-tracker'
import TransactionManager from './transaction-manager'
import { Address, AcknowledgedTicket, Balance, Hash, NativeBalance, UINT256 } from './types'
import { isWinningTicket, pubKeyToAddress, isGanache, getNetworkGasPrice } from './utils'
import { WEB3_CACHE_TTL } from './constants'
import * as ethereum from './ethereum'
import BN from 'bn.js'

import debug from 'debug'
const log = debug('hopr-core-ethereum:account')

export const EMPTY_HASHED_SECRET = new Hash(new Uint8Array(Hash.SIZE).fill(0x00))
const cache = new Map<'balance' | 'nativeBalance', { value: string; updatedAt: number }>()

class Account {
  private _address?: Address
  private _onChainSecret?: Hash
  private _nonceTracker: NonceTracker
  private _transactions = new TransactionManager()
  private preimage: Hash

  /**
   * The accounts keys:
   */
  public keys: {
    onChain: {
      privKey: Uint8Array
      pubKey: Uint8Array
    }
    offChain: {
      privKey: Uint8Array
      pubKey: Uint8Array
    }
  }

  constructor(public coreConnector: HoprEthereum, privKey: Uint8Array, pubKey: Uint8Array, private chainId: number) {
    this.keys = {
      onChain: {
        privKey,
        pubKey
      },
      offChain: {
        privKey,
        pubKey
      }
    }

    this._nonceTracker = new NonceTracker({
      getLatestBlockNumber: async () => {
        // when running our unit/intergration tests using ganache,
        // the indexer doesn't have enough time to pick up the events and reduce the data
        return isGanache(coreConnector.network)
          ? coreConnector.web3.eth.getBlockNumber()
          : coreConnector.indexer.latestBlock
      },
      getTransactionCount: async (address: string, blockNumber?: number) =>
        coreConnector.web3.eth.getTransactionCount(address, blockNumber),
      getConfirmedTransactions: () => Array.from(this._transactions.confirmed.values()),
      getPendingTransactions: () => Array.from(this._transactions.pending.values()),
      minPending: durations.minutes(15)
    })
  }

  /**
   * @deprecated Nonces are automatically assigned when signing a transaction
   * @return next nonce
   */
  get nonce(): Promise<number> {
    return this._nonceTracker
      .getNonceLock(this._address.toHex())
      .then((res) => res.nonceDetails.params.highestSuggested)
  }

  /**
   * Retrieves HOPR balance, optionally uses the cache.
   * @returns HOPR balance
   */
  public async getBalance(useCache: boolean = false): Promise<Balance> {
    return getBalance(this.coreConnector.hoprToken, await this.address, useCache)
  }

  /**
   * Retrieves ETH balance, optionally uses the cache.
   * @returns ETH balance
   */
  public async getNativeBalance(useCache: boolean = false): Promise<NativeBalance> {
    return getNativeBalance(this.coreConnector.web3, await this.address, useCache)
  }

  async getTicketEpoch(): Promise<UINT256> {
    const state = await this.coreConnector.indexer.getAccount(await this.address)
    if (!state || !state.counter) return UINT256.fromString('0')
    return new UINT256(state.counter)
  }

  /**
   * Returns the current value of the onChainSecret
   */
  async getOnChainSecret(): Promise<Hash | undefined> {
    if (this._onChainSecret && !this._onChainSecret.eq(EMPTY_HASHED_SECRET)) return this._onChainSecret

    const state = await this.coreConnector.indexer.getAccount(await this.address)
    if (!state || !state.secret) return undefined

    this.updateLocalState(state.secret)
    return state.secret
  }

  /**
   * Reserve a preImage for the given ticket if it is a winning ticket.
   * @param ticket the acknowledged ticket
   * DANGER mutates ticket.
   */
  async reservePreImageIfIsWinning(ticket: AcknowledgedTicket) {
    // TODO replace this whole clusterf***
    if (!this.preimage) {
      this.preimage = await this.coreConnector.hashedSecret.findPreImage(await this.getOnChainSecret())
    }
    if (
      await isWinningTicket(
        await (await ticket.signedTicket).ticket.hash,
        ticket.response,
        this.preimage,
        (await ticket.signedTicket).ticket.winProb
      )
    ) {
      ticket.preImage = this.preimage
      this.preimage = await this.coreConnector.hashedSecret.findPreImage(this.preimage)
      return true
    } else {
      return false
    }
  }

  get address(): Promise<Address> {
    if (this._address) {
      return Promise.resolve(this._address)
    }

    return pubKeyToAddress(this.keys.onChain.pubKey).then((address: Address) => {
      this._address = address
      return this._address
    })
  }

  updateLocalState(onChainSecret: Hash) {
    this._onChainSecret = onChainSecret
  }

  // @TODO: switch to web3js-accounts
  public async signTransaction<T>(
    // config put in .send
    txConfig: Omit<TransactionConfig, 'nonce'>,
    // return of our contract method in web3.Contract instance
    txObject?: TransactionObject<T>
  ) {
    const { web3, network } = this.coreConnector

    const abi = txObject ? txObject.encodeABI() : undefined
    const gas = 300e3

    // if it returns undefined, let web3 pick gas price
    const gasPrice = getNetworkGasPrice(network)

    // @TODO: potential deadlock, needs to be improved
    const nonceLock = await this._nonceTracker.getNonceLock(this._address.toHex())

    // @TODO: provide some of the values to avoid multiple calls
    const options = {
      gas,
      gasPrice,
      ...txConfig,
      chainId: this.chainId,
      nonce: nonceLock.nextNonce,
      data: abi
    }

    const signedTransaction = await web3.eth.accounts.signTransaction(options, u8aToHex(this.keys.onChain.privKey))

    const send = () => {
      if (signedTransaction.rawTransaction == null) {
        throw Error('Cannot process transaction because Web3.js did not give us the raw transaction.')
      }

      log('Sending transaction %o', {
        gas: options.gas,
        gasPrice:
          typeof options.gasPrice === 'string' && options.gasPrice.startsWith('0x')
            ? Web3.utils.hexToNumber(options.gasPrice)
            : options.gasPrice,
        nonce: options.nonce,
        hash: signedTransaction.transactionHash
      })

      const event = web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
      this._transactions.addToPending(signedTransaction.transactionHash, { nonce: options.nonce })
      nonceLock.releaseLock()

      // @TODO: cleanup old txs
      event.once('receipt', () => {
        this._transactions.moveToConfirmed(signedTransaction.transactionHash)
      })
      event.once('error', (error) => {
        const receipt = error['receipt']

        // same tx was submitted twice
        if (error.message.includes('already known')) return

        log(
          'Transaction failed %s %i with error %s',
          signedTransaction.transactionHash,
          options.nonce,
          error.message,
          receipt ? receipt : 'no receipt'
        )

        // mean tx was confirmed & reverted
        if (receipt) {
          this._transactions.moveToConfirmed(signedTransaction.transactionHash)
        } else {
          this._transactions.remove(signedTransaction.transactionHash)
        }
      })

      return event
    }

    return {
      send,
      transactionHash: signedTransaction.transactionHash
    }
  }
}

/**
 * Retrieves HOPR balance, optionally uses the cache.
 * TODO: use indexer to track HOPR balance
 * @returns HOPR balance
 */
export const getBalance = async (
  hoprToken: HoprToken,
  account: Address,
  useCache: boolean = false
): Promise<Balance> => {
  if (useCache) {
    const cached = cache.get('balance')
    const notExpired = cached && !isExpired(cached.updatedAt, new Date().getTime(), WEB3_CACHE_TTL)
    if (notExpired) return new Balance(new BN(cached.value))
  }

  const value = await ethereum.getBalance(hoprToken, account)
  cache.set('balance', { value: value.toBN().toString(), updatedAt: new Date().getTime() })

  return value
}

/**
 * Retrieves ETH balance, optionally uses the cache.
 * @returns ETH balance
 */
export const getNativeBalance = async (
  web3: Web3,
  account: Address,
  useCache: boolean = false
): Promise<NativeBalance> => {
  if (useCache) {
    const cached = cache.get('nativeBalance')
    const notExpired = cached && !isExpired(cached.updatedAt, new Date().getTime(), WEB3_CACHE_TTL)
    if (notExpired) return new NativeBalance(new BN(cached.value))
  }

  const value = await ethereum.getNativeBalance(web3, account)
  cache.set('nativeBalance', { value: value.toBN().toString(), updatedAt: new Date().getTime() })

  return value
}

export default Account
