import styles from '../styles/SetPrimary.module.css'
import Head from 'next/head'
import { useState } from 'react'
import { Button, Heading, Input, RadioButton, RadioButtonGroup } from '@ensdomains/thorin'
import { useAccount, useProvider } from 'wagmi'
import { ethers } from 'ethers'
import Header from '../components/header'
import UnwrapModal from '../components/unwrap-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig } from '../lib/constants'
import { validChain, normalize, parseName } from '../lib/utils'
import { useChain } from '../hooks/misc'

export default function SetPrimary() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [isClaimMode, setClaimMode] = useState(false)
  const [isForAddrMode, setForAddrMode] = useState(false)

  const provider = useProvider()
  const { address } = useAccount()
  const { chain, chains } = useChain(provider)

  return (
    <>
      <Head>
        <title>ENS Misc Tools - Set Primary Name</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Set ENS Primary Name or claim the reverse record"/>
        <meta property="og:title" content="ENS Misc Tools - Set Primary Name"/>
        <meta property="og:description" content="Set ENS Primary Name or claim the reverse record"/>
        <meta property="og:image" content="https://ens-misctools.vercel.app/sharing-setprimary.jpg"/>
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:creator" content="@serenae_fansubs"/>
      </Head>
      <Header position="absolute" />
      <div className="container container--flex">
        <Heading
          as="h1"
          level="1"
          align="center"
          style={{ marginBottom: '2rem', lineHeight: '1' }}
        >
          Set ENS Primary Name
        </Heading>
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault()

            if (!name) {
              return toast.error('Please enter an ENS name')
            }

            // Normalize name
            const {
              isNameValid,
              normalizedName
            } = normalize(name)

            if (isNameValid) {
              setName(normalizedName)
            } else {
              return toast.error(`${name} is not a valid name`)
            }

            // Calculate parentNode, labelhash, id
            const {
              node,
              level,
              wrappedTokenId
            } = parseName(normalizedName)

            if (level <= 1) {
              return toast.error(`${normalizedName} is not a valid name`)
            }

            // Check wallet connection
            if (!address) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!validChain(chain, chains)) {
              return toast.error('Switch to a supported network')
            }

            // Get registry owner
            const registry = new ethers.Contract(ensConfig[chain].Registry?.address, ensConfig[chain].Registry?.abi, provider)
            const registryOwner = await registry.owner(node)
            if (!registryOwner) {
              return toast.error('Unable to retrieve registry data')
            } else if (registryOwner === ethers.constants.AddressZero) {
              return toast.error('Name does not exist in ENS registry or has been deleted')
            }

            // Get wrapped data
            const nameWrapperAddress = ensConfig[chain].NameWrapper?.address
            const nameWrapper = new ethers.Contract(nameWrapperAddress, ensConfig[chain].NameWrapper?.abi, provider)
            const data = await nameWrapper.getData(wrappedTokenId)
            if (!data) {
              return toast.error('Unable to retrieve wrapper data')
            } else if (!data.owner || data.owner === ethers.constants.AddressZero) {
              if (registryOwner === nameWrapperAddress) {
                return toast.error('Name has expired')
              } else {
                return toast.error('Name is not currently wrapped')
              }
            } else if (data.owner !== address) {
              return toast.error('You are not the owner of this wrapped name')
            } else if ((data.fuses & 1) === 1) {
              return toast.error('Permission to unwrap name has been revoked')
            }

            setOwner(data.owner)
            setDialogOpen(true)
          }}
        >
          <RadioButtonGroup value={isClaimMode ? 'true' : 'false'} onChange={(e) => setClaimMode(e.target.value === 'true')}>
            <RadioButton label="Set Primary Name" name="claimmode" value="false"/>
            <RadioButton label="Only Claim Reverse Record" name="claimmode" value="true"/>
          </RadioButtonGroup>
          <RadioButtonGroup value={isForAddrMode ? 'true' : 'false'} onChange={(e) => setForAddrMode(e.target.value === 'true')}>
            <RadioButton label="For Your Address" name="foraddrmode" value="false"/>
            <RadioButton label="For Contract Address" name="foraddrmode" value="true"/>
          </RadioButtonGroup>
          <div className={styles.col}>
            <Input
              name="tname"
              label="ENS Name"
              placeholder="wrappedname.eth"
              maxLength="255"
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="action"
          >
            Unwrap
          </Button>
          <UnwrapModal
            name={name}
            owner={owner}
            open={dialogOpen}
            setIsOpen={setDialogOpen}
          />
        </form>
      </div>

      <Toaster position="bottom-center" />
    </>
  )
}
