import { useState, useEffect, useCallback } from 'react'
import { useDisconnect, useProvider, useAccount } from 'wagmi'
import { Button, Profile } from '@ensdomains/thorin'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { copyToClipBoard, normalize } from '../lib/utils'
import { useChain } from '../hooks/misc'

export default function ConnectButtonWrapper() {
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
        primaryName = await provider.lookupAddress(address)

        if (primaryName) {
          const {
            normalizedName,
            bestDisplayName
          } = normalize(primaryName)

          primaryName = bestDisplayName

          const resolver = await provider.getResolver(normalizedName)
          const avatarInfo = await resolver.getAvatar()
          if (avatarInfo) {
            avatar = avatarInfo.url
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
  }, [address, chain, getAccountData])

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
            size="large"
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