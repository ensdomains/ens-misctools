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
import { normalize, parseName, isValidAddress } from '../lib/utils'
import { usePlausible } from 'next-plausible'

export default function SetPublicResolverManagerModal({
  name,
  addr,
  approve,
  isForAllMode,
  open,
  setIsOpen,
}) {
  const plausible = usePlausible()
  const { chain } = useNetwork()
  const [isManagerSet, setIsManagerSet] = useState(false)

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  const {
    node
  } = parseName(normalizedName)

  // Contract write: approve / setApprovalForAll
  const approveTx = useContractWrite({
    ...ensConfig[chain?.id]?.LatestPublicResolver,
    functionName: isForAllMode ? 'setApprovalForAll' : 'approve',
    args: isForAllMode ? [
      addr,
      approve
    ] : [
      node,
      addr,
      approve
    ],
    overrides: {
      gasLimit: '60000',
    },
    onError: (err) => {
      console.error(err)
      toast.error(err.message)
    },
  })

  // Wait for approveTx to settle
  const waitForApproveTx = useWaitForTransaction({
    hash: approveTx?.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Set manager failed')
      } else {
        if (approve) {
          toast.success(`You have successfully approved a new manager!`)
        } else {
          toast.success(`You have successfully revoked this manager!`)
        }
        setIsManagerSet(true)

        plausible('Set Public Resolver Manager', {
          props: {
            name: normalizedName,
            forAll: isForAllMode,
            network: chain.name
          }
        })
      }
    },
  })

  const dismiss = () => {
    setIsManagerSet(false)
    approveTx.reset()
    setIsOpen(false)
  }

  return (
    <>
      <Dialog
        open={open && isValidAddress(addr) && (isForAllMode || isNameValid)}
        className="modal"
        title={<>
          <Heading as="h2" align="center">
            {isManagerSet ? (approve ? 'Manager Approved!' : 'Manager Revoked!') : (approve ? 'Approve Manager' : 'Revoke Manager')}
          </Heading>
          {!isManagerSet && !isForAllMode &&
            <Typography>For: {bestDisplayName}</Typography>
          }
        </>}
        variant="actionable"
        leading={
          <>
            {!approveTx.data && (
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
          isManagerSet ? (
            // Close
            <Button onClick={() => window.location.reload()}>
              Done
            </Button>
          ) : approveTx.data?.hash ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain?.id === goerli.id ? 'goerli.' : ''}etherscan.io/tx/${approveTx.data?.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : (
            // Show open wallet button
            <Button shadowless onClick={() => approveTx.write()} >
              Open Wallet
            </Button>
          )
        }
        onDismiss={() => {
          if (isManagerSet) {
            // Refresh the page on dialog exit to fully reset state
            window.location.reload()
          } else {
            dismiss()
          }
        }}
      >
        <div style={{width:'100%'}}>
          <Typography size="base" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            {isManagerSet && (
              <p>
                {approve ? (
                  isForAllMode ? <>
                    You successfully approved {addr} as a manager for the ENS Public Resolver, for all names that you own!
                  </> : <>
                    You successfully approved {addr} as a manager for the ENS Public Resolver, for the name {bestDisplayName}!
                  </>
                ) : (
                  isForAllMode ? <>
                    You successfully revoked {addr} as a manager for the ENS Public Resolver, for all names that you own!
                  </> : <>
                    You successfully revoked {addr} as a manager for the ENS Public Resolver, for the name {bestDisplayName}!
                  </>
                )}
              </p>
            )}
          </Typography>
          <Typography size="base" weight="medium">
            <ul className="steps">
              <StepDot
                label={`${approve ? 'Approve' : 'Revoke'} Manager`}
                loading={!approveTx.data}
                spinner={waitForApproveTx.isLoading}
                success={waitForApproveTx.data?.status === 1}
                error={waitForApproveTx.data?.status !== 1}
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
