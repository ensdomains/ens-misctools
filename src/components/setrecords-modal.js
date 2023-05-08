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
import { ethers } from 'ethers'
import {
  normalize,
  parseName,
  encodeMethodData
} from '../lib/utils'
import { usePlausible } from 'next-plausible'

export default function SetRecordsModal({
  name,
  resolver,
  ethAddress,
  records,
  open,
  setIsOpen,
}) {
  const plausible = usePlausible()
  const { chain } = useNetwork()
  const [isDone, setIsDone] = useState(false)

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  const {
    node
  } = parseName(normalizedName)

  const data = []

  if (ethAddress && ethers.utils.isAddress(ethAddress)) {
    data.push(encodeMethodData('setAddr(bytes32,address)', ethers.utils.defaultAbiCoder.encode(['bytes32', 'address'], [node, ethAddress])))
  }

  for (let i in records) {
    if (records[i].key) {
      data.push(encodeMethodData('setText(bytes32,string,string)', ethers.utils.defaultAbiCoder.encode(['bytes32', 'string', 'string'], [node, records[i].key, records[i].value])))
    }
  }

  // Contract write
  const writeTx = useContractWrite({
    address: resolver,
    abi: ensConfig[chain?.id]?.LatestPublicResolver.abi,
    functionName: 'multicall',
    args: [data],
    // overrides: {
    //   gasLimit: '60000',
    // },
    onError: (err) => {
      console.error(err)
      toast.error(err.message)
    },
  })

  // Wait for writeTx to settle
  const waitForWriteTx = useWaitForTransaction({
    hash: writeTx?.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Set records failed')
      } else {
        toast.success(`Records successfully updated!`)
        setIsDone(true)

        plausible('Set Records', {
          props: {
            name: normalizedName,
            network: chain.name
          }
        })
      }
    },
  })

  const dismiss = () => {
    setIsDone(false)
    writeTx.reset()
    setIsOpen(false)
  }

  return (
    <>
      <Dialog
        open={open && isNameValid && (ethAddress || records.length > 0)}
        className="modal"
        title={<>
          <Heading as="h2" align="center">
            {isDone ? 'Records Set!' : 'Set Records'}
          </Heading>
          {!isDone &&
            <Typography>For: {bestDisplayName}</Typography>
          }
        </>}
        variant="actionable"
        leading={
          <>
            {!writeTx.data && (
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
          isDone ? (
            // Link to ENS manager
            <Button
              as="a"
              href={`https://app.ens.domains/${bestDisplayName}?tab=records`}
              target="_blank"
              rel="noreferrer"
            >
              Open ENS Manager
            </Button>
          ) : writeTx.data?.hash ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain?.id === goerli.id ? 'goerli.' : ''}etherscan.io/tx/${writeTx.data?.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : (
            // Show open wallet button
            <Button shadowless onClick={() => writeTx.write()} >
              Open Wallet
            </Button>
          )
        }
        onDismiss={() => {
          if (isDone) {
            // Refresh the page on dialog exit to fully reset state
            window.location.reload()
          } else {
            dismiss()
          }
        }}
      >
        <div style={{width:'100%'}}>
          <Typography size="base" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            {isDone && (
              <p>
                {ethAddress && updatedRecords.length > 0 ? <>
                  You successfully updated the ETH address and {updatedRecords.length} text records!
                </> : ethAddress ? <>
                  You successfully updated the ETH address!
                </> : updatedRecords.length > 0 ? <>
                  You successfully updated {updatedRecords.length} text records!
                </> : <></>}
              </p>
            )}
          </Typography>
          <Typography size="base" weight="medium">
            <ul className="steps">
              <StepDot
                label={`Set Records (Multicall)`}
                loading={!writeTx.data}
                spinner={waitForWriteTx.isLoading}
                success={waitForWriteTx.data?.status === 1}
                error={waitForWriteTx.data?.status !== 1}
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
