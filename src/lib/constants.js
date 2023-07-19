import { mainnet, goerli, sepolia } from '@wagmi/core/chains'

const registryABI = require('./ens-registry-abi.json')
const ethRegistrarABI = require('./ens-eth-registrar-abi.json')
const nameWrapperABI = require('./ens-namewrapper-abi.json')
const reverseRegistrarABI = require('./ens-reverse-registrar-abi.json')
const latestPublicResolverABI = require('./ens-latest-public-resolver.json')
const universalResolverABI = require('./ens-universal-resolver.json')

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
    ReverseRegistrar: {
      address: '0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb',
      abi: reverseRegistrarABI,
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
    UniversalResolver: {
      address: '0x9380F1974D2B7064eA0c0EC251968D8c69f0Ae31',
      abi: universalResolverABI
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
    ReverseRegistrar: {
      address: '0x4f7A657451358a22dc397d5eE7981FfC526cd856',
      abi: reverseRegistrarABI,
    },
    publicResolvers: [
      '0xd7a4F6473f32aC2Af804B3686AE8F1932bC35750',
      '0x342cf18D3e41DE491aa1a3067574C849AdA6a2Ad',
      '0x19c2d5D0f035563344dBB7bE5fD09c8dad62b001',
      '0x2800Ec5BAB9CE9226d19E0ad5BC607e3cfC4347E',
      '0xE264d5bb84bA3b8061ADC38D3D76e6674aB91852',
      '0x4B1488B7a6B320d2D721406204aBc3eeAa9AD329'
    ],
    LatestPublicResolver: {
      address: '0xd7a4F6473f32aC2Af804B3686AE8F1932bC35750',
      abi: latestPublicResolverABI,
    },
    UniversalResolver: {
      address: '0x3952Be0b2186f8B113193a84b69bD71ad3fc1ae3',
      abi: universalResolverABI
    },
  },
  [sepolia.id]: {
    Registry: {
      address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      abi: registryABI,
    },
    ETHRegistrar: {
      address: '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85',
      abi: ethRegistrarABI,
    },
    NameWrapper: {
      address: '0x0635513f179D50A207757E05759CbD106d7dFcE8',
      abi: nameWrapperABI,
    },
    ReverseRegistrar: {
      address: '0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6',
      abi: reverseRegistrarABI,
    },
    publicResolvers: [
      '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD'
    ],
    LatestPublicResolver: {
      address: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD',
      abi: latestPublicResolverABI,
    },
    UniversalResolver: {
      address: '0x21B000Fd62a880b2125A61e36a284BB757b76025',
      abi: universalResolverABI
    },
  },
}