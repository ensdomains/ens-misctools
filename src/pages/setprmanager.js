import styles from '../styles/SetPublicResolverManager.module.css'
import Head from 'next/head'
import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Heading,
  Input,
  RadioButton,
  Tooltip,
  Typography
} from '@ensdomains/thorin'
import { useAccount, usePublicClient } from 'wagmi'
import { getContract } from 'viem'
import Header from '../components/header'
import SetPublicResolverManagerModal from '../components/setprmanager-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig, AddressZero } from '../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  getAddress,
  isValidAddress,
  readContract,
  getMulticallResult
} from '../lib/utils'
import { useChain, useDelayedName } from '../hooks/misc'

export default function SetPublicResolverManager() {
  const defaultManagerInfo = function() {
    return {
      managerAddress : '',
      errorResolvingManagerAddress: false,
      isApprovedForAll: false,
      registryOwner: '',
      resolver: '',
      wrappedOwner: '',
      isApprovedFor: false,
      successfullyRetrievedApprovalInfo: false
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [managerAddressOrName, setManagerAddressOrName] = useState('')
  const [managerInfo, setManagerInfo] = useState(defaultManagerInfo())
  const [isForAllMode, setForAllMode] = useState(false)

  const delayedName = useDelayedName(name)
  const delayedManagerAddressOrName = useDelayedName(managerAddressOrName)

  const client = usePublicClient()
  const { address } = useAccount()
  const { chain, chains } = useChain(client)

  const getManagerInfo = useCallback(async (name, managerAddressOrName) => {
    const managerInfo = defaultManagerInfo()

    if (isValidAddress(managerAddressOrName)) {
      managerInfo.managerAddress = managerAddressOrName
    } else {
      try {
        managerInfo.errorResolvingManagerAddress = true

        const {
          isNameValid: isManagerNameValid,
          normalizedName: normalizedManagerName
        } = normalize(managerAddressOrName)

        if (isManagerNameValid) {
          const resolvedAddr = await client.getEnsAddress({name: normalizedManagerName})
          if (isValidAddress(resolvedAddr)) {
            managerInfo.managerAddress = resolvedAddr
            managerInfo.errorResolvingManagerAddress = false
          }
        }
      } catch(e) {}
    }

    if (managerInfo.managerAddress) {
      try {
        const {
          isNameValid,
          normalizedName
        } = normalize(name)

        const {
          node,
          wrappedTokenId
        } = parseName(normalizedName)

        const batch1 = []

        const publicResolver = getContract({address: ensConfig[chain].LatestPublicResolver?.address, abi: ensConfig[chain].LatestPublicResolver?.abi, client})

        // Check if manager is already approved for all
        batch1.push(readContract(client, publicResolver, 'isApprovedForAll', address, managerInfo.managerAddress))
        
        if (!isForAllMode && isNameValid) {
          // Get registry owner/resolver for name
          const registry = getContract({address: ensConfig[chain].Registry?.address, abi: ensConfig[chain].Registry?.abi, client})
          batch1.push(readContract(client, registry, 'owner', node))
          batch1.push(readContract(client, registry, 'resolver', node))

          // Get Name Wrapper owner for name
          const nameWrapper = getContract({address: ensConfig[chain].NameWrapper?.address, abi: ensConfig[chain].NameWrapper?.abi, client})
          batch1.push(readContract(client, nameWrapper, 'ownerOf', wrappedTokenId))

          // Check if manager is already approved
          batch1.push(readContract(client, publicResolver, 'isApprovedFor', address, node, managerInfo.managerAddress))
        }

        const results1 = await Promise.all(batch1)
        let results1Index = 0

        managerInfo.isApprovedForAll = getMulticallResult(results1[results1Index], true)
        results1Index++

        if (!isForAllMode && isNameValid) {
          managerInfo.registryOwner = getMulticallResult(results1[results1Index], true)
          results1Index++

          managerInfo.resolver = getMulticallResult(results1[results1Index], true)
          results1Index++

          managerInfo.wrappedOwner = getMulticallResult(results1[results1Index], true)
          results1Index++

          managerInfo.isApprovedFor = getMulticallResult(results1[results1Index], true)
          results1Index++
        }

        managerInfo.successfullyRetrievedApprovalInfo = true
      } catch (e) {
        console.error(e)
      }
    }

    setManagerInfo(managerInfo)
  }, [client, address, chain, isForAllMode, setManagerInfo])

  useEffect(() => {
    getManagerInfo(delayedName, delayedManagerAddressOrName)
    return () => {
      setManagerInfo(defaultManagerInfo())
    }
  }, [delayedName, delayedManagerAddressOrName, getManagerInfo, setManagerInfo])

  let showApprove = true
  let buttonEnabled = false
  if (managerInfo && managerInfo.successfullyRetrievedApprovalInfo) {
    if (isForAllMode) {
      showApprove = !managerInfo.isApprovedForAll
      buttonEnabled = true
    } else {
      showApprove = !managerInfo.isApprovedFor
      buttonEnabled = normalize(delayedName).isNameValid
    }
  }

  return (
    <>
      <Head>
        <title>ENS Tools - Set Public Resolver Manager</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Set a separate manager for your wrapped ENS name"/>
        <meta property="og:title" content="ENS Tools - Set Public Resolver Manager"/>
        <meta property="og:description" content="Set a separate manager for your wrapped ENS name"/>
        <meta property="og:image" content="https://tools.ens.domains/sharing-setprmanager.jpg"/>
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
          Set Public Resolver Manager
        </Heading>
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault()
            
            if (!isForAllMode) {
              if (!name) {
                return toast.error('Please enter an ENS name')
              }

              if (!normalize(name).isNameValid) {
                return toast.error(`${name} is not a valid name`)
              }
            }

            if (!managerAddressOrName) {
              return toast.error('Please enter a manager address or ENS name')
            }

            if (managerInfo && managerInfo.errorResolvingManagerAddress) {
              return toast.error('Manager address is invalid or does not resolve to an ETH address')
            }

            if (!managerInfo || !managerInfo.managerAddress) {
              return
            }

            // Check wallet connection
            if (!isValidAddress(address)) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!validChain(chain, chains)) {
              return toast.error('Switch to a supported network')
            }

            if (managerInfo.successfullyRetrievedApprovalInfo) {
              if (!isForAllMode) {
                if (!managerInfo.registryOwner || managerInfo.registryOwner === AddressZero) {
                  return toast.error('Name does not exist on-chain')
                }
                
                const nameWrapperAddress = getAddress(ensConfig[chain].NameWrapper?.address)

                if (getAddress(managerInfo.registryOwner) === nameWrapperAddress) {
                  if (getAddress(address) !== getAddress(managerInfo.wrappedOwner)) {
                    return toast.error('You are not the owner of this name')
                  }
                } else if (getAddress(address) !== getAddress(managerInfo.registryOwner)) {
                  return toast.error('You are not the manager of this name in the ENS registry')
                }

                if (getAddress(managerInfo.resolver) !== getAddress(ensConfig[chain].LatestPublicResolver?.address)) {
                  return toast.error('Name is not using the latest Public Resolver')
                }
              }

              setDialogOpen(true)
            }
          }}
        >
          <div className={styles.radiorow}>
            <Tooltip width={400} content={
                <Typography>
                  Approve a manager for a specific name that you own.
                  <br/><br/>
                  This manager will be able to edit records only for this ENS name, but will <strong>not</strong> be able to transfer the name itself.
                  <br/><br/>
                  You can have multiple approved managers at the same time.
                </Typography>
              }>
              <RadioButton label="For Single Name" name="forallmode" value="false" checked={!isForAllMode} onChange={() => {
                setForAllMode(false)
                setName('')
              }}/>
            </Tooltip>
            <Tooltip width={400} content={
                <Typography>
                  Approve a manager for all names that you own.
                  <br/><br/>
                  This manager will be able to edit records for all ENS names, but will <strong>not</strong> be able to transfer any names.
                  <br/><br/>
                  You can have multiple approved managers at the same time.
                </Typography>
              }>
              <RadioButton label="For All Names" name="forallmode" value="true" checked={isForAllMode} onChange={() => {
                setForAllMode(true)
                setName('')
              }}/>
            </Tooltip>
          </div>
          {!isForAllMode &&
            <div className={styles.col}>
              <Input
                name="tname"
                label="ENS Name"
                placeholder="myname.eth"
                maxLength="255"
                spellCheck="false"
                autoCapitalize="none"
                parentStyles={{ backgroundColor: '#fff' }}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          }
          <div className={styles.col}>
            <Input
              name="tmanager"
              label="Manager Address or ENS Name"
              placeholder="0x..."
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => setManagerAddressOrName(e.target.value)}
            />
          </div>
          {delayedManagerAddressOrName && managerInfo ? (
            managerInfo.errorResolvingManagerAddress ? (
              <Typography className={styles.managertext} color="red">Does not resolve to an ETH address</Typography>
            ) : managerInfo.managerAddress && getAddress(delayedManagerAddressOrName) !== getAddress(managerInfo.managerAddress) ? (
              <Typography className={styles.managertext}>{managerInfo.managerAddress}</Typography>
            ) : <div className={styles.managertext}/>
          ) : <div className={styles.managertext}/>}
          <Button
            type="submit"
            variant="action"
            disabled={!buttonEnabled}
            colorStyle={!showApprove ? 'redPrimary' : 'bluePrimary'}
          >
            {showApprove ? 'Approve' : 'Revoke'} Manager
          </Button>
          <SetPublicResolverManagerModal
            name={name}
            addr={managerInfo.managerAddress}
            approve={showApprove}
            isForAllMode={isForAllMode}
            open={dialogOpen}
            setIsOpen={setDialogOpen}
          />
        </form>
      </div>

      <Toaster position="bottom-center" toastOptions={{style:{maxWidth:'420px'}}} />
    </>
  )
}
