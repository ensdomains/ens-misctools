import styles from '../styles/SetPrimary.module.css'
import Head from 'next/head'
import { useState } from 'react'
import {
  Button,
  Heading,
  Input,
  RadioButton,
  Tooltip,
  Typography,
  Dialog
} from '@ensdomains/thorin'
import { useAccount, useProvider } from 'wagmi'
import { ethers } from 'ethers'
import { MulticallWrapper } from 'ethers-multicall-provider'
import Header from '../components/header'
import SetPrimaryModal from '../components/setprimary-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig } from '../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  namehash,
  universalResolveAddr,
  universalResolvePrimaryName,
  getUniversalResolverPrimaryName,
  convertToAddress,
  getAddress,
  isValidAddress
} from '../lib/utils'
import { useChain } from '../hooks/misc'

export default function SetPrimary() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [contractAddress, setContractAddress] = useState('')
  const [defaultReverseResolver, setDefaultReverseResolver] = useState('')
  const [useReverseRegistrar, setUseReverseRegistrar] = useState(true)
  const [reverseRecordResolver, setReverseRecordResolver] = useState('')
  const [primarySameDialogOpen, setPrimarySameDialogOpen] = useState(false)
  const [emptyNameDialogOpen, setEmptyNameDialogOpen] = useState(false)
  const [isForAddrMode, setForAddrMode] = useState(false)

  const provider = useProvider()
  const { address } = useAccount()
  const { chain, chains } = useChain(provider)

  const nameIsEmpty = name === ''

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

            let defaultReverseResolver = ''
            let useReverseRegistrar = true
            let reverseRecordResolver = ''
            let isPrimaryNameAlreadyTheSame = false

            // Normalize name
            const {
              isNameValid,
              normalizedName
            } = normalize(name)

            if (isNameValid) {
              setName(normalizedName)
            } else if (!nameIsEmpty) {
              return toast.error(`${name} is not a valid name`)
            }

            // Calculate node
            const {
              node
            } = parseName(normalizedName)

            // Check wallet connection
            if (!isValidAddress(address)) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!validChain(chain, chains)) {
              return toast.error('Switch to a supported network')
            }

            if (isForAddrMode) {
              if (!isValidAddress(contractAddress)) {
                return toast.error('Enter a valid contract address')
              }
            }

            const multi = MulticallWrapper.wrap(provider)
            const batch1 = []

            const universalResolver = new ethers.Contract(ensConfig[chain].UniversalResolver?.address, ensConfig[chain].UniversalResolver?.abi, multi)

            if (!nameIsEmpty) {
              // Resolve ETH address              
              batch1.push(universalResolveAddr(universalResolver, normalizedName, node))
            }

            // Resolve current Primary Name
            batch1.push(universalResolvePrimaryName(universalResolver, isForAddrMode ? contractAddress : address))

            let contractIsOwnable = false
            if (isForAddrMode) {
              // Get default reverse resolver
              const reverseRegistrar = new ethers.Contract(ensConfig[chain].ReverseRegistrar?.address, ensConfig[chain].ReverseRegistrar?.abi, multi)
              batch1.push(reverseRegistrar.defaultResolver())

              // Check if contract is actually contract
              batch1.push(multi.getCode(contractAddress))

              // Check if address is ENS Registry operator for contract
              const registry = new ethers.Contract(ensConfig[chain].Registry?.address, ensConfig[chain].Registry?.abi, multi)
              batch1.push(registry.isApprovedForAll(contractAddress, address))

              // Check if address is owner of reverse record
              const reverseNode = namehash(contractAddress.toLowerCase().substring(2) + '.addr.reverse')
              batch1.push(registry.owner(reverseNode))

              // Get current resolver of reverse record
              batch1.push(registry.resolver(reverseNode))

              // Check if address is Ownable owner for contract
              try {
                const targetContract = new ethers.Contract(contractAddress, ['function owner() public view returns (address)'], multi)
                batch1.push(targetContract['owner()']().catch(e => e))
                contractIsOwnable = true
              } catch (e) {}
            }

            const results1 = await Promise.all(batch1)
            let results1Index = 0

            if (!nameIsEmpty) {
              let ethAddress = ''
              if (results1[results1Index] && !(results1[results1Index] instanceof Error) && results1[results1Index].length >= 1) {
                ethAddress = convertToAddress(results1[results1Index][0])
              }
              results1Index++

              if (!isValidAddress(ethAddress)) {
                return toast.error('Name does not resolve to an ETH address')
              } else if (!isForAddrMode && getAddress(address) !== ethAddress) {
                return toast.error('Name does not resolve to your address')
              } else if (isForAddrMode && getAddress(contractAddress) !== ethAddress) {
                return toast.error('Name does not resolve to the entered address')
              }
            }

            const currentPrimaryName = getUniversalResolverPrimaryName(isForAddrMode ? contractAddress : address, results1[results1Index])
            results1Index++

            const {
              isNameValid : isNameValid2,
              normalizedName: normalizedName2
            } = normalize(currentPrimaryName)

            if ((isNameValid && isNameValid2 && normalizedName2 === normalizedName) || (nameIsEmpty && (currentPrimaryName === '' || currentPrimaryName === ethers.constants.AddressZero))) {
              isPrimaryNameAlreadyTheSame = true
            }

            if (isForAddrMode) {
              defaultReverseResolver = getAddress(results1[results1Index])
              results1Index++

              if (!isValidAddress(defaultReverseResolver)) {
                return toast.error('Unable to find default reverse resolver')
              }

              const isContract = results1[results1Index] && results1[results1Index] !== '0x'
              results1Index++

              const approved = results1[results1Index]
              results1Index++

              const isReverseRecordOwner = getAddress(address) === getAddress(results1[results1Index])
              results1Index++

              reverseRecordResolver = getAddress(results1[results1Index])
              results1Index++

              let contractOwner = ''
              if (contractIsOwnable) {
                if (results1[results1Index] && !(results1[results1Index] instanceof Error)) {
                  contractOwner = getAddress(results1[results1Index])
                }
                results1Index++
              }
              const isOwner = isValidAddress(contractOwner) && getAddress(address) === contractOwner

              const isContractItself = getAddress(address) === getAddress(contractAddress)

              if (!isContractItself && !approved && !isOwner) {
                if (isReverseRecordOwner) {
                  useReverseRegistrar = false
                } else if (isContract) {
                  if (isValidAddress(contractOwner)) {
                    toast.error('You are not an owner or operator for this contract')
                    return toast.error(`The contract owner is ${contractOwner}`)
                  } else {
                    return toast.error('You are not an owner or operator for this contract')
                  }
                } else {
                  return toast.error('You are not an operator for this address')
                }
              }
            }

            setDefaultReverseResolver(defaultReverseResolver)
            setUseReverseRegistrar(useReverseRegistrar)
            setReverseRecordResolver(reverseRecordResolver)

            if (isPrimaryNameAlreadyTheSame) {
              setPrimarySameDialogOpen(true)
            } else if (nameIsEmpty) {
              setEmptyNameDialogOpen(true)
            } else {
              setDialogOpen(true)
            }
          }}
        >
          <div className={styles.radiorow}>
            <Tooltip content={<Typography>Set the ENS Primary Name for your currently connected address.</Typography>}>
              <RadioButton label="For Your Address" name="foraddrmode" value="false" checked={!isForAddrMode} onChange={() => {
                setForAddrMode(false)
                setContractAddress('')
              }}/>
            </Tooltip>
            <Tooltip width={400} content={
                <Typography>
                  Set the ENS Primary Name for a separate address.
                  <br/><br/>
                  This must be either a contract account that you own (via Ownable), or an account that you are approved as an operator for in the ENS Registry.
                </Typography>
              }>
              <RadioButton label="For Another Address" name="foraddrmode" value="true" checked={isForAddrMode} onChange={() => {
                setForAddrMode(true)
                setContractAddress('')
              }}/>
            </Tooltip>
          </div>
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
          {isForAddrMode &&
            <div className={styles.col}>
              <Input
                name="taddr"
                label="For Address"
                placeholder="0x..."
                maxLength="255"
                spellCheck="false"
                autoCapitalize="none"
                parentStyles={{ backgroundColor: '#fff' }}
                onChange={(e) => setContractAddress(e.target.value)}
              />
            </div>
          }
          <Button
            type="submit"
            variant="action"
          >
            Set Primary Name
          </Button>
          <Dialog
            open={primarySameDialogOpen}
            className="modal"
            variant="actionable"
            title={`Primary Name Already ${nameIsEmpty ? 'Cleared' : 'Set'}`}
            leading={<Button shadowless variant="secondary" onClick={() => setPrimarySameDialogOpen(false)}>Cancel</Button>}
            trailing={<Button shadowless onClick={() => {
              setPrimarySameDialogOpen(false)
              setDialogOpen(true)
            }}>Continue</Button>}
            onDismiss={() => setPrimarySameDialogOpen(false)}
          >
            <Typography>
              {nameIsEmpty && <>
                You did not enter any name.
                <br/><br/>
              </>}
              The primary name for {isForAddrMode ? contractAddress : address} is already {nameIsEmpty ? <>unset</> : <>set to &quot;{normalize(name).bestDisplayName}&quot;</>}.
              <br/><br/>
              Do you want to continue and {nameIsEmpty ? <>clear the</> : <>set it to the same</>} primary name again?
              <br/><br/>
              This may be useful if you don&apos;t currently own the reverse node in the registry, and you want to reclaim it.
            </Typography>
          </Dialog>
          <Dialog
            open={emptyNameDialogOpen}
            className="modal"
            variant="actionable"
            title="Clear Primary Name?"
            leading={<Button shadowless variant="secondary" onClick={() => setEmptyNameDialogOpen(false)}>Cancel</Button>}
            trailing={<Button shadowless onClick={() => {
              setEmptyNameDialogOpen(false)
              setDialogOpen(true)
            }}>Continue</Button>}
            onDismiss={() => setEmptyNameDialogOpen(false)}
          >
            <Typography>
              You did not enter any name.
              <br/><br/>
              Do you really want to clear the Primary Name for {isForAddrMode ? contractAddress : address}?
            </Typography>
          </Dialog>
          <SetPrimaryModal
            isForAddrMode={isForAddrMode}
            addr={isForAddrMode ? contractAddress : address}
            owner={address}
            resolver={defaultReverseResolver}
            name={name}
            useReverseRegistrar={useReverseRegistrar}
            reverseRecordResolver={reverseRecordResolver}
            open={dialogOpen}
            setIsOpen={(isOpen) => {
              setDialogOpen(isOpen)
              if (!isOpen) {
                setDefaultReverseResolver('')
                setUseReverseRegistrar(true)
                setReverseRecordResolver('')
              }
            }}
          />
        </form>
      </div>

      <Toaster position="bottom-center" toastOptions={{style:{maxWidth:'420px'}}} />
    </>
  )
}