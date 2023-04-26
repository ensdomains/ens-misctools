import styles from '../styles/Check.module.css'
import { EthSVG, Heading, Typography, RecordItem, Skeleton } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import { ensConfig } from '../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  universalResolveAddr,
  universalResolveAvatar,
  universalResolvePrimaryName,
  getUniversalResolverPrimaryName,
  convertToAddress,
  getAddress,
  abbreviatedValue,
  parseExpiry,
  copyToClipBoard
} from '../lib/utils'
import useCache from '../hooks/cache'
import { useChain } from '../hooks/misc'
import { useState } from 'react'
import { useProvider } from 'wagmi'
import { mainnet, goerli } from '@wagmi/core/chains'
import { ethers } from 'ethers'
import { MulticallWrapper } from 'ethers-multicall-provider'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Image from 'next/future/image'
import ProgressiveImage from "react-progressive-graceful-image"

export default function CheckGeneral({
  name
}) {
  const [nameData, setNameData] = useState(defaultNameData())
  const provider = useProvider()
  const { chain, chains, hasProvider, isChainSupported } = useChain(provider)
  const [imageLoadingErrors, setImageLoadingErrors] = useState({})

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
          labelhash,
          isETH2LD,
          eth2LDTokenId,
          wrappedTokenId
        } = parseName(normalizedName)

        try {
          const multi = MulticallWrapper.wrap(provider)
          const batch1 = []

          // Get registry owner
          const registry = new ethers.Contract(ensConfig[chain].Registry?.address, ensConfig[chain].Registry?.abi, multi)
          batch1.push(registry.owner(node))
          batch1.push(registry.resolver(node))

          const universalResolver = new ethers.Contract(ensConfig[chain].UniversalResolver?.address, ensConfig[chain].UniversalResolver?.abi, multi)
          batch1.push(universalResolveAddr(universalResolver, normalizedName, node))
          batch1.push(universalResolveAvatar(universalResolver, normalizedName, node))

          if (isETH2LD) {
            // Get registrar owner
            const ethRegistrar = new ethers.Contract(ensConfig[chain].ETHRegistrar?.address, ensConfig[chain].ETHRegistrar?.abi, multi)
            batch1.push(ethRegistrar.ownerOf(eth2LDTokenId).catch(e => e))
            batch1.push(ethRegistrar.nameExpires(eth2LDTokenId))
          }

          const nameWrapperAddress = ensConfig[chain].NameWrapper?.address
          const nameWrapper = new ethers.Contract(nameWrapperAddress, ensConfig[chain].NameWrapper?.abi, multi)
          batch1.push(nameWrapper.getData(wrappedTokenId))

          batch1.push(universalResolveAddr(universalResolver, 'resolver.eth'))

          const results1 = await Promise.all(batch1)
          let results1Index = 0

          // Get registry owner
          const registryOwner = results1[results1Index]
          if (registryOwner && registryOwner !== ethers.constants.AddressZero) {
            nameData.manager = getAddress(registryOwner)
          }
          results1Index++

          // Get registry resolver
          const registryResolver = results1[results1Index]
          if (registryResolver && registryResolver !== ethers.constants.AddressZero) {
            nameData.registryResolver = getAddress(registryResolver)
          }
          results1Index++

          // Get resolver and ETH address (possibly via wildcard or offchain)
          if (results1[results1Index] && !(results1[results1Index] instanceof Error) && results1[results1Index].length > 1) {
            nameData.ethAddress = convertToAddress(results1[results1Index][0])
            nameData.resolver = getAddress(results1[results1Index][1])
          }
          results1Index++

          // Get avatar (possibly via wildcard or offchain)
          if (results1[results1Index] && !(results1[results1Index] instanceof Error) && results1[results1Index].length > 0) {
            try {
              nameData.avatar = ethers.utils.defaultAbiCoder.decode(['string'], results1[results1Index][0])[0]
              nameData.avatarUrl = `https://metadata.ens.domains/${chain === goerli.id ? 'goerli' : 'mainnet'}/avatar/${normalizedName}`
            } catch (e) {}
          }
          results1Index++

          if (isETH2LD) {
            // Get registrar owner
            if (!(results1[results1Index] instanceof Error)) {
              nameData.owner = getAddress(results1[results1Index])
            } else {
              try {
                // TODO: Switch off hosted service
                const response = await fetch(`https://api.thegraph.com/subgraphs/name/ensdomains/ens${chain === goerli.id ? 'goerli' : ''}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({query: `query {registration(id:"${labelhash}"){registrant{id}}}`})
                });
                const rsp = await response.json();
                nameData.owner = getAddress(rsp.data?.registration?.registrant?.id || '')
              } catch (e) {
                console.error(e)
              }
            }
            results1Index++

            nameData.expiry = results1[results1Index]
            results1Index++
          }

          nameData.isWrapped = registryOwner === nameWrapperAddress

          if (nameData.isWrapped) {
            // Get wrapped data
            const data = results1[results1Index]
            if (data && data.owner) {
              nameData.owner = getAddress(data.owner)
              nameData.manager = getAddress(data.owner)
              nameData.expiry = data.expiry
            }
          }
          results1Index++

          if (results1[results1Index] && !(results1[results1Index] instanceof Error) && results1[results1Index].length > 1) {
            nameData.latestPublicResolver = convertToAddress(results1[results1Index][0])
          }

          const batch2 = []

          if (nameData.owner && nameData.owner !== ethers.constants.AddressZero) {
            batch2.push(universalResolvePrimaryName(universalResolver, nameData.owner))
          }
          if (nameData.manager && nameData.manager !== ethers.constants.AddressZero) {
            batch2.push(universalResolvePrimaryName(universalResolver, nameData.manager))
          }
          if (nameData.resolver && nameData.resolver !== ethers.constants.AddressZero) {
            batch2.push(universalResolvePrimaryName(universalResolver, nameData.resolver))

            // Test if resolver is wrapper aware
            // Best guess for now is if it supports the new approval methods
            const resolverContract = new ethers.Contract(nameData.resolver, ensConfig[chain].LatestPublicResolver?.abi, multi)
            batch2.push(resolverContract.isApprovedForAll(ethers.constants.AddressZero, ethers.constants.AddressZero).catch(e => e))
          }
          if (nameData.ethAddress && nameData.ethAddress !== ethers.constants.AddressZero) {
            batch2.push(universalResolvePrimaryName(universalResolver, nameData.ethAddress))
          }

          const results2 = await Promise.all(batch2)
          let results2Index = 0
          
          if (nameData.owner && nameData.owner !== ethers.constants.AddressZero) {
            nameData.ownerPrimaryName = getUniversalResolverPrimaryName(nameData.owner, results2[results2Index])
            results2Index++
          }
          if (nameData.manager && nameData.manager !== ethers.constants.AddressZero) {
            nameData.managerPrimaryName = getUniversalResolverPrimaryName(nameData.manager, results2[results2Index])
            results2Index++
          }
          if (nameData.resolver && nameData.resolver !== ethers.constants.AddressZero) {
            nameData.resolverPrimaryName = getUniversalResolverPrimaryName(nameData.resolver, results2[results2Index])
            results2Index++
            if (!(results1[results2Index] instanceof Error) && !results2[results2Index]) {
              nameData.isResolverWrapperAware = true
            }
            results2Index++
          }
          if (nameData.ethAddress && nameData.ethAddress !== ethers.constants.AddressZero) {
            nameData.ethAddressPrimaryName = getUniversalResolverPrimaryName(nameData.ethAddress, results2[results2Index])
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
    toast.error('Error loading general information')
    console.error(error)
    setNameData(defaultNameData())
  }

  const cache = useCache('check-general-update', {name, chain}, doUpdate, onUpdateSuccess, onUpdateError)

  let showLoading = cache.showLoading
  if (cache.data && cache.data.keyData.name !== name) {
    showLoading = true
  }

  const ownerTags = []
  const managerTags = []
  const resolverTags = []
  const ethAddressTags = []
  let expiryStr = ''
  const expiryTags = []

  let namehashHex = ''
  let namehashDec = ''
  let labelhashHex = ''
  let labelhashDec = ''

  const links = {
    ens: '',
    ensvision: '',
    etherscan: '',
    opensea: '',
    looksrare: '',
    x2y2: '',
    rarible: '',
    kodex: ''
  }

  let nftMetadataLink = ''
  let nftMetadataImage = ''

  if (!showLoading && validChain(chain, chains)) {
    const {
      isNameValid,
      normalizedName,
      bestDisplayName
    } = normalize(name)

    if (isNameValid) {
      const {
        node,
        nodeDecimal,
        labelhash,
        labelhashDecimal,
        isETH2LD,
        eth2LDTokenId,
        wrappedTokenId
      } = parseName(normalizedName)

      namehashHex = node
      namehashDec = nodeDecimal
      labelhashHex = labelhash
      labelhashDec = labelhashDecimal

      links.ens = `https://app.ens.domains/${bestDisplayName}`
      if (isETH2LD || nameData.isWrapped) {
        const contractAddr = nameData.isWrapped ? ensConfig[chain].NameWrapper.address : ensConfig[chain].ETHRegistrar.address
        const tokenId = nameData.isWrapped ? wrappedTokenId : eth2LDTokenId

        if (chain === mainnet.id) {  
          if (isETH2LD) {
            links.ensvision = `https://ens.vision/name/${normalizedName}`
            links.kodex = `https://kodex.io/domain/${normalizedName}`
          }
          if (nameData.manager) {
            links.etherscan = `https://etherscan.io/nft/${contractAddr}/${tokenId}`
            links.opensea = `https://opensea.io/assets/ethereum/${contractAddr}/${tokenId}`
            links.looksrare = `https://looksrare.org/collections/${contractAddr}/${tokenId}`
            links.x2y2 = `https://x2y2.io/eth/${contractAddr}/${tokenId}`
            links.rarible = `https://rarible.com/token/${contractAddr}:${tokenId}`

            nftMetadataLink = `https://metadata.ens.domains/mainnet/${contractAddr}/${tokenId}`
            nftMetadataImage = `https://metadata.ens.domains/mainnet/${contractAddr}/${tokenId}/image`
          }
        } else if (chain === goerli.id) {
          if (nameData.manager) {
            links.etherscan = `https://goerli.etherscan.io/nft/${contractAddr}/${tokenId}`
            links.opensea = `https://testnets.opensea.io/assets/goerli/${contractAddr}/${tokenId}`

            nftMetadataLink = `https://metadata.ens.domains/goerli/${contractAddr}/${tokenId}`
            nftMetadataImage = `https://metadata.ens.domains/goerli/${contractAddr}/${tokenId}/image`
          }
        }
      }

      if (nameData.isWrapped) {
        ownerTags.push({
          value: 'Wrapped',
          color: 'blueSecondary',
          tooltip: 'This name is wrapped in the ENS Name Wrapper contract.'
        })
      }

      let noResolverSet = false
      if (nameData.resolver) {
        let lpResolver = nameData.latestPublicResolver
        const publicResolvers = ensConfig[chain]?.publicResolvers || []
        if ((!lpResolver || lpResolver === ethers.constants.AddressZero) && publicResolvers.length > 0) {
          lpResolver = publicResolvers[0]
        }

        if (nameData.resolver === lpResolver) {
          resolverTags.push({
            value: 'Latest Public Resolver',
            color: 'blueSecondary',
            tooltip: 'This name is using the latest version of the Public Resolver contract.'
          })
        } else if (publicResolvers.length > 0 && publicResolvers.includes(nameData.resolver)) {
          resolverTags.push({
            value: 'Old Public Resolver',
            color: 'yellowSecondary',
            tooltip: 'This name is using an older version of the Public Resolver contract.',
            tooltipDialog: <>
              {(nameData.isWrapped && !nameData.isResolverWrapperAware) ? (<>
                Your name is currently wrapped, but the resolver you&apos;re using is not &quot;wrapper aware&quot;.
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
            </>
          })
        } else if (nameData.resolver === ethers.constants.AddressZero) {
          noResolverSet = true
          resolverTags.push({
            value: 'No Resolver Set',
            color: 'yellowSecondary',
            tooltip: 'There is no resolver contract set on this name.',
            tooltipDialog: <>
              An ENS name will not resolve to any records (such as an ETH address) unless a <a href="https://support.ens.domains/core/records/resolver">Resolver</a> is first set on the name.
              <br/><br/>
              If you are trying to set the name as your <a href="https://support.ens.domains/core/records/primary-name">Primary Name</a> and it doesn&apos;t show up in the list, this is why.
              <br/><br/>
              First set the Resolver to the default Public Resolver. Then update the ETH address record to the address you want this ENS name to point to.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/core/records/resolver">Resolver</a>
            </>
          })
        } else {
          resolverTags.push({
            value: 'Custom Resolver',
            color: 'blueSecondary',
            tooltip: 'This name is using a custom resolver contract.',
            tooltipDialog: <>
              This may be expected if this name is being used in conjunction with a custom project.
              <br/><br/>
              However, if you do not recognize this contract, then you can choose to update it to the Latest Public Resolver, and then re-set any records.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/core/records/resolver">Resolver</a>
            </>
          })
        }

        if (!nameData.registryResolver) {
          resolverTags.push({
            value: 'Using Wildcard',
            color: 'blueSecondary',
            tooltip: 'This name is using a parent wildcard resolver.',
            tooltipDialog: <>
              This name has no resolver set directly in the ENS registry. However, a parent/ancestor resolver was found that supports ENSIP-10 &quot;Wildcard Resolution&quot;.
              <br/><br/>
              More information here: <a href="https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution">Wildcard Resolution</a>
            </>
          })
        }

        if (!nameData.manager) {
          managerTags.push({
            value: 'Offchain Name',
            color: 'blueSecondary',
            tooltip: 'This name does not exist on-chain.',
            tooltipDialog: <>
              This name has no owner set directly in the ENS registry. However, its resolver supports EIP-3668 &quot;CCIP-read&quot;, meaning that records can be resolved via an off-chain gateway.
              {(!nameData.ethAddress || nameData.ethAddress === ethers.constants.AddressZero) && (
                <>
                  <br/><br/>
                  No ETH address (or the null address) was resolved for this name, however. So this name may not exist in the off-chain gateway, either.
                </>
              )}          
              <br/><br/>
              More information here: <a href="https://eips.ethereum.org/EIPS/eip-3668">CCIP Read: Secure offchain data retrieval</a>
            </>
          })
        }
      }

      if (nameData.manager && (!nameData.ethAddress || nameData.ethAddress === ethers.constants.AddressZero)) {
        ethAddressTags.push({
          value: 'No ETH Address Set',
          color: 'yellowSecondary',
          tooltip: 'This name does not currently point to any ETH address.',
          tooltipDialog: <>
            This means that nobody can send funds/tokens to this ENS name currently.
            <br/><br/>
            If you are trying to set the name as your <a href="https://support.ens.domains/core/records/primary-name">Primary Name</a> and it doesn&apos;t show up in the list, this is why.   
            <br/><br/>
            {noResolverSet ? 
              <>First set the Resolver to the default Public Resolver. Then update the ETH address record to the address you want this ENS name to point to.</> :
              <>Update the ETH address record to the address you want this ENS name to point to.</>
            }
            <br/><br/>
            More information here: <a href="https://support.ens.domains/howto/add-wallet-address">Add a Wallet Address</a>
          </>
        })
      }

      if (nameData.expiry && nameData.expiry > 0) {
        expiryStr = parseExpiry(nameData.expiry)
        
        const epochMs = nameData.expiry * 1000
        const nowMs = new Date().getTime()
        const days90Ms = 90 * 24 * 60 * 60 * 1000

        if (nowMs >= epochMs) {
          const graceEnd = epochMs + days90Ms

          expiryTags.push({
            value: 'Expired',
            color: 'redSecondary',
            tooltip: 'This name is expired.',
            tooltipDialog: isETH2LD ? <>
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
            </> : <>
              It expired on {expiryStr}.
              <br/><br/>
              The parent owner can now recreate/replace this name.
              <br/><br/>
              If the parent name has a subname registrar active, then you may be able to re-register this name there.
            </>
          })
        } else if (nowMs + days90Ms >= epochMs) {
          expiryTags.push({
            value: 'Expiring Soon',
            color: 'yellowSecondary',
            tooltip: 'This name is expiring soon.',
            tooltipDialog: isETH2LD ? <>
              It will expire on {expiryStr}.
              <br/><br/>
              If it is not renewed, then you will lose ownership of the name.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/core/registration/renewals">Renewals</a>
            </> : ''
          })
        }
      }
    }
  }

  return (
    <>
      <Heading>
        <span style={{marginRight:'1rem'}}>General Info</span>
        <NFTLink link={links.ens} image="/ens.png" alt="ENS Manager App"/>
        <NFTLink link={links.ensvision} image="/ensvision.png" alt="ENS.Vision"/>
        <NFTLink link={links.etherscan} image="/etherscan.png" alt="Etherscan"/>
        <NFTLink link={links.kodex} image="/kodex.png" alt="Kodex"/>
        <NFTLink link={links.looksrare} image="/looksrare.svg" alt="LooksRare"/>
        <NFTLink link={links.x2y2} image="/x2y2.svg" alt="X2Y2"/>
        <NFTLink link={links.opensea} image="/opensea.svg" alt="OpenSea"/>
        <NFTLink link={links.rarible} image="/rarible.png" alt="Rarible"/>
      </Heading>
      {!hasProvider ? (
        !isChainSupported ? (
          <Typography>No web3 provider connected.</Typography>
        ) : (
          <Typography>Switch to a supported network.</Typography>
        )
      ) : (
        <table className={styles.itemTable}>
          <tbody>
            {nameData.owner ? <RecordItemRow loading={showLoading} label="Owner" value={nameData.owner} secondaryValue={nameData.ownerPrimaryName} shortValue={abbreviatedValue(nameData.owner)} tooltipValue={nameData.owner} tags={ownerTags}/> : <></>}
            <RecordItemRow loading={showLoading} label="Manager" value={nameData.manager} secondaryValue={nameData.managerPrimaryName} shortValue={abbreviatedValue(nameData.manager)} tooltipValue={nameData.manager} tags={managerTags}/>
            {expiryStr ? <RecordItemRow loading={showLoading} label="Expiry" value={expiryStr} tags={expiryTags}/> : <></>}
            <RecordItemRow loading={showLoading} label="Resolver" value={nameData.resolver} secondaryValue={nameData.resolverPrimaryName} shortValue={abbreviatedValue(nameData.resolver)} tooltipValue={nameData.resolver} tags={resolverTags}/>
            <RecordItemRow loading={showLoading} label="ETH" icon={<EthSVG/>} value={nameData.ethAddress} secondaryValue={nameData.ethAddressPrimaryName} shortValue={abbreviatedValue(nameData.ethAddress)} tooltipValue={nameData.ethAddress} tags={ethAddressTags}/>
            {nameData.avatar ? 
              <tr>
                <td>
                  <Skeleton loading={showLoading}>
                    <div>
                      <RecordItem keyLabel="Avatar" onClick={async () => {await copyToClipBoard(nameData.avatar)}}>{nameData.avatar.length > 20 ? nameData.avatar.substring(0, 20) + '...' : nameData.avatar}</RecordItem>
                    </div>
                  </Skeleton>
                </td>
                <td>
                  {nameData.avatarUrl && <Image src={nameData.avatarUrl} alt="Avatar" width="42" height="42"/>}
                </td>
              </tr>
            : <></>}
          </tbody>
        </table>
      )}
      <Heading>Metadata</Heading>
      {!hasProvider ? (
        !isChainSupported ? (
          <Typography>No web3 provider connected.</Typography>
        ) : (
          <Typography>Switch to a supported network.</Typography>
        )
      ) : (<>
        <div className={styles.metadataSection}>
          <table className={styles.itemTableAlt}>
            <tbody>
              <RecordItemRow loading={showLoading} label="Namehash" subLabel="Hexadecimal" value={namehashHex} shortValue={abbreviatedValue(namehashHex)} secondaryLabel="Namehash" secondarySubLabel="Decimal" secondaryValue={namehashDec} secondaryShortValue={abbreviatedValue(namehashDec)} secondaryIcon={false} secondaryInline={false}/>
              <RecordItemRow loading={showLoading} label="Labelhash" subLabel="Hexadecimal" value={labelhashHex} shortValue={abbreviatedValue(labelhashHex)} secondaryLabel="Labelhash" secondarySubLabel="Decimal" secondaryValue={labelhashDec} secondaryShortValue={abbreviatedValue(labelhashDec)} secondaryIcon={false} secondaryInline={false}/>
            </tbody>
          </table>
          {nftMetadataLink && 
            <Link href={nftMetadataLink}>
              <a>
                <div>
                  {name && imageLoadingErrors[name] === true ? (
                    <Image src="/error-loading-nft-image.jpg" alt="ENS NFT Image" width="132" height="132" style={{marginLeft:'1rem'}}/>
                  ) : (
                    <ProgressiveImage src={nftMetadataImage} placeholder="/loading-name.png" onError={() => setImageLoadingErrors({[name]:true})}>
                      {(src) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={src} alt="ENS NFT Image" width="132" height="132" style={{marginLeft:'1rem'}}/>
                      )}
                    </ProgressiveImage>
                  )}
                </div>
              </a>
            </Link>
          }
        </div>
      </>)}
    </>
  )
}

function NFTLink({
  link,
  image,
  alt
}) {
  return link ? (
    <Link href={link}>
      <a style={{display:'inline-block', marginRight:'0.5rem'}}>
        <div>
          <Image src={image} alt={alt} width="22" height="22"/>
        </div>
      </a>
    </Link>
  ) : <></>
}

function defaultNameData() {
  return {
    owner: '',
    manager: '',
    registryResolver: '',
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
