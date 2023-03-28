import Head from 'next/head'
import { useState } from 'react'
import { Button, Heading, Input } from '@ensdomains/thorin'
import { useAccount, useNetwork, useProvider } from 'wagmi'
import { ethers } from 'ethers'
import Header from '../components/header'
import Unwrap from '../components/unwrap-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig } from '../lib/constants'
import { namehash } from '../lib/utils'
import { ens_normalize } from '@adraffy/ens-normalize'
import { keccak_256 } from 'js-sha3'
import bigInt from 'big-integer'

export default function Home() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nameToUnwrap, setNameToUnwrap] = useState('')
  const [parentNode, setParentNode] = useState('')
  const [labelhash, setLabelhash] = useState('')
  const [owner, setOwner] = useState('')

  const provider = useProvider()
  const { chain, chains } = useNetwork()
  const { address } = useAccount()

  return (
    <>
      <Head>
        <title>ENS Misc Tools</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Miscellaneous tasks that aren't yet in the ENS Manager App"/>
        <meta property="og:title" content="ENS Misc Tools"/>
        <meta property="og:description" content="Miscellaneous tasks that aren't yet in the ENS Manager App"/>
        <meta property="og:image" content="/sharing.png"/>
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
          Unwrap an ENS name
        </Heading>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault()

            if (!nameToUnwrap) {
              return toast.error('Please enter an ENS name')
            }

            // Normalize name
            let normalizedName
            try {
              normalizedName = ens_normalize(nameToUnwrap)
              setNameToUnwrap(normalizedName)
            } catch (e) {
              return toast.error(`${nameToUnwrap} is not a valid name`)
            }

            // Calculate parentNode, labelhash, id
            let validName = false
            let parentNode, labelhash, node, nameId
            try {
              const index = normalizedName.indexOf('.');
              if (index > 0) {
                const label = normalizedName.substring(0, index)
                const parentName = normalizedName.substring(index + 1)

                if (label && parentName) {
                  parentNode = namehash(parentName)
                  labelhash = '0x' + keccak_256(label)
                  node = namehash(normalizedName)
                  nameId = bigInt(node.substr(2), 16).toString()
                  validName = true
                }
              }
            } catch (e) {}
            if (!validName) {
              return toast.error(`${normalizedName} is not a valid name`)
            }

            // Check wallet connection
            if (!address) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!chains.some((c) => c.id === chain?.id)) {
              return toast.error('Switch to a supported network')
            }

            // Get registry owner
            const registry = new ethers.Contract(ensConfig[chain?.id].Registry?.address, ensConfig[chain?.id].Registry?.abi, provider)
            const registryOwner = await registry.owner(node)
            if (!registryOwner) {
              return toast.error('Unable to retrieve registry data')
            } else if (registryOwner === ethers.constants.AddressZero) {
              return toast.error('Name does not exist in ENS registry or has been deleted')
            }

            // Get wrapped data
            const nameWrapper = new ethers.Contract(ensConfig[chain?.id].NameWrapper?.address, ensConfig[chain?.id].NameWrapper?.abi, provider)
            const data = await nameWrapper.getData(nameId)
            if (!data) {
              return toast.error('Unable to retrieve wrapper data')
            } else if (!data.owner || data.owner === ethers.constants.AddressZero) {
              return toast.error('Name is unwrapped or expired')
            } else if (data.owner !== address) {
              return toast.error('You are not the owner of this wrapped name')
            } else if ((data.fuses & 1) === 1) {
              return toast.error('Permission to unwrap name has been revoked')
            }

            setParentNode(parentNode)
            setLabelhash(labelhash)
            setOwner(data.owner)
            setDialogOpen(true)
          }}
        >
          <div className="col">
            <Input
              placeholder="wrappedname.eth"
              maxLength="255"
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => setNameToUnwrap(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="action"
          >
            Unwrap
          </Button>
          <Unwrap
            name={nameToUnwrap}
            parentNode={parentNode}
            labelhash={labelhash}
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
