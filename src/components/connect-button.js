import { useState, useEffect, useCallback } from 'react'
import { useDisconnect, useProvider, useAccount } from 'wagmi'
import { mainnet, goerli, sepolia } from '@wagmi/core/chains'
import { Button, Profile } from '@ensdomains/thorin'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  normalize,
  parseName,
  universalResolveAvatar,
  universalResolvePrimaryName,
  getUniversalResolverPrimaryName,
  copyToClipBoard
} from '../lib/utils'
import { ensConfig } from '../lib/constants'
import { useChain } from '../hooks/misc'
import { ethers } from 'ethers'

export default function ConnectButtonWrapper({
  embedded
}) {
  const { disconnect } = useDisconnect()
  const provider = useProvider()
  const { address } = useAccount()
  const { chain } = useChain(provider)

  const [primaryName, setPrimaryName] = useState('')
  const [avatar, setAvatar] = useState('')

  const getAccountData = useCallback(async (address) => {
    let primaryName = ''
    let avatar = ''

    if (address) {
      try {
        if (chain === mainnet.id || chain === goerli.id) {
          primaryName = await provider.lookupAddress(address)
        } else {
          const universalResolver = new ethers.Contract(ensConfig[chain].UniversalResolver?.address, ensConfig[chain].UniversalResolver?.abi, provider)
          const pnResult = await universalResolvePrimaryName(universalResolver, address)
          primaryName = getUniversalResolverPrimaryName(address, pnResult)
        }

        if (primaryName) {
          const {
            normalizedName,
            bestDisplayName
          } = normalize(primaryName)

          primaryName = bestDisplayName

          const {
            node
          } = parseName(normalizedName)
          
          if (chain === mainnet.id || chain === goerli.id) {
            const resolver = await provider.getResolver(normalizedName)
            const avatarInfo = await resolver.getAvatar()
            if (avatarInfo) {
              avatar = avatarInfo.url
            }
          } else {
            const universalResolver = new ethers.Contract(ensConfig[chain].UniversalResolver?.address, ensConfig[chain].UniversalResolver?.abi, provider)
            const avatarResult = await universalResolveAvatar(universalResolver, normalizedName, node)
            if (avatarResult && !(avatarResult instanceof Error) && avatarResult.length > 0) {
              try {
                const avatarInfo = ethers.utils.defaultAbiCoder.decode(['string'], avatarResult[0])[0]
                if (avatarInfo) {
                  if (avatarInfo.indexOf('http://') === 0 || avatarInfo.indexOf('https://') === 0) {
                    avatar = avatarInfo
                  } else {
                    avatar = `https://metadata.ens.domains/${chain === goerli.id ? 'goerli' : chain === sepolia.id ? 'sepolia' : 'mainnet'}/avatar/${normalizedName}`
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    setPrimaryName(primaryName)
    setAvatar(avatar)
  }, [provider, setPrimaryName, setAvatar])

  useEffect(() => {
    getAccountData(address)
    return () => {
      setPrimaryName('')
      setAvatar('')
    }
  }, [address, chain, getAccountData, setPrimaryName, setAvatar])

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        return !account || !mounted || !chain ? (
          <div>
            <Button onClick={() => openConnectModal()}>Connect Wallet</Button>
          </div>
        ) : chain.unsupported ? (
          <ConnectButton />
        ) : (
          <Profile
            address={account.address}
            ensName={primaryName}
            avatar={avatar}
            size={embedded ? 'medium' : 'large'}
            dropdownItems={[
              {
                label: `Balance: ${account.displayBalance}`,
                disabled: true,
              },
              {
                label: 'Copy Address',
                onClick: async () => {
                  await copyToClipBoard(account.address)
                },
              },
              {
                label: 'Disconnect',
                color: 'red',
                onClick: () => disconnect(),
              },
            ]}
          />
        )
      }}
    </ConnectButton.Custom>
  )
}