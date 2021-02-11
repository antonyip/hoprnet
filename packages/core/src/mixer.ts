import { Packet } from './messages/packet'
import type HoprCoreConnector from '@hoprnet/hopr-core-connector-interface'
import Heap from 'heap-js'
import { randomInteger } from '@hoprnet/hopr-utils'
import { MAX_PACKET_DELAY } from './constants'
import Defer from 'p-defer'
import type { DeferredPromise } from 'p-defer'

import Debug from 'debug'
const log = Debug('hopr-core:mixer')

type HeapElement = [number, Packet<any>]

const comparator = (a: HeapElement, b: HeapElement): number => {
  if (b[0] < a[0]) {
    return 1
  } else if (b[0] > a[0]) {
    return -1
  }
  return 0
}

/**
 * Mix packets.
 *
 * Samples an artificial delay and returns packets not before
 * the end of the delay.
 *
 * @dev Does not drop packets intentionally. This slightly reduces privacy
 * but increases usability.
 */
export class Mixer<Chain extends HoprCoreConnector> {
  private queue: Heap<HeapElement>
  private timeout?: NodeJS.Timeout
  private poppable: DeferredPromise<void>
  private ended: DeferredPromise<void>
  private endPromise: Promise<void>
  private done: boolean

  public WAIT_TIME = MAX_PACKET_DELAY

  constructor(private incrementer = Date.now) {
    this.queue = new Heap(comparator)

    this.poppable = Defer<void>()
    this.ended = Defer<void>()

    this.endPromise = this.ended.promise.then(() => {
      this.done = true
    })
  }

  /**
   * Adds a packet to the mixer
   * @param p
   */
  public push(p: Packet<Chain>) {
    if (this.done) {
      throw Error(`Mixer has ended. Could not accept any further messages.`)
    }
    const newPriority = this.getPriority()

    if (this.queue.isEmpty() || newPriority < this.queue.peek()[0]) {
      this.resetTimeout(newPriority)
    }

    log(`Added 1 packet to the mixer`)
    this.queue.push([newPriority, p])
  }

  /**
   * Adjust the internal timeout with latest priority
   * @param newPriority
   */
  private resetTimeout(newPriority: number) {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.poppable.resolve()
    }, Math.max(0, newPriority - Date.now()))
  }

  notEmpty(): boolean {
    return !this.queue.isEmpty()
  }

  /**
   * Stops the mixer.
   */
  public stop(): void {
    log(`Ending mixer. Mixer will not accept any further messages`)

    if (this.done) {
      return
    }

    this.ended.resolve()
  }

  private getPriority(): number {
    // @TODO implement fancy distribution sampling
    return this.incrementer() + randomInteger(1, MAX_PACKET_DELAY)
  }

  /**
   * Waits for the next packet to get ready and removes it from the queue.
   * @dev does not drop any packet intentionally
   * @returns the packet or 'undefined' if the mixer has ended meanwhile
   */
  async pop(): Promise<undefined | Packet<Chain>> {
    await Promise.race([
      // prettier-ignore
      this.endPromise,
      this.poppable.promise
    ])

    // return once done
    if (this.done) {
      return undefined
    }

    const result = this.queue.pop()[1]

    // reset promise to wait for next message
    this.poppable = Defer<void>()

    log(`Removed 1 packet from mixer. ${this.queue.length} packet${this.queue.length == 1 ? ' is' : 's are'} waiting.`)

    // reset timeout only if there is another
    // message, otherwise wait for the next .push()
    if (this.notEmpty()) {
      this.resetTimeout(this.queue.peek()[0])
    }

    return result
  }
}
