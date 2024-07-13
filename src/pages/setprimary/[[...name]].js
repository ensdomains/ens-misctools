import styles from '../../styles/SetPrimary.module.css'
import Head from 'next/head'
import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Heading,
  Input,
  Checkbox,
  Typography,
  Dialog
} from '@ensdomains/thorin'
import { useAccount, usePublicClient } from 'wagmi'
import { getContract } from 'viem'
import Header from '../../components/header'
import SetPrimaryModal from '../../components/setprimary-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig, AddressZero } from '../../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  namehash,
  universalResolvePrimaryName,
  getUniversalResolverPrimaryName,
  universalResolveAddr,
  convertToAddress,
  getAddress,
  isValidAddress,
  readContract,
  getMulticallResult
} from '../../lib/utils'
import { useChain, useRouterPush, useRouterUpdate, useDelayedName } from '../../hooks/misc'

export default function SetPrimary() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isClearName, setClearName] = useState(false)
  const [nameOrAddress, setNameOrAddress] = useState('')
  const [isForAddrMode, setForAddrMode] = useState(false)
  const [useReverseRegistrar, setUseReverseRegistrar] = useState(true)
  const [primarySameDialogOpen, setPrimarySameDialogOpen] = useState(false)

  const delayedNameOrAddress = useDelayedName(nameOrAddress, '/setprimary/')
  const onNameChange = useRouterPush('/setprimary/', setNameOrAddress)
  useRouterUpdate('/setprimary/', nameOrAddress, onNameChange)

  const client = usePublicClient()
  const { address } = useAccount()
  const { chain, chains } = useChain(client)

  const defaultNameData = function() {
    return {
      name: '',
      address: '',
      errorResolvingAddress: '',
      currentPrimaryName: '',
      defaultReverseResolver: '',
      isContract: false,
      contractOwner: '',
      reverseRecordOwner: '',
      reverseRecordResolver: '',
      successfullyRetrievedInfo: false
    }
  }

  const [nameData, setNameData] = useState(defaultNameData())

  const getNameData = useCallback(async (nameOrAddress) => {
    const nameData = defaultNameData()

    if (validChain(chain, chains)) {
      if (isValidAddress(nameOrAddress)) {
        nameData.address = nameOrAddress
      } else {
        try {
          nameData.errorResolvingAddress = true

          const {
            isNameValid,
            normalizedName
          } = normalize(nameOrAddress)

          if (isNameValid) {
            nameData.name = normalizedName

            const universalResolver = getContract({address: ensConfig[chain].UniversalResolver?.address, abi: ensConfig[chain].UniversalResolver?.abi, client})
            const addrResult = await universalResolveAddr(client, universalResolver, normalizedName, parseName(normalizedName).node)
            if (addrResult && !(addrResult instanceof Error) && addrResult.length > 0) {
              const resolvedAddr = convertToAddress(addrResult[0])
              if (isValidAddress(resolvedAddr)) {
                nameData.address = resolvedAddr
                nameData.errorResolvingAddress = false
              }
            }
          }
        } catch(e) {
          console.error(e)
        }
      }

      if (nameData.address) {
        try {
          const batch1 = []

          const universalResolver = getContract({address: ensConfig[chain].UniversalResolver?.address, abi: ensConfig[chain].UniversalResolver?.abi, client})

          // Resolve current Primary Name
          batch1.push(universalResolvePrimaryName(client, universalResolver, nameData.address))

          let contractIsOwnable = false

          // Get default reverse resolver
          const reverseRegistrar = getContract({address: ensConfig[chain].ReverseRegistrar?.address, abi: ensConfig[chain].ReverseRegistrar?.abi, client})
          batch1.push(readContract(client, reverseRegistrar, 'defaultResolver'))

          // Check if address is contract
          batch1.push(client.getBytecode({address: nameData.address}))

          // Check if connected address is owner of reverse record
          const reverseNode = namehash(nameData.address.toLowerCase().substring(2) + '.addr.reverse')
          const registry = getContract({address: ensConfig[chain].Registry?.address, abi: ensConfig[chain].Registry?.abi, client})
          batch1.push(readContract(client, registry, 'owner', reverseNode))

          // Get current resolver of reverse record
          batch1.push(readContract(client, registry, 'resolver', reverseNode))

          // Check if address is Ownable owner for contract
          try {
            const targetContract = getContract({address: nameData.address, abi: ['function owner() public view returns (address)'], client})
            batch1.push(readContract(client, targetContract, 'owner').catch(e => e))
            contractIsOwnable = true
          } catch (e) {}

          const results1 = await Promise.all(batch1)
          let results1Index = 0

          nameData.currentPrimaryName = getUniversalResolverPrimaryName(nameData.address, getMulticallResult(results1[results1Index]))
          results1Index++

          nameData.defaultReverseResolver = getAddress(getMulticallResult(results1[results1Index], true))
          results1Index++

          const isContractResult = results1[results1Index]
          nameData.isContract = isContractResult && isContractResult !== '0x'
          results1Index++

          nameData.reverseRecordOwner =  getAddress(getMulticallResult(results1[results1Index], true))
          results1Index++

          nameData.reverseRecordResolver = getAddress(getMulticallResult(results1[results1Index], true))
          results1Index++

          if (contractIsOwnable) {
            const contractIsOwnableResult = getMulticallResult(results1[results1Index])
            if (contractIsOwnableResult && !(contractIsOwnableResult instanceof Error)) {
              nameData.contractOwner = getAddress(contractIsOwnableResult)
            }
            results1Index++
          }

          nameData.successfullyRetrievedInfo = true
        } catch(e) {
          console.error(e)
        }
      }
    }

    setNameData(nameData)
  }, [setNameData, client, chain, chains])

  useEffect(() => {
    getNameData(delayedNameOrAddress)
    return () => {
      setNameData(defaultNameData())
    }
  }, [delayedNameOrAddress, getNameData, setNameData])

  let buttonEnabled = false
  if (nameData && nameData.successfullyRetrievedInfo) {
    buttonEnabled = isClearName || nameData.name !== ''
  }

  return (
    <>
      <Head>
        <title>ENS Tools - Set Primary Name</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Set ENS Primary Name, for contract addresses too"/>
        <meta property="og:title" content="ENS Tools - Set Primary Name"/>
        <meta property="og:description" content="Set ENS Primary Name, for contract addresses too"/>
        <meta property="og:image" content="https://tools.ens.domains/sharing-setprimary.jpg"/>
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

            if (!nameOrAddress) {
              if (isClearName) {
                return toast.error('Please enter an address or ENS name')
              } else {
                return toast.error('Please enter an ENS name')
              }
            }

            if (!nameData) {
              console.error('Still loading data...')
              return
            }

            // Normalize name
            const {
              isNameValid,
              normalizedName
            } = normalize(nameData.name)

            if (nameData.name !== '' && !isNameValid) {
              return toast.error(`${nameData.name} is not a valid name`)
            }
            if (nameData.errorResolvingAddress) {
              return toast.error(`${nameData.name} does not resolve to an ETH address`)
            }
            if (!isValidAddress(nameData.address)) {
              return toast.error(`Invalid address`)
            }
            if (nameData.name === '' && !isClearName) {
              return toast.error('Please enter a valid ENS name')
            }

            // Check wallet connection
            if (!isValidAddress(address)) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!validChain(chain, chains)) {
              return toast.error('Switch to a supported network')
            }

            let isPrimaryNameAlreadyTheSame = false
            if (isClearName) {
              if (nameData.currentPrimaryName === '' || nameData.currentPrimaryName === AddressZero) {
                isPrimaryNameAlreadyTheSame = true
              }
            } else {
              const {
                isNameValid : isCurrentPrimaryNameValid,
                normalizedName: normalizedCurrentPrimaryName
              } = normalize(nameData.currentPrimaryName)

              if (isNameValid && isCurrentPrimaryNameValid && normalizedName === normalizedCurrentPrimaryName) {
                isPrimaryNameAlreadyTheSame = true
              }
            }

            let isForAddrMode = getAddress(nameData.address) !== getAddress(address) || nameData.isContract
            let useReverseRegistrar = true

            if (isForAddrMode) {
              if (!isValidAddress(nameData.defaultReverseResolver)) {
                return toast.error('Unable to find default reverse resolver')
              }

              const isReverseRecordOwner = getAddress(address) === getAddress(nameData.reverseRecordOwner)
              const isContractOwner = isValidAddress(nameData.contractOwner) && getAddress(address) === getAddress(nameData.contractOwner)

              // Check if connected address is ENS Registry operator for contract
              let approvedRegistryOperator = false
              try {
                const registry = getContract({address: ensConfig[chain].Registry?.address, abi: ensConfig[chain].Registry?.abi, client})
                approvedRegistryOperator = await readContract(client, registry, 'isApprovedForAll', nameData.address, address)
              } catch(e) {
                console.error(e)
              }

              if (!approvedRegistryOperator && !isContractOwner) {
                if (isReverseRecordOwner) {
                  useReverseRegistrar = false
                } else {
                  if (!isClearName && nameData.name) {
                    toast.error(`${nameData.name} does not resolve to your address`)
                  }
                  if (nameData.isContract) {
                    if (isValidAddress(nameData.contractOwner)) {
                      toast.error('You are not an owner or operator for this contract')
                      return toast.error(`The contract owner is ${nameData.contractOwner}`)
                    } else {
                      return toast.error('You are not an owner or operator for this contract')
                    }
                  } else {
                    return toast.error('You are not an operator for this address')
                  }
                }
              }
            }

            setForAddrMode(isForAddrMode)
            setUseReverseRegistrar(useReverseRegistrar)

            if (isPrimaryNameAlreadyTheSame) {
              setPrimarySameDialogOpen(true)
            } else {
              setDialogOpen(true)
            }
          }}
        >
          <div className={styles.radiorow}>
            <Checkbox label="Clear Primary Name" checked={isClearName} onChange={() => setClearName(!isClearName)}/>
          </div>
          <div className={styles.col}>
            <Input
              name="tname"
              label={isClearName ? "Address or ENS Name" : "ENS Name"}
              placeholder="myname.eth"
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          {delayedNameOrAddress && nameData ? (
            nameData.name && nameData.errorResolvingAddress ? (
              <Typography className={styles.addresstext} color="red">Does not resolve to an ETH address</Typography>
            ) : nameData.address && getAddress(delayedNameOrAddress) !== getAddress(nameData.address) ? (
              <Typography className={styles.addresstext}>{nameData.address}</Typography>
            ) : <div className={styles.addresstext}/>
          ) : <div className={styles.addresstext}/>}
          <Button
            type="submit"
            variant="action"
            disabled={!buttonEnabled}
          >
            {isClearName ? 'Clear' : 'Set'} Primary Name
          </Button>
          <Dialog
            open={primarySameDialogOpen}
            className="modal"
            variant="actionable"
            title={`Primary Name Already ${isClearName ? 'Cleared' : 'Set'}`}
            leading={<Button shadowless variant="secondary" onClick={() => setPrimarySameDialogOpen(false)}>Cancel</Button>}
            trailing={<Button shadowless onClick={() => {
              setPrimarySameDialogOpen(false)
              setDialogOpen(true)
            }}>Continue</Button>}
            onDismiss={() => setPrimarySameDialogOpen(false)}
          >
            <Typography>
              The primary name for {nameData.address} is already {isClearName ? <>unset</> : <>set to &quot;{nameData.currentPrimaryName}&quot;</>}.
              <br/><br/>
              Do you want to continue and {isClearName ? <>clear the</> : <>set it to the same</>} primary name again?
              <br/><br/>
              This may be useful if you don&apos;t currently own the reverse node in the registry, and you want to reclaim it.
            </Typography>
          </Dialog>
          <SetPrimaryModal
            isForAddrMode={isForAddrMode}
            addr={nameData.address}
            owner={address}
            resolver={nameData.defaultReverseResolver}
            name={isClearName ? '' : nameData.name}
            useReverseRegistrar={useReverseRegistrar}
            reverseRecordResolver={nameData.reverseRecordResolver}
            open={dialogOpen}
            setIsOpen={(isOpen) => {
              setDialogOpen(isOpen)
              if (!isOpen) {
                setForAddrMode(false)
                setUseReverseRegistrar(true)
              }
            }}
          />
        </form>
      </div>

      <Toaster position="bottom-center" toastOptions={{style:{maxWidth:'420px'}}} />
    </>
  )
}
