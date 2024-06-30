import { useState } from 'react'
import {
  Button,
  Heading,
  Dialog,
  Typography,
} from '@ensdomains/thorin'
import StepDot from './stepdot'
import { ensConfig, AddressZero } from '../lib/constants'
import toast from 'react-hot-toast'
import {
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { goerli, sepolia } from '@wagmi/core/chains'
import { normalize, namehash, isValidAddress, getChainName } from '../lib/utils'
import { useChain } from '../hooks/misc'
import { usePlausible } from 'next-plausible'

export default function SetPrimaryModal({
  isForAddrMode,
  addr,
  owner,
  resolver,
  name,
  useReverseRegistrar,
  reverseRecordResolver,
  open,
  setIsOpen,
}) {
  const plausible = usePlausible()
  const client = usePublicClient()
  const { chain } = useChain(client)
  const [isResolverSet, setIsResolverSet] = useState(false)
  const [isPrimaryNameSet, setIsPrimaryNameSet] = useState(false)

  const hasResolver = isValidAddress(reverseRecordResolver) || isResolverSet

  const nameIsEmpty = name === ''

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  const nameToSet = nameIsEmpty ? AddressZero : normalizedName

  const reverseNode = addr ? namehash(addr.toLowerCase().substring(2) + '.addr.reverse') : ''

  // Contract write: setName
  const setName = useWriteContract()

  const setNameWrite = () => {
    setName.writeContract({
      ...ensConfig[chain]?.ReverseRegistrar,
      functionName: isForAddrMode ? 'setNameForAddr' : 'setName',
      args: isForAddrMode ? [
        addr,
        owner,
        resolver,
        nameToSet
      ] : [
        nameToSet
      ],
      gas: 150000n
    }, {
      onSuccess: () => {
        toast.success(`Your primary name has been ${nameIsEmpty ? 'cleared' : 'set'}!`)
        setIsPrimaryNameSet(true)

        plausible('Set Primary Name', {
          props: {
            node: reverseNode,
            name: normalizedName,
            forAddr: isForAddrMode,
            usingRR: true,
            network: getChainName(chain)
          }
        })
      },
      onError: (err) => {
        console.error(err)
        toast.error(err.shortMessage)
      }
    })
  }

  // Wait for setName to settle
  const waitForSetName = useWaitForTransactionReceipt({
    hash: setName?.data
  })

  // Contract write: setResolver
  const setResolver = useWriteContract()

  const setResolverWrite = () => {
    setResolver.writeContract({
      ...ensConfig[chain]?.Registry,
      functionName: 'setResolver',
      args: [
        reverseNode,
        resolver
      ],
      gas: 60000n
    }, {
      onSuccess: () => {
        setIsResolverSet(true)
  
        plausible('Set Reverse Resolver', {
          props: {
            node: reverseNode,
            resolver: resolver,
            network: getChainName(chain)
          }
        })
      },
      onError: (err) => {
        console.error(err)
        toast.error(err.shortMessage)
      }
    })
  }

  // Wait for setResolver to settle
  const waitForSetResolver = useWaitForTransactionReceipt({
    hash: setResolver?.data
  })

  // Contract write: resolver.setName
  const resolverSetName = useWriteContract()

  const resolverSetNameWrite = () => {
    resolverSetName.writeContract({
      address: isValidAddress(reverseRecordResolver) ? reverseRecordResolver : resolver,
      abi: ['function setName(bytes32 node, string calldata newName) external'],
      functionName: 'setName',
      args: [
        reverseNode,
        nameToSet
      ],
      gas: 150000n
    }, {
      onSuccess: () => {
        toast.success(`Your primary name has been ${nameIsEmpty ? 'cleared' : 'set'}!`)
        setIsPrimaryNameSet(true)

        plausible('Set Primary Name', {
          props: {
            node: reverseNode,
            name: normalizedName,
            forAddr: isForAddrMode,
            usingRR: false,
            network: getChainName(chain)
          }
        })
      },
      onError: (err) => {
        console.error(err)
        let errMsg = err.shortMessage
        let index = errMsg.indexOf('[')
        if (index <= 0) {
          index = errMsg.indexOf(';')
        }
        if (index <= 0) {
          index = errMsg.indexOf('(')
        }
        if (index > 0) {
          errMsg = errMsg.substring(0, index)
        }
        toast.error(errMsg)
      }
    })
  }

  // Wait for resolver.setName to settle
  const waitForResolverSetName = useWaitForTransactionReceipt({
    hash: resolverSetName?.data
  })

  const setResolverTx = setResolver
  const setResolverTxWrite = setResolverWrite
  const waitForSetResolverTx = waitForSetResolver

  const setNameTx = useReverseRegistrar ? setName : resolverSetName
  const setNameTxWrite = useReverseRegistrar ? setNameWrite : resolverSetNameWrite
  const waitForSetNameTx = useReverseRegistrar ? waitForSetName : waitForResolverSetName

  const dismiss = () => {
    setIsResolverSet(false)
    setIsPrimaryNameSet(false)
    setName.reset()
    setResolver.reset()
    resolverSetName.reset()
    setIsOpen(false)
  }

  return (
    <>
      <Dialog
        open={open && (nameIsEmpty || isNameValid)}
        className="modal"
        title={<>
          <Heading as="h2" align="center">
            {isPrimaryNameSet ? `Primary Name ${nameIsEmpty ? 'Cleared' : 'Set'}!` : `${nameIsEmpty ? 'Clear' : 'Set'} Primary Name`}
          </Heading>
          {!isPrimaryNameSet && 
            <>
              {!nameIsEmpty &&
                <Typography>To: {bestDisplayName}</Typography>
              }
              {isForAddrMode &&
                <Typography>For: {addr}</Typography>
              }
            </>
          }
        </>}
        variant="actionable"
        leading={
          <>
            {!setNameTx.data && (
              <Button
                shadowless
                variant="secondary"
                onClick={dismiss}
              >
                Cancel
              </Button>
            )}
          </>
        }
        trailing={
          isPrimaryNameSet ? (
            // Link to ENS manager
            <Button
              as="a"
              href={`https://app.ens.domains/${addr}`}
              target="_blank"
              rel="noreferrer"
            >
              Open ENS Manager
            </Button>
          ) : (setNameTx.data || (!hasResolver && setResolverTx.data)) ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain === goerli.id ? 'goerli.' : chain === sepolia.id ? 'sepolia.' : ''}etherscan.io/tx/${setNameTx.data || setResolverTx.data}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : (
            // Show open wallet button
            <Button shadowless onClick={() => !useReverseRegistrar && !hasResolver ? setResolverTxWrite() : setNameTxWrite()} >
              Open Wallet
            </Button>
          )
        }
        onDismiss={() => {
          if (isPrimaryNameSet) {
            // Refresh the page on dialog exit to fully reset state
            window.location.reload()
          } else {
            dismiss()
          }
        }}
      >
        <div style={{width:'100%'}}>
          <Typography size="base" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            {isPrimaryNameSet && (
              <p>
                {nameIsEmpty ? <>
                  You successfully cleared the primary name!
                </> : <>
                  You successfully set the primary name to <strong>{bestDisplayName}</strong>!
                </>}
              </p>
            )}
          </Typography>
          <Typography size="base" weight="medium">
            <ul className="steps">
              {!useReverseRegistrar && !isValidAddress(reverseRecordResolver) &&
                <StepDot
                  label="Set Resolver"
                  loading={!setResolverTx.data}
                  spinner={waitForSetResolverTx.isLoading}
                  success={waitForSetResolverTx.isSuccess}
                  error={waitForSetResolverTx.isError}
                />
              }
              <StepDot
                label={`${nameIsEmpty ? 'Clear' : 'Set'} Primary Name`}
                loading={(useReverseRegistrar || hasResolver) && !setNameTx.data}
                spinner={waitForSetNameTx.isLoading}
                success={waitForSetNameTx.isSuccess}
                error={(useReverseRegistrar || hasResolver) && waitForSetNameTx.isError}
              />
            </ul>
          </Typography>
        </div>
      </Dialog>

      <style jsx="true">{`
        .steps {
          display: flex;
          flex-direction: row;
          justify-content: space-around;
          margin: 0 auto;
          max-width: 23rem;
          gap: 0.75rem;
        }
      `}</style>
    </>
  )
}
