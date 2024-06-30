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
import { encodeAbiParameters } from 'viem'
import {
  normalize,
  parseName,
  encodeMethodData,
  getChainName
} from '../lib/utils'
import { useChain } from '../hooks/misc'
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
  const client = usePublicClient()
  const { chain } = useChain(client)
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

  let validEthAddress = true
  if (ethAddress) {
    if (isAddress(ethAddress)) {
      data.push(encodeMethodData('setAddr(bytes32,address)', encodeAbiParameters([{name: 'node', type: 'bytes32'}, {name: 'a', type: 'address'}], [node, ethAddress]), 'hex'))
    } else {
      validEthAddress = false
    }
  }

  let validRecords = true
  const recordsObj = {}
  let numUpdatedRecords = 0
  let numClearedRecords = 0

  for (let i in records) {
    if (records[i].key) {
      if (!recordsObj[records[i].key]) {
        data.push(encodeMethodData('setText(bytes32,string,string)', encodeAbiParameters([{name: 'node', type: 'bytes32'}, {name: 'key', type: 'string'}, {name: 'value', type: 'string'}], [node, records[i].key, records[i].value]), 'hex'))
        recordsObj[records[i].key] = true

        if (records[i].value) {
          numUpdatedRecords++
        } else {
          numClearedRecords++
        }
      } else {
        validRecords = false
      }
    } else {
      validRecords = false
    }
  }

  const validData = validEthAddress && validRecords

  // Contract write
  const writeTx = useWriteContract()

  const writeTxWrite = () => {
    writeTx.writeContract({
      address: resolver,
      abi: ensConfig[chain]?.LatestPublicResolver.abi,
      functionName: 'multicall',
      args: [data],
      // gas: 60000n
    }, {
      onSuccess: () => {
        toast.success(`Records successfully updated!`)
        setIsDone(true)

        plausible('Set Records', {
          props: {
            name: normalizedName,
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

  // Wait for writeTx to settle
  const waitForWriteTx = useWaitForTransactionReceipt({
    hash: writeTx?.data
  })

  const dismiss = () => {
    // Uncomment if state should be reset
    // setIsDone(false)
    // writeTx.reset()
    setIsOpen(false)
  }

  return (
    <>
      <Dialog
        open={open && isNameValid && validData}
        className="modal"
        title={<>
          <Heading as="h2" align="center">
            {isDone ? 'Records Set!' : 'Set Records'}
          </Heading>
          {!isDone && <>
              <Typography>For: {bestDisplayName}</Typography>
              {ethAddress &&
                <Typography>{ethAddress === AddressZero ? 'Clearing' : 'Updating'} ETH address</Typography>
              }
              {numUpdatedRecords > 0 &&
                <Typography>Updating {numUpdatedRecords} text record{numUpdatedRecords > 1 && 's'}</Typography>
              }
              {numClearedRecords > 0 &&
                <Typography>Clearing {numClearedRecords} text record{numClearedRecords > 1 && 's'}</Typography>
              }
            </>
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
          ) : writeTx.data ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${chain === goerli.id ? 'goerli.' : chain === sepolia.id ? 'sepolia.' : ''}etherscan.io/tx/${writeTx.data}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : (
            // Show open wallet button
            <Button shadowless onClick={writeTxWrite} >
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
                {ethAddress && records.length > 0 ? <>
                  You successfully updated the ETH address and {records.length} text records!
                </> : ethAddress ? <>
                  You successfully updated the ETH address!
                </> : records.length > 0 ? <>
                  You successfully updated {records.length} text records!
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
                success={waitForWriteTx.isSuccess}
                error={waitForWriteTx.isError}
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
