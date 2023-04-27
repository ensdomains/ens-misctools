import styles from '../styles/Check.module.css'
import { Card, Heading, Typography } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import Fusebox from './fusebox'
import { ensConfig } from '../lib/constants'
import { validChain, normalize, parseName, hasExpiry, parseExpiry, getAddress } from '../lib/utils'
import useCache from '../hooks/cache'
import { useChain } from '../hooks/misc'
import { useState } from 'react'
import { useProvider } from 'wagmi'
import { ethers } from 'ethers'
import { MulticallWrapper } from 'ethers-multicall-provider'
import toast from 'react-hot-toast'

export default function CheckWrapper({
  name
}) {
  const [nameData, setNameData] = useState(defaultNameData())
  const provider = useProvider()
  const { chain, chains, hasProvider, isChainSupported } = useChain(provider)

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
          const multi = MulticallWrapper.wrap(provider)
          const batch = []

          // Get registry owners
          const registry = new ethers.Contract(ensConfig[chain].Registry?.address, ensConfig[chain].Registry?.abi, multi)
          batch.push(registry.owner(node))
          batch.push(registry.owner(parentNode))

          const nameWrapperAddress = ensConfig[chain].NameWrapper?.address

          // Get wrapped data
          const nameWrapper = new ethers.Contract(nameWrapperAddress, ensConfig[chain].NameWrapper?.abi, multi)
          batch.push(nameWrapper.getData(wrappedTokenId))
          batch.push(nameWrapper.getData(parentWrappedTokenId))

          const results = await Promise.all(batch)

          // Get registry owners
          const registryOwner = results[0]
          nameData.registryOwner = getAddress(registryOwner)
          const parentRegistryOwner = results[1]
          nameData.parentRegistryOwner = getAddress(parentRegistryOwner)

          nameData.isWrapped = registryOwner === nameWrapperAddress
          nameData.isParentWrapped = parentRegistryOwner === nameWrapperAddress

          // Get wrapped data
          const data = results[2]
          if (data && data.owner) {
            nameData.wrappedOwner = getAddress(data.owner)
            nameData.fuses = data.fuses
            nameData.expiry = data.expiry
          }
          const parentData = results[3]
          if (parentData && parentData.owner) {
            nameData.parentWrappedOwner = getAddress(parentData.owner)
            nameData.parentFuses = parentData.fuses
            nameData.parentExpiry = parentData.expiry
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
      } else if (wrappedOwner === ethers.constants.AddressZero) {
        const nameWrapperAddress = ensConfig[chain].NameWrapper?.address
        if (registryOwner === ethers.constants.AddressZero || registryOwner === nameWrapperAddress) {
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
      } else if ((fuses & 1) === 1) {
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
      } else if ((fuses & 65536) === 65536) {
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
      const epochMs = nameData.parentExpiry * 1000
      const nowMs = new Date().getTime()
      const days90Ms = 90 * 24 * 60 * 60 * 1000

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
        {!hasProvider ? (
          !isChainSupported ? (
            <Typography>No web3 provider connected.</Typography>
          ) : (
            <Typography>Switch to a supported network.</Typography>
          )
        ) : (<>
          <table className={styles.itemTable}>
            <tbody>
              <RecordItemRow loading={showLoading} label="Name" value={isNameValid && bestDisplayName} tags={stateTags}/>
              <RecordItemRow loading={showLoading} label="Parent" value={bestParentDisplayName || (isNameValid ? '[root]' : '')} tags={parentStateTags}/>
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
    fuses: 0,
    expiry: 0,
    parentRegistryOwner: '',
    parentWrappedOwner: '',
    isParentWrapped: false,
    parentFuses: 0,
    parentExpiry: 0
  }
}
