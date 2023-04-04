import styles from '../styles/Check.module.css'
import { Card, Heading } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import Fusebox from './fusebox'
import { ensConfig } from '../lib/constants'
import { normalize, parseName, hasExpiry, parseExpiry } from '../lib/utils'
import useCache from '../hooks/cache'
import { useState } from 'react'
import { useNetwork, useProvider } from 'wagmi'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'

export default function CheckWrapper({
  name
}) {
  const [nameData, setNameData] = useState(defaultNameData())
  const provider = useProvider()
  const { chain, chains } = useNetwork()

  const doUpdate = async ({name}) => {
    const nameData = defaultNameData();

    if (name) {
      const {
        isNameValid,
        normalizedName
      } = normalize(name)

      if (isNameValid && chains.some((c) => c.id === chain?.id)) {
        const {
          node,
          wrappedTokenId,
          parentName,
          parentNode
        } = parseName(normalizedName)

        const {
          wrappedTokenId: parentWrappedTokenId,
        } = parseName(parentName)

        // Get registry owner
        const registry = new ethers.Contract(ensConfig[chain?.id].Registry?.address, ensConfig[chain?.id].Registry?.abi, provider)
        const registryOwner = await registry.owner(node)
        nameData.registryOwner = registryOwner
        const parentRegistryOwner = await registry.owner(parentNode)
        nameData.parentRegistryOwner = parentRegistryOwner

        const nameWrapperAddress = ensConfig[chain?.id].NameWrapper?.address
        nameData.isWrapped = registryOwner === nameWrapperAddress
        nameData.isParentWrapped = parentRegistryOwner === nameWrapperAddress

        // Get wrapped data
        const nameWrapper = new ethers.Contract(nameWrapperAddress, ensConfig[chain?.id].NameWrapper?.abi, provider)
        const data = await nameWrapper.getData(wrappedTokenId)
        if (data && data.owner) {
          nameData.wrappedOwner = data.owner
          nameData.fuses = data.fuses
          nameData.expiry = data.expiry
        }
        const parentData = await nameWrapper.getData(parentWrappedTokenId)
        if (parentData && parentData.owner) {
          nameData.parentWrappedOwner = parentData.owner
          nameData.parentFuses = parentData.fuses
          nameData.parentExpiry = parentData.expiry
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

  const cache = useCache('check-wrapper-update', {name}, doUpdate, onUpdateSuccess, onUpdateError)

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

  const stateTagInfo = {}
  const parentStateTagInfo = {}
  let parentExpiry = ''
  const parentExpiryTagInfo = {}

  if (!showLoading && nameData.registryOwner && nameData.wrappedOwner) {
    parentExpiry = parseExpiry(nameData.parentExpiry)

    function setStateInfo(name, stateTagInfo, isParent, registryOwner, wrappedOwner, fuses, expiry) {
      const {
        normalizedName
      } = normalize(name)

      const {
        isETH2LD
      } = parseName(normalizedName)

      const expiryStr = parseExpiry(expiry)

      if (normalizedName === 'eth') {
        stateTagInfo.tag = 'Locked'
        stateTagInfo.tagColor = 'blueSecondary'
        stateTagInfo.tagTooltip = 'The "eth" node is Locked as a special case in the Name Wrapper.'
      } else if (normalizedName === '' && isParent) {
        stateTagInfo.tag = 'Locked'
        stateTagInfo.tagColor = 'blueSecondary'
        stateTagInfo.tagTooltip = 'The root node is Locked as a special case in the Name Wrapper.'
      } else if (wrappedOwner === ethers.constants.AddressZero) {
        const nameWrapperAddress = ensConfig[chain?.id].NameWrapper?.address
        if (registryOwner === ethers.constants.AddressZero || registryOwner === nameWrapperAddress) {
          if (registryOwner === nameWrapperAddress) {
            stateTagInfo.tag = 'Unregistered / Expired'
            stateTagInfo.tagColor = 'yellowSecondary'
            stateTagInfo.tagTooltip = 'This name was previously wrapped, but has since expired.'
            stateTagInfo.tagTooltipDialog = <p>
              The parent owner can create/replace this name.
              <br/><br/>
              If the parent name has a subname registrar active, then you may be able to re-register this name there.
            </p>
          } else {
            stateTagInfo.tag = 'Unregistered / Expired'
            stateTagInfo.tagColor = 'yellowSecondary'
            stateTagInfo.tagTooltip = 'This name has either never been wrapped, or has expired.'
            stateTagInfo.tagTooltipDialog = <p>
              The parent owner can create/replace this name.
              <br/><br/>
              If the parent name has a subname registrar active, then you may be able to register this name there.
            </p>
          }
        } else {
          stateTagInfo.tag = 'Unwrapped'
          stateTagInfo.tagColor = 'blueSecondary'
          stateTagInfo.tagTooltip = 'This name is not currently wrapped.'
        }
      } else if ((fuses & 1) === 1) {
        stateTagInfo.tag = 'Locked'
        stateTagInfo.tagColor = 'blueSecondary'
        stateTagInfo.tagTooltip = 'This name can no longer be unwrapped.'
        if (!isParent) {
          stateTagInfo.tagTooltipDialog = <p>
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
          </p>
        }
      } else if ((fuses & 65536) === 65536) {
        stateTagInfo.tag = 'Emancipated'
        stateTagInfo.tagColor = 'blueSecondary'
        stateTagInfo.tagTooltip = `This name can no longer be deleted/replaced by the owner of the parent name "${bestParentDisplayName}".`
        if (!isParent) {
          stateTagInfo.tagTooltipDialog = <p>
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
          </p>
        }
      } else {
        stateTagInfo.tag = 'Wrapped'
        stateTagInfo.tagColor = 'blueSecondary'
        stateTagInfo.tagTooltip = `This name can be deleted/replaced by the owner of the parent name "${bestParentDisplayName}".`
        if (!isParent) {
          stateTagInfo.tagTooltipDialog = <p>
            Be aware of the implications, especially if you are planning on purchasing this name.
            <br/><br/>
            This name is <b>not</b> Emancipated, so that parent owner can take back this name at any time.
            <br/><br/>
            In order to Emancipate this name, the parent owner must first "<a href="https://support.ens.domains/howto/namewrapper/change-permissions#changing-subname-permissions-as-the-parent-owner">give up parent control</a>".
            <br/><br/>
            More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/states#wrapped">Wrapped State</a>
          </p>
        }
      }
    }

    setStateInfo(normalizedName, stateTagInfo, false, nameData.registryOwner, nameData.wrappedOwner, nameData.fuses, nameData.expiry)
    setStateInfo(parentName, parentStateTagInfo, true, nameData.parentRegistryOwner, nameData.parentWrappedOwner, nameData.parentFuses, nameData.parentExpiry)

    if (hasExpiry(nameData.parentExpiry)) {
      const epochMs = nameData.parentExpiry * 1000
      const nowMs = new Date().getTime()
      const days90Ms = 90 * 24 * 60 * 60 * 1000

      if (nowMs >= epochMs) {
        parentExpiryTagInfo.tag = 'Expired'
        parentExpiryTagInfo.tagColor = 'redSecondary'
        parentExpiryTagInfo.tagTooltip = 'This parent name is expired.'
      } else if (nowMs + days90Ms >= epochMs) {
        parentExpiryTagInfo.tag = 'Expiring Soon'
        parentExpiryTagInfo.tagColor = 'yellowSecondary'
        parentExpiryTagInfo.tagTooltip = 'This parent name is expiring soon.'
        parentExpiryTagInfo.tagTooltipDialog = <p>
          It will expire on {parentExpiry}.
          <br/><br/>
          A name's expiry can only be set, at maximum, to the expiry of the parent name. If the parent name "{bestParentDisplayName}" expires, so will the name "{bestDisplayName}".
          <br/><br/>
          The parent name must be extended/renewed first, before the child name can be extended.
          <br/><br/>
          More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
        </p>
      }
      parentExpiryTagInfo.tag = 'Expiring Soon'
        parentExpiryTagInfo.tagColor = 'yellowSecondary'
        parentExpiryTagInfo.tagTooltip = 'This parent name is expiring soon.'
        parentExpiryTagInfo.tagTooltipDialog = <p>
          It will expire on {parentExpiry}.
          <br/><br/>
          A name's expiry can only be set, at maximum, to the expiry of the parent name. If the parent name "{bestParentDisplayName}" expires, so will the name "{bestDisplayName}".
          <br/><br/>
          The parent name must be extended/renewed first, before the child name can be extended.
          <br/><br/>
          More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
        </p>
    }
  }

  return (
    <div className={styles.containerMiddleCol}>
      <Card>
        <Heading>Name Wrapper</Heading>
        <table className={styles.itemTable}>
          <tbody>
            <RecordItemRow loading={showLoading} label="Name" value={isNameValid && bestDisplayName} {...stateTagInfo}/>
            <RecordItemRow loading={showLoading} label="Parent" value={bestParentDisplayName || (isNameValid ? '[root]' : '')} {...parentStateTagInfo}/>
            <RecordItemRow loading={showLoading} label="Parent" subLabel="Expiry" value={parentExpiry} {...parentExpiryTagInfo}/>
          </tbody>
        </table>
        <Fusebox loading={showLoading} name={bestDisplayName} fuses={nameData.fuses}/>
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
