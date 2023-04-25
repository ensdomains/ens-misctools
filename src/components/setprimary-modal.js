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
import { goerli } from '@wagmi/core/chains'
import { normalize, namehash, isValidAddress } from '../lib/utils'

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
  const { chain } = useNetwork()
  const [isResolverSet, setIsResolverSet] = useState(false)
  const [isPrimaryNameSet, setIsPrimaryNameSet] = useState(false)

  const hasResolver = isValidAddress(reverseRecordResolver) || isResolverSet

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  const reverseNode = addr ? namehash(addr.toLowerCase().substring(2) + '.addr.reverse') : ''

  // Contract write: setName
  const setName = useContractWrite({
    ...ensConfig[chain?.id]?.ReverseRegistrar,
    functionName: isForAddrMode ? 'setNameForAddr' : 'setName',
    args: isForAddrMode ? [
      addr,
      owner,
      resolver,
      normalizedName
    ] : [
      normalizedName
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
        toast.success('Your primary name has been set!')
        setIsPrimaryNameSet(true)
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
      }
    },
  })

  // Contract write: resolver.setName
  const resolverSetName = useContractWrite({
    address: reverseRecordResolver,
    abi: ['function setName(bytes32 node, string calldata newName) external'],
    // abi: '[{"inputs":[{"internalType":"bytes32","name":"node","type":"bytes32"},{"internalType":"string","name":"newName","type":"string"}],"name":"setName","outputs":[],"stateMutability":"nonpayable","type":"function"}]',
    functionName: 'setName',
    args: [
      reverseNode,
      normalizedName
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
        toast.success('Your primary name has been set!')
        setIsPrimaryNameSet(true)
      }
    },
  })

  const setNameTx = useReverseRegistrar ? setName : resolverSetName
  const waitForSetNameTx = useReverseRegistrar ? waitForSetName : waitForResolverSetName

  return (
    <>
      <Dialog
        open={open && isNameValid}
        className="modal"
        title={<>
          <Heading as="h2" align="center">
            {isPrimaryNameSet ? 'Primary Name Set!' : 'Set Primary Name'}
          </Heading>
          {!isPrimaryNameSet && 
            <>
              <Typography>To: {bestDisplayName}</Typography>
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
                onClick={() => setIsOpen(false)}
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
              href={`https://app.ens.domains/name/${bestDisplayName}/details`}
              target="_blank"
              rel="noreferrer"
            >
              Open ENS Manager
            </Button>
          ) : setNameTx.data?.hash ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain?.id === goerli.id ? 'goerli.' : ''}etherscan.io/tx/${setNameTx.data.hash}`}
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
            setIsOpen(false)
          }
        }}
      >
        <div>
          <Typography size="base" style={{ marginBottom: '1.5rem' }}>
            {isPrimaryNameSet && (
              <p>
                You successfully set the primary name to <strong>{bestDisplayName}</strong>!
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
                label="Set Primary Name"
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
