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
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { mainnet } from '@wagmi/core/chains'
import { normalize, parseName, isValidAddress, getChainName } from '../lib/utils'
import { useChain } from '../hooks/misc'
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
  const client = usePublicClient()
  const { chain } = useChain(client)
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
  const approveTx = useWriteContract()

  const approveTxWrite = () => {
    approveTx.writeContract({
      ...ensConfig[chain]?.LatestPublicResolver,
      functionName: isForAllMode ? 'setApprovalForAll' : 'approve',
      args: isForAllMode ? [
        addr,
        approve
      ] : [
        node,
        addr,
        approve
      ],
      gas: 60000n
    }, {
      onSuccess: () => {
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

  // Wait for approveTx to settle
  const waitForApproveTx = useWaitForTransactionReceipt({
    hash: approveTx?.data
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
          !isManagerSet ? (
            !approveTx.data && (
              <Button
                shadowless
                variant="secondary"
                onClick={dismiss}
              >
                Cancel
              </Button>
            )
          ) : approve && (
            // Link to Set Records
            <Button
              as="a"
              href={`/setrecords/${bestDisplayName}`}
            >
              Set Records
            </Button>
          )
        }
        trailing={
          isManagerSet ? (
            // Close
            <Button onClick={() => window.location.reload()}>
              Done
            </Button>
          ) : approveTx.data ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain === mainnet.id ? '' : getChainName(chain) + '.'}etherscan.io/tx/${approveTx.data}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : (
            // Show open wallet button
            <Button shadowless onClick={approveTxWrite} >
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
                success={waitForApproveTx.isSuccess}
                error={waitForApproveTx.isError}
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
