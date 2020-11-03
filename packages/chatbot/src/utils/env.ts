import dotenv from 'dotenv'
import dotenvParse from 'dotenv-parse-variables'

//@TODO: Integrate Firebase keys/values to our env

let parsed: {
  BOT_NAME: string
  BOT_TIMESTAMP: number
  HOPR_ENVIRONMENT: 'basodino' | 'saentis'
  TWITTER_API_KEY: string
  TWITTER_API_SECRET: string
  TWITTER_API_ACCESS_TOKEN: string
  TWITTER_API_ACCESS_TOKEN_SECRET: string
  TWITTER_TIMESTAMP: number
  TWITTER_BLACKLISTED: string
  LINKDROP_PRIVATE_KEY: string
  LINKDROP_ACCOUNT_ADDRESS: string
  LINKDROP_CHAIN: string
  LINKDROP_CAMPAIGN_ID: number
  LINKDROP_CAMPAIGN_AMOUNT_PER_LINK_IN_WEI: string
  INFURA_PROJECT_ID: string
  COVERBOT_XDAI_THRESHOLD: number
  COVERBOT_VERIFICATION_CYCLE_IN_MS: number
  COVERBOT_DEBUG_MODE: boolean
  COVERBOT_ADMIN_MODE: boolean
  COVERBOT_CHAIN_PROVIDER: string
  COVERBOT_DEBUG_HOPR_ADDRESS: string
  COVERBOT_VERIFICATION_CYCLE_EXECUTE: boolean
  FIREBASE_DATABASE_URL: string
  FIREBASE_DATABASE_EMULATOR_HOST: string
} = {
  BOT_NAME: 'randobot',
  BOT_TIMESTAMP: undefined,
  HOPR_ENVIRONMENT: 'saentis',
  TWITTER_API_KEY: '',
  TWITTER_API_SECRET: '',
  TWITTER_API_ACCESS_TOKEN: '',
  TWITTER_API_ACCESS_TOKEN_SECRET: '',
  TWITTER_TIMESTAMP: undefined,
  TWITTER_BLACKLISTED: '',
  LINKDROP_PRIVATE_KEY: '',
  LINKDROP_ACCOUNT_ADDRESS: '',
  LINKDROP_CHAIN: 'mainnet',
  LINKDROP_CAMPAIGN_ID: 1,
  LINKDROP_CAMPAIGN_AMOUNT_PER_LINK_IN_WEI: '1000000000000000000',
  INFURA_PROJECT_ID: '',
  COVERBOT_XDAI_THRESHOLD: 0.001,
  COVERBOT_VERIFICATION_CYCLE_IN_MS: 30000,
  COVERBOT_DEBUG_MODE: true,
  COVERBOT_ADMIN_MODE: false,
  COVERBOT_CHAIN_PROVIDER: 'https://dai.poa.network',
  COVERBOT_VERIFICATION_CYCLE_EXECUTE: true,
  COVERBOT_DEBUG_HOPR_ADDRESS: '',
  FIREBASE_DATABASE_URL: '',
  FIREBASE_DATABASE_EMULATOR_HOST: '',
}

try {
  const result = dotenv.config()
  if (!result.error) {
    for (const k in result.parsed) {
      process.env[k] = result.parsed[k]
    }
  }
} catch {}

parsed = {
  ...parsed,
  ...(dotenvParse(process.env) as typeof parsed),
}

export const BOT_NAME = parsed.BOT_NAME
export const BOT_TIMESTAMP = parsed.BOT_TIMESTAMP
export const HOPR_ENVIRONMENT = parsed.HOPR_ENVIRONMENT
export const TWITTER_API_KEY = parsed.TWITTER_API_KEY
export const TWITTER_API_SECRET = parsed.TWITTER_API_SECRET
export const TWITTER_API_ACCESS_TOKEN = parsed.TWITTER_API_ACCESS_TOKEN
export const TWITTER_API_ACCESS_TOKEN_SECRET = parsed.TWITTER_API_ACCESS_TOKEN_SECRET
export const TWITTER_TIMESTAMP = parsed.TWITTER_TIMESTAMP
export const TWITTER_BLACKLISTED = parsed.TWITTER_BLACKLISTED
export const INFURA_PROJECT_ID = parsed.INFURA_PROJECT_ID
export const LINKDROP_PRIVATE_KEY = parsed.LINKDROP_PRIVATE_KEY
export const LINKDROP_ACCOUNT_ADDRESS = parsed.LINKDROP_ACCOUNT_ADDRESS
export const LINKDROP_CHAIN = parsed.LINKDROP_CHAIN
export const LINKDROP_CAMPAIGN_ID = parsed.LINKDROP_CAMPAIGN_ID
export const LINKDROP_CAMPAIGN_AMOUNT_PER_LINK_IN_WEI = parsed.LINKDROP_CAMPAIGN_AMOUNT_PER_LINK_IN_WEI
export const COVERBOT_XDAI_THRESHOLD = parsed.COVERBOT_XDAI_THRESHOLD
export const COVERBOT_VERIFICATION_CYCLE_IN_MS = parsed.COVERBOT_VERIFICATION_CYCLE_IN_MS
export const COVERBOT_DEBUG_MODE = JSON.parse(`${parsed.COVERBOT_DEBUG_MODE}`)
export const COVERBOT_CHAIN_PROVIDER = parsed.COVERBOT_CHAIN_PROVIDER
export const COVERBOT_DEBUG_HOPR_ADDRESS = parsed.COVERBOT_DEBUG_HOPR_ADDRESS
export const COVERBOT_VERIFICATION_CYCLE_EXECUTE = JSON.parse(`${parsed.COVERBOT_VERIFICATION_CYCLE_EXECUTE}`)
export const COVERBOT_ADMIN_MODE = JSON.parse(`${parsed.COVERBOT_ADMIN_MODE}`)
export const FIREBASE_DATABASE_URL = parsed.FIREBASE_DATABASE_URL
export const FIREBASE_DATABASE_EMULATOR_HOST = parsed.FIREBASE_DATABASE_EMULATOR_HOST
