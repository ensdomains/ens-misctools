import styles from '../../styles/Unwrap.module.css'
import { useState } from 'react'
import { Button, Heading, Input } from '@ensdomains/thorin'
import { useAccount, usePublicClient } from 'wagmi'
import { getContract } from 'viem'
import Header from '../../components/header'
import UnwrapModal from '../../components/unwrap-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig, AddressZero } from '../../lib/constants'
import { validChain, normalize, parseName, readContract } from '../../lib/utils'
import { useChain, useDelayedName, useRouterPush, useRouterUpdate } from '../../hooks/misc'
import Metadata from '../../components/metadata'

export default function Unwrap() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')

  const delayedName = useDelayedName(name, '/unwrap/')
  const onNameChange = useRouterPush('/unwrap/', setName)
  useRouterUpdate('/unwrap/', name, onNameChange)

  const client = usePublicClient()
  const { address } = useAccount()
  const { chain, chains } = useChain(client)

  return (
    <>
      <Metadata title="ENS Tools - Unwrap Name" description="Unwrap an ENS name from the Name Wrapper" image="https://tools.ens.domains/sharing-unwrap.jpg"/>
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
            const registry = getContract({address: ensConfig[chain].Registry?.address, abi: ensConfig[chain].Registry?.abi, client})
            const registryOwner = await readContract(client, registry, 'owner', node)
            if (!registryOwner) {
              return toast.error('Unable to retrieve registry data')
            } else if (registryOwner === AddressZero) {
              return toast.error('Name does not exist in ENS registry or has been deleted')
            }

            // Get wrapped data
            const nameWrapperAddress = ensConfig[chain].NameWrapper?.address
            const nameWrapper = getContract({address: nameWrapperAddress, abi: ensConfig[chain].NameWrapper?.abi, client})
            const data = await readContract(client, nameWrapper, 'getData', wrappedTokenId)
            if (!data) {
              return toast.error('Unable to retrieve wrapper data')
            } else if (!data[0] || data[0] === AddressZero) {
              if (registryOwner === nameWrapperAddress) {
                return toast.error('Name has expired')
              } else {
                return toast.error('Name is not currently wrapped')
              }
            } else if (data[0] !== address) {
              return toast.error('You are not the owner of this wrapped name')
            } else if ((BigInt(data[1]) & 1n) === 1n) {
              return toast.error('Permission to unwrap name has been revoked')
            }

            setOwner(data[0])
            setDialogOpen(true)
          }}
        >
          <div className={styles.col}>
            <Input
              name="tname"
              placeholder="wrappedname.eth"
              maxLength="255"
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => onNameChange(e.target.value)}
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
