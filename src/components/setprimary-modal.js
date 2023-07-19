import { useState } from 'react'
import {
  Button,
  Heading,
  Dialog,
  Typography,
} from '@ensdomains/thorin'
import StepDot from './stepdot'
import { ensConfig } from '../lib/constants'
import toast from 'react-hot-toast'
import {
  useContractWrite,
  useNetwork,
  useWaitForTransaction,
} from 'wagmi'
import { goerli, sepolia } from '@wagmi/core/chains'
import { normalize, namehash, isValidAddress } from '../lib/utils'
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
  const { chain } = useNetwork()
  const [isResolverSet, setIsResolverSet] = useState(false)
  const [isPrimaryNameSet, setIsPrimaryNameSet] = useState(false)

  const hasResolver = isValidAddress(reverseRecordResolver) || isResolverSet

  const nameIsEmpty = name === ''

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  const nameToSet = nameIsEmpty ? '0x0000000000000000000000000000000000000000' : normalizedName

  const reverseNode = addr ? namehash(addr.toLowerCase().substring(2) + '.addr.reverse') : ''

  // Contract write: setName
  const setName = useContractWrite({
    ...ensConfig[chain?.id]?.ReverseRegistrar,
    functionName: isForAddrMode ? 'setNameForAddr' : 'setName',
    args: isForAddrMode ? [
      addr,
      owner,
      resolver,
      nameToSet
    ] : [
      nameToSet
    ],
    overrides: {
      gasLimit: '150000',
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Wait for setName to settle
  const waitForSetName = useWaitForTransaction({
    hash: setName?.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Set primary name failed')
      } else {
        toast.success(`Your primary name has been ${nameIsEmpty ? 'cleared' : 'set'}!`)
        setIsPrimaryNameSet(true)

        plausible('Set Primary Name', {
          props: {
            node: reverseNode,
            name: normalizedName,
            forAddr: isForAddrMode,
            usingRR: true,
            network: chain.name
          }
        })
      }
    },
  })

  // Contract write: setResolver
  const setResolver = useContractWrite({
    ...ensConfig[chain?.id]?.Registry,
    functionName: 'setResolver',
    args: [
      reverseNode,
      resolver
    ],
    overrides: {
      gasLimit: '60000',
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Wait for setResolver to settle
  const waitForSetResolver = useWaitForTransaction({
    hash: setResolver?.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Set resolver failed')
      } else {
        setIsResolverSet(true)

        plausible('Set Reverse Resolver', {
          props: {
            node: reverseNode,
            resolver: resolver,
            network: chain.name
          }
        })
      }
    },
  })

  // Contract write: resolver.setName
  const resolverSetName = useContractWrite({
    address: isValidAddress(reverseRecordResolver) ? reverseRecordResolver : resolver,
    abi: ['function setName(bytes32 node, string calldata newName) external'],
    functionName: 'setName',
    args: [
      reverseNode,
      nameToSet
    ],
    overrides: {
      gasLimit: '150000',
    },
    onError: (err) => {
      let errMsg = 'Error: ' + err.message
      const index = errMsg.indexOf('[')
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
    },
  })

  // Wait for resolver.setName to settle
  const waitForResolverSetName = useWaitForTransaction({
    hash: resolverSetName?.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Set primary name failed')
      } else {
        toast.success(`Your primary name has been ${nameIsEmpty ? 'cleared' : 'set'}!`)
        setIsPrimaryNameSet(true)

        plausible('Set Primary Name', {
          props: {
            node: reverseNode,
            name: normalizedName,
            forAddr: isForAddrMode,
            usingRR: false,
            network: chain.name
          }
        })
      }
    },
  })

  const setNameTx = useReverseRegistrar ? setName : resolverSetName
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
          ) : (setNameTx.data?.hash || (!hasResolver && setResolver.data?.hash)) ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain?.id === goerli.id ? 'goerli.' : chain?.id === sepolia.id ? 'sepolia.' : ''}etherscan.io/tx/${setNameTx.data?.hash || setResolver.data.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : (
            // Show open wallet button
            <Button shadowless onClick={() => !useReverseRegistrar && !hasResolver ? setResolver.write() : setNameTx.write()} >
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
                  loading={!setResolver.data}
                  spinner={waitForSetResolver.isLoading}
                  success={waitForSetResolver.data?.status === 1}
                  error={waitForSetResolver.data?.status !== 1}
                />
              }
              <StepDot
                label={`${nameIsEmpty ? 'Clear' : 'Set'} Primary Name`}
                loading={(useReverseRegistrar || hasResolver) && !setNameTx.data}
                spinner={waitForSetNameTx.isLoading}
                success={waitForSetNameTx.data?.status === 1}
                error={(useReverseRegistrar || hasResolver) && waitForSetNameTx.data?.status !== 1}
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
