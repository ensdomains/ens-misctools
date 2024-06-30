import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
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
import { useDisconnectToMainnet, useChain } from '../hooks/misc'
import { getContract, decodeAbiParameters } from 'viem'

export default function ConnectButtonWrapper({
  embedded
}) {
  const { disconnect } = useDisconnectToMainnet()
  const client = usePublicClient()
  const { address } = useAccount()
  const { chain } = useChain(client)

  const [primaryName, setPrimaryName] = useState('')
  const [avatar, setAvatar] = useState('')

  const getAccountData = useCallback(async (address) => {
    let primaryName = ''
    let avatar = ''

    if (address) {
      try {
        const universalResolver = getContract({address: ensConfig[chain].UniversalResolver?.address, abi: ensConfig[chain].UniversalResolver?.abi, client})
        const pnResult = await universalResolvePrimaryName(client, universalResolver, address)
        primaryName = getUniversalResolverPrimaryName(address, pnResult)

        if (primaryName) {
          const {
            normalizedName,
            bestDisplayName
          } = normalize(primaryName)

          primaryName = bestDisplayName

          const {
            node
          } = parseName(normalizedName)
          
          const universalResolver = getContract({address: ensConfig[chain].UniversalResolver?.address, abi: ensConfig[chain].UniversalResolver?.abi, client})
          const avatarResult = await universalResolveAvatar(client, universalResolver, normalizedName, node)
          if (avatarResult && !(avatarResult instanceof Error) && avatarResult.length > 0) {
            try {
              const avatarInfo = decodeAbiParameters([{name: 'value', type: 'string'}], avatarResult[0])[0]
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
      } catch (e) {
        console.error(e)
      }
    }

    setPrimaryName(primaryName)
    setAvatar(avatar)
  }, [chain, client, setPrimaryName, setAvatar])

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