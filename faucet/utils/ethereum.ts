import type { addresses } from '@hoprnet/hopr-ethereum'

export const colors: {
  [key in addresses.Networks]?: string
} = {
  kovan: 'purple',
  private: 'grey',
}
