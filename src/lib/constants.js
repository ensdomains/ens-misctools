import { mainnet, goerli } from '@wagmi/core/chains'

const registryABI = require('./ens-registry-abi.json')
const ethRegistrarABI = require('./ens-eth-registrar-abi.json')
const nameWrapperABI = require('./ens-namewrapper-abi.json')
const latestPublicResolverABI = require('./ens-latest-public-resolver.json')

export const ensConfig = {
  [mainnet.id]: {
    Registry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      abi: registryABI,
    },
    ETHRegistrar: {
      address: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
      abi: ethRegistrarABI,
    },
    NameWrapper: {
      address: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
      abi: nameWrapperABI,
    },
    publicResolvers: [
      '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63',
      '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41',
      '0xDaaF96c344f63131acadD0Ea35170E7892d3dfBA'
    ],
    LatestPublicResolver: {
      address: '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63',
      abi: latestPublicResolverABI,
    },
  },
  [goerli.id]: {
    Registry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      abi: registryABI,
    },
    ETHRegistrar: {
      address: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
      abi: ethRegistrarABI,
    },
    NameWrapper: {
      address: '0x114D4603199df73e7D157787f8778E21fCd13066',
      abi: nameWrapperABI,
    },
    publicResolvers: [
      '0xd7a4F6473f32aC2Af804B3686AE8F1932bC35750',
      '0x342cf18D3e41DE491aa1a3067574C849AdA6a2Ad',
      '0x19c2d5D0f035563344dBB7bE5fD09c8dad62b001',
      '0x2800Ec5BAB9CE9226d19E0ad5BC607e3cfC4347E',
      '0xE264d5bb84bA3b8061ADC38D3D76e6674aB91852'
    ],
    LatestPublicResolver: {
      address: '0xd7a4F6473f32aC2Af804B3686AE8F1932bC35750',
      abi: latestPublicResolverABI,
    },
  },
}