import { mainnet, goerli } from '@wagmi/core/chains'

const registryABI = require('./ens-registry-abi.json')
const nameWrapperABI = require('./ens-namewrapper-abi.json')

export const ensConfig = {
  [mainnet.id]: {
    Registry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      abi: registryABI,
    },
    NameWrapper: {
      address: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
      abi: nameWrapperABI,
    },
  },
  [goerli.id]: {
    Registry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      abi: registryABI,
    },
    NameWrapper: {
      address: '0x114D4603199df73e7D157787f8778E21fCd13066',
      abi: nameWrapperABI,
    },
  },
}