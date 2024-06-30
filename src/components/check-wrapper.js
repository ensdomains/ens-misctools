import styles from '../styles/Check.module.css'
import { Card, Heading, Typography } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import Fusebox from './fusebox'
import { ensConfig, AddressZero } from '../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  readContract,
  getAddress,
  getMulticallResult,
  hasExpiry,
  parseExpiry
} from '../lib/utils'
import useCache from '../hooks/cache'
import { useChain } from '../hooks/misc'
import { useState } from 'react'
import { usePublicClient } from 'wagmi'
import { getContract } from 'viem'
import toast from 'react-hot-toast'

export default function CheckWrapper({
  name,
  updateNameInput
}) {
  const [nameData, setNameData] = useState(defaultNameData())
  const client = usePublicClient()
  const { chain, chains, hasClient, isChainSupported } = useChain(client)

  const doUpdate = async ({name, chain}) => {
    const nameData = defaultNameData();

    if (name) {
      const {
        isNameValid,
        normalizedName
      } = normalize(name)

      if (isNameValid && validChain(chain, chains)) {
        const {
          node,
          wrappedTokenId,
          parentName,
          parentNode
        } = parseName(normalizedName)

        const {
          wrappedTokenId: parentWrappedTokenId,
        } = parseName(parentName)

        try {
          const batch = []

          // Get registry owners
          const registry = getContract({address: ensConfig[chain].Registry?.address, abi: ensConfig[chain].Registry?.abi, client})
          batch.push(readContract(client, registry, 'owner', node))
          batch.push(readContract(client, registry, 'owner', parentNode))

          const nameWrapperAddress = ensConfig[chain].NameWrapper?.address

          // Get wrapped data
          const nameWrapper = getContract({address: nameWrapperAddress, abi: ensConfig[chain].NameWrapper?.abi, client})
          batch.push(readContract(client, nameWrapper, 'getData', wrappedTokenId))
          batch.push(readContract(client, nameWrapper, 'getData', parentWrappedTokenId))

          const results = await Promise.all(batch)

          // Get registry owners
          const registryOwner = getMulticallResult(results[0], true)
          nameData.registryOwner = getAddress(registryOwner)
          const parentRegistryOwner = getMulticallResult(results[1], true)
          nameData.parentRegistryOwner = getAddress(parentRegistryOwner)

          nameData.isWrapped = registryOwner === nameWrapperAddress
          nameData.isParentWrapped = parentRegistryOwner === nameWrapperAddress

          // Get wrapped data
          const data = getMulticallResult(results[2], true)
          if (data && data[0]) {
            nameData.wrappedOwner = getAddress(data[0])
            nameData.fuses = BigInt(data[1])
            nameData.expiry = BigInt(data[2])
          }
          const parentData = getMulticallResult(results[3], true)
          if (parentData && parentData[0]) {
            nameData.parentWrappedOwner = getAddress(parentData[0])
            nameData.parentFuses = BigInt(parentData[1])
            nameData.parentExpiry = BigInt(parentData[2])
          }
        } catch (e) {
          console.error(e)
        }
      }
    }

    return { nameData }
  }

  const onUpdateSuccess = ({ nameData }) => {
    setNameData(nameData)
  }

  const onUpdateError = (error) => {
    toast.error('Error loading wrapper information')
    console.error(error)
    setNameData(defaultNameData())
  }

  const cache = useCache('check-wrapper-update', {name, chain}, doUpdate, onUpdateSuccess, onUpdateError)

  let showLoading = cache.showLoading
  if (cache.data && cache.data.keyData.name !== name) {
    showLoading = true
  }

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  const {
    parentName
  } = parseName(normalizedName)

  const {
    bestDisplayName: bestParentDisplayName
  } = normalize(parentName)

  const stateTags = []
  const parentStateTags = []
  let parentExpiry = ''
  const parentExpiryTags = []

  if (!showLoading && validChain(chain, chains) && nameData.registryOwner && nameData.wrappedOwner) {
    parentExpiry = parseExpiry(nameData.parentExpiry)

    function setStateInfo(name, stateTags, isParent, registryOwner, wrappedOwner, fuses, expiry) {
      const {
        normalizedName
      } = normalize(name)

      const {
        isETH2LD,
        parentName
      } = parseName(normalizedName)

      const {
        bestDisplayName: bestParentDisplayName
      } = normalize(parentName)

      const expiryStr = parseExpiry(expiry)

      if (normalizedName === 'eth') {
        stateTags.push({
          value: 'Locked',
          color: 'blueSecondary',
          tooltip: 'The "eth" node is Locked as a special case in the Name Wrapper.'
        })
      } else if (normalizedName === '' && isParent) {
        stateTags.push({
          value: 'Locked',
          color: 'blueSecondary',
          tooltip: 'The root node is Locked as a special case in the Name Wrapper.'
        })
      } else if (wrappedOwner === AddressZero) {
        const nameWrapperAddress = ensConfig[chain].NameWrapper?.address
        if (registryOwner === AddressZero || registryOwner === nameWrapperAddress) {
          if (registryOwner === nameWrapperAddress) {
            stateTags.push({
              value: 'Unregistered / Expired',
              color: 'yellowSecondary',
              tooltip: 'This name was previously wrapped, but has since expired.',
              tooltipDialog: <>
                The parent owner can create/replace this name.
                <br/><br/>
                If the parent name has a subname registrar active, then you may be able to re-register this name there.
              </>
            })
          } else {
            stateTags.push({
              value: 'Unregistered / Expired',
              color: 'yellowSecondary',
              tooltip: 'This name has either never been wrapped, or has expired.',
              tooltipDialog: <>
                The parent owner can create/replace this name.
                <br/><br/>
                If the parent name has a subname registrar active, then you may be able to register this name there.
              </>
            })
          }
        } else {
          stateTags.push({
            value: 'Unwrapped',
            color: 'blueSecondary',
            tooltip: 'This name is not currently wrapped.'
          })
        }
      } else if ((fuses & 1n) === 1n) {
        stateTags.push({
          value: 'Locked',
          color: 'blueSecondary',
          tooltip: 'This name can no longer be unwrapped.',
          tooltipDialog: !isParent ? <>
            The parent owner also cannot delete/replace this name, or burn any additional fuses.
            <br/><br/>
            This will be true until the expiry on <b>{expiryStr}</b>.
            <br/><br/>
            {isETH2LD ? <>
              If it is not renewed, then you will lose ownership of the name.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/core/registration/renewals">Renewals</a>
            </> : <>
              When the expiry is reached, you will <b>lose ownership</b> of this name, and the parent owner will be able to replace it.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
            </>}
          </> : ''
        })
      } else if ((fuses & 65536n) === 65536n) {
        stateTags.push({
          value: 'Emancipated',
          color: 'blueSecondary',
          tooltip: <>This name can no longer be deleted/replaced by the owner of the parent name &quot;<Typography>{bestParentDisplayName}</Typography>&quot;.</>,
          tooltipDialog: !isParent ? <>
            The parent owner also cannot burn any additional fuses on this name.
            <br/><br/>
            This will be true until the expiry on <b>{expiryStr}</b>.
            <br/><br/>
            {isETH2LD ? <>
              If it is not renewed, then you will lose ownership of the name.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/core/registration/renewals">Renewals</a>
            </> : <>
              When the expiry is reached, you will <b>lose ownership</b> of this name, and the parent owner will be able to replace it.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
            </>}
          </> : ''
        })
      } else {
        stateTags.push({
          value: 'Wrapped',
          color: 'blueSecondary',
          tooltip: <>This name can be deleted/replaced by the owner of the parent name &quot;<Typography>{bestParentDisplayName}</Typography>&quot;.</>,
          tooltipDialog: !isParent ? <>
            Be aware of the implications, especially if you are planning on purchasing this name.
            <br/><br/>
            This name is <b>not</b> Emancipated, so that parent owner can take back this name at any time.
            <br/><br/>
            In order to Emancipate this name, the parent owner must first &quot;<a href="https://support.ens.domains/howto/namewrapper/change-permissions#changing-subname-permissions-as-the-parent-owner">give up parent control</a>&quot;.
            <br/><br/>
            More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/states#wrapped">Wrapped State</a>
          </> : ''
        })
      }
    }

    setStateInfo(normalizedName, stateTags, false, nameData.registryOwner, nameData.wrappedOwner, nameData.fuses, nameData.expiry)
    setStateInfo(parentName, parentStateTags, true, nameData.parentRegistryOwner, nameData.parentWrappedOwner, nameData.parentFuses, nameData.parentExpiry)

    if (hasExpiry(nameData.parentExpiry)) {
      const epochMs = nameData.parentExpiry * 1000n
      const nowMs = BigInt(new Date().getTime())
      const days90Ms = 90n * 24n * 60n * 60n * 1000n

      if (nowMs >= epochMs) {
        parentExpiryTags.push({
          value: 'Expired',
          color: 'redSecondary',
          tooltip: 'This parent name is expired.'
        })
      } else if (nowMs + days90Ms >= epochMs) {
        parentExpiryTags.push({
          value: 'Expiring Soon',
          color: 'yellowSecondary',
          tooltip: 'This parent name is expiring soon.',
          tooltipDialog: <>
            It will expire on {parentExpiry}.
            <br/><br/>
            A name&apos;s expiry can only be set, at maximum, to the expiry of the parent name. If the parent name &quot;<Typography>{bestParentDisplayName}</Typography>&quot; expires, so will the name &quot;<Typography>{bestDisplayName}</Typography>&quot;.
            <br/><br/>
            The parent name must be extended/renewed first, before the child name can be extended.
            <br/><br/>
            More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
          </>
        })
      }
    }
  }

  return (
    <div className={styles.containerMiddleCol}>
      <Card>
        <Heading>Name Wrapper</Heading>
        {!hasClient ? (
          !isChainSupported ? (
            <Typography>No web3 provider connected.</Typography>
          ) : (
            <Typography>Switch to a supported network.</Typography>
          )
        ) : (<>
          <table className={styles.itemTable}>
            <tbody>
              <RecordItemRow loading={showLoading} label="Name" value={isNameValid && bestDisplayName} tags={stateTags}/>
              <RecordItemRow loading={showLoading} label="Parent" value={bestParentDisplayName || (isNameValid ? '[root]' : '')} link={bestParentDisplayName} updateNameInput={updateNameInput} tags={parentStateTags}/>
              <RecordItemRow loading={showLoading} label="Parent" subLabel="Expiry" value={parentExpiry} tags={parentExpiryTags}/>
            </tbody>
          </table>
          <Fusebox loading={showLoading} name={bestDisplayName} fuses={nameData.fuses}/>
        </>)}
      </Card>
    </div>
  )
}

function defaultNameData() {
  return {
    registryOwner: '',
    wrappedOwner: '',
    isWrapped: false,
    fuses: 0n,
    expiry: 0n,
    parentRegistryOwner: '',
    parentWrappedOwner: '',
    isParentWrapped: false,
    parentFuses: 0n,
    parentExpiry: 0n
  }
}
