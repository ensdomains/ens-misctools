import styles from '../styles/Check.module.css'
import { EthSVG, Heading } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import { ensConfig } from '../lib/constants'
import { normalize, parseName, shortAddr, parseExpiry } from '../lib/utils'
import useCache from '../hooks/cache'
import { useState } from 'react'
import { useNetwork, useProvider } from 'wagmi'
import { goerli } from '@wagmi/core/chains'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'

export default function CheckGeneral({
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
          labelhash,
          isETH2LD,
          eth2LDTokenId,
          wrappedTokenId
        } = parseName(normalizedName)

        // Get registry owner
        const registry = new ethers.Contract(ensConfig[chain?.id].Registry?.address, ensConfig[chain?.id].Registry?.abi, provider)
        const registryOwner = await registry.owner(node)
        nameData.manager = registryOwner
        
        nameData.resolver = await registry.resolver(node)
        nameData.ethAddress = await provider.resolveName(normalizedName) || ''

        if (isETH2LD) {
          // Get registrar owner
          const ethRegistrar = new ethers.Contract(ensConfig[chain?.id].ETHRegistrar?.address, ensConfig[chain?.id].ETHRegistrar?.abi, provider)
          try {
            nameData.owner = await ethRegistrar.ownerOf(eth2LDTokenId)
          } catch (e) {
            try {
              // TODO: Switch off hosted service
              const response = await fetch(`https://api.thegraph.com/subgraphs/name/ensdomains/ens${chain?.id === goerli.id ? 'goerli' : ''}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({query: `query {registration(id:"${labelhash}"){registrant{id}}}`})
              });
              const rsp = await response.json();
              nameData.owner = rsp.data?.registration?.registrant?.id || ethers.constants.AddressZero
            } catch (e2) {
              console.error(e2)
              nameData.owner = ethers.constants.AddressZero
            }
          }

          nameData.expiry = await ethRegistrar.nameExpires(eth2LDTokenId)
        }

        const nameWrapperAddress = ensConfig[chain?.id].NameWrapper?.address
        nameData.isWrapped = registryOwner === nameWrapperAddress

        if (nameData.isWrapped) {
          // Get wrapped data
          const nameWrapper = new ethers.Contract(nameWrapperAddress, ensConfig[chain?.id].NameWrapper?.abi, provider)
          const data = await nameWrapper.getData(wrappedTokenId)
          if (data && data.owner) {
            nameData.owner = data.owner
            nameData.manager = data.owner
            nameData.expiry = data.expiry
          }
        }

        nameData.latestPublicResolver = await provider.resolveName('resolver.eth')

        async function getPrimaryName(provider, address) {
          const primaryName = await provider.lookupAddress(address)
          return normalize(primaryName).bestDisplayName
        }

        if (nameData.owner && nameData.owner !== ethers.constants.AddressZero) {
          nameData.ownerPrimaryName = await getPrimaryName(provider, nameData.owner)
        }
        if (nameData.manager && nameData.manager !== ethers.constants.AddressZero) {
          nameData.managerPrimaryName = await getPrimaryName(provider, nameData.manager)
        }
        if (nameData.resolver && nameData.resolver !== ethers.constants.AddressZero) {
          nameData.resolverPrimaryName = await getPrimaryName(provider, nameData.resolver)

          // Test if resolver is wrapper aware
          // Best guess for now is if it supports the new approval methods
          try {
            const resolverContract = new ethers.Contract(nameData.resolver, ensConfig[chain?.id].LatestPublicResolver?.abi, provider)
            if (!(await resolverContract.isApprovedForAll(ethers.constants.AddressZero, ethers.constants.AddressZero))) {
              nameData.isResolverWrapperAware = true
            }
          } catch (e) {}
        }
        if (nameData.ethAddress && nameData.ethAddress !== ethers.constants.AddressZero) {
          nameData.ethAddressPrimaryName = await getPrimaryName(provider, nameData.ethAddress)
        }
      }
    }

    return { nameData }
  }

  const onUpdateSuccess = ({ nameData }) => {
    setNameData(nameData)
  }

  const onUpdateError = (error) => {
    toast.error('Error loading general information')
    console.error(error)
    setNameData(defaultNameData())
  }

  const cache = useCache('check-general-update', {name}, doUpdate, onUpdateSuccess, onUpdateError)

  let showLoading = cache.showLoading
  if (cache.data && cache.data.keyData.name !== name) {
    showLoading = true
  }

  const ownerTagInfo = {}
  const resolverTagInfo = {}
  const ethAddressTagInfo = {}
  let expiryStr = ''
  const expiryTagInfo = {}

  if (!showLoading) {
    const {
      normalizedName
    } = normalize(name)

    const {
      isETH2LD
    } = parseName(normalizedName)

    if (nameData.isWrapped) {
      ownerTagInfo.tag = 'Wrapped'
      ownerTagInfo.tagColor = 'blueSecondary'
      ownerTagInfo.tagTooltip = 'This name is wrapped in the ENS Name Wrapper contract.'
    }

    let noResolverSet = false
    if (nameData.resolver) {
      let lpResolver = nameData.latestPublicResolver
      const publicResolvers = ensConfig[chain?.id]?.publicResolvers || []
      if ((!lpResolver || lpResolver === ethers.constants.AddressZero) && publicResolvers.length > 0) {
        lpResolver = publicResolvers[0]
      }

      if (nameData.resolver === lpResolver) {
        resolverTagInfo.tag = 'Latest Public Resolver'
        resolverTagInfo.tagColor = 'blueSecondary'
        resolverTagInfo.tagTooltip = 'This name is using the latest version of the Public Resolver contract.'
      } else if (publicResolvers.length > 0 && publicResolvers.includes(nameData.resolver)) {
        resolverTagInfo.tag = 'Old Public Resolver'
        resolverTagInfo.tagColor = 'yellowSecondary'
        resolverTagInfo.tagTooltip = 'This name is using an older version of the Public Resolver contract.'
        resolverTagInfo.tagTooltipDialog = <p>
          {(nameData.isWrapped && !nameData.isResolverWrapperAware) ? (<>
            Your name is currently wrapped, but the resolver you're using is not "wrapper aware".
            This means that the resolver does not correctly recognize you as the owner.
            <br/><br/>
            You should upgrade to the latest Public Resolver contract.
          </>) : (<>
            This is typically not an issue, your name will continue to resolve to records just fine.
            {!nameData.isWrapped && !nameData.isResolverWrapperAware && (<>
              <br/><br/>
              However, if you wrap your name in the Name Wrapper, you will need to also migrate to the latest Public Resolver contract.
            </>)}
          </>)}
          <br/><br/>
          More information here: <a href="https://support.ens.domains/core/records/resolver">Resolver</a>
        </p>
      } else if (nameData.resolver === ethers.constants.AddressZero) {
        noResolverSet = true
        resolverTagInfo.tag = 'No Resolver Set'
        resolverTagInfo.tagColor = 'yellowSecondary'
        resolverTagInfo.tagTooltip = 'There is no resolver contract set on this name.'
        resolverTagInfo.tagTooltipDialog = <p>
          An ENS name will not resolve to any records (such as an ETH address) unless a <a href="https://support.ens.domains/core/records/resolver">Resolver</a> is first set on the name.
          <br/><br/>
          If you are trying to set the name as your <a href="https://support.ens.domains/core/records/primary-name">Primary Name</a> and it doesn't show up in the list, this is why.
          <br/><br/>
          First set the Resolver to the default Public Resolver. Then update the ETH address record to the address you want this ENS name to point to.
          <br/><br/>
          More information here: <a href="https://support.ens.domains/core/records/resolver">Resolver</a>
        </p>
      } else {
        resolverTagInfo.tag = 'Custom Resolver'
        resolverTagInfo.tagColor = 'blueSecondary'
        resolverTagInfo.tagTooltip = 'This name is using a custom resolver contract.'
        resolverTagInfo.tagTooltipDialog = <p>
          This may be expected if this name is being used in conjunction with a custom project.
          <br/><br/>
          However, if you do not recognize this contract, then you can choose to update it to the Latest Public Resolver, and then re-set any records.
          <br/><br/>
          More information here: <a href="https://support.ens.domains/core/records/resolver">Resolver</a>
        </p>
      }
    }

    if (nameData.manager && !nameData.ethAddress) {
      ethAddressTagInfo.tag = 'No ETH Address Set'
      ethAddressTagInfo.tagColor = 'yellowSecondary'
      ethAddressTagInfo.tagTooltip = 'This name does not currently point to any ETH address.'
      ethAddressTagInfo.tagTooltipDialog = <p>
        This means that nobody can send funds/tokens to this ENS name currently.
        <br/><br/>
        If you are trying to set the name as your <a href="https://support.ens.domains/core/records/primary-name">Primary Name</a> and it doesn't show up in the list, this is why.   
        <br/><br/>
        {noResolverSet ? 
          <>First set the Resolver to the default Public Resolver. Then update the ETH address record to the address you want this ENS name to point to.</> :
          <>Update the ETH address record to the address you want this ENS name to point to.</>
        }
        <br/><br/>
        More information here: <a href="https://support.ens.domains/howto/add-wallet-address">Add a Wallet Address</a>
      </p>
    }

    if (nameData.expiry && nameData.expiry > 0) {
      expiryStr = parseExpiry(nameData.expiry)
      
      const epochMs = nameData.expiry * 1000
      const nowMs = new Date().getTime()
      const days90Ms = 90 * 24 * 60 * 60 * 1000

      if (nowMs >= epochMs) {
        const graceEnd = nowMs + days90Ms

        expiryTagInfo.tag = 'Expired'
        expiryTagInfo.tagColor = 'redSecondary'
        expiryTagInfo.tagTooltip = 'This name is expired.'
        if (isETH2LD) {
          expiryTagInfo.tagTooltipDialog = <p>
            {nowMs >= graceEnd ? <>
              The grace period for this name ended on {parseExpiry(graceEnd / 1000)}.
              <br/><br/>
              You can re-register the name <a href={`https://app.ens.domains/name/${name}/register`}>here</a>.
            </> : <>
              The grace period for this name ends on {parseExpiry(graceEnd / 1000)}.
              <br/><br/>
              If it is not renewed, then you will lose ownership of the name.
            </>}
            <br/><br/>
            More information here: <a href="https://support.ens.domains/core/registration/renewals">Renewals</a>
          </p>
        } else {
          expiryTagInfo.tagTooltipDialog = <p>
            It expired on {expiryStr}.
            <br/><br/>
            The parent owner can now recreate/replace this name.
            <br/><br/>
            If the parent name has a subname registrar active, then you may be able to re-register this name there.
          </p>
        }
      } else if (nowMs + days90Ms >= epochMs) {
        expiryTagInfo.tag = 'Expiring Soon'
        expiryTagInfo.tagColor = 'yellowSecondary'
        expiryTagInfo.tagTooltip = 'This name is expiring soon.'
        if (isETH2LD) {
          expiryTagInfo.tagTooltipDialog = <p>
            It will expire on {expiryStr}.
            <br/><br/>
            If it is not renewed, then you will lose ownership of the name.
            <br/><br/>
            More information here: <a href="https://support.ens.domains/core/registration/renewals">Renewals</a>
          </p>
        }
      }
    }
  }

  return (
    <>
      <Heading>General Info</Heading>
      <table className={styles.itemTable}>
        <tbody>
          {nameData.owner ? <RecordItemRow loading={showLoading} label="Owner" value={nameData.owner} secondaryValue={nameData.ownerPrimaryName} shortValue={shortAddr(nameData.owner)} tooltipValue={nameData.owner} {...ownerTagInfo}/> : <></>}
          <RecordItemRow loading={showLoading} label="Manager" value={nameData.manager} secondaryValue={nameData.managerPrimaryName} shortValue={shortAddr(nameData.manager)} tooltipValue={nameData.manager}/>
          {expiryStr ? <RecordItemRow loading={showLoading} label="Expiry" value={expiryStr} {...expiryTagInfo}/> : <></>}
          <RecordItemRow loading={showLoading} label="Resolver" value={nameData.resolver} secondaryValue={nameData.resolverPrimaryName} shortValue={shortAddr(nameData.resolver)} tooltipValue={nameData.resolver} {...resolverTagInfo}/>
          <RecordItemRow loading={showLoading} label="ETH" icon={<EthSVG/>} value={nameData.ethAddress} secondaryValue={nameData.ethAddressPrimaryName} shortValue={shortAddr(nameData.ethAddress)} tooltipValue={nameData.ethAddress} {...ethAddressTagInfo}/>
        </tbody>
      </table>
    </>
  )
}

function defaultNameData() {
  return {
    owner: '',
    manager: '',
    resolver: '',
    ethAddress: '',
    expiry: 0,
    ownerPrimaryName: '',
    managerPrimaryName: '',
    resolverPrimaryName: '',
    ethAddressPrimaryName: '',
    isWrapped: false,
    latestPublicResolver: '',
    isResolverWrapperAware: ''
  }
}
