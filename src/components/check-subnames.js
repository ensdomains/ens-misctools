import styles from '../styles/Check.module.css'
import { Card, Heading, Typography } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import { ensConfig } from '../lib/constants'
import { validChain, normalize, parseName, hasExpiry, parseExpiry } from '../lib/utils'
import useCache from '../hooks/cache'
import { useChain } from '../hooks/misc'
import { useState, } from 'react'
import { useProvider } from 'wagmi'
import { goerli } from '@wagmi/core/chains'
import { ethers } from 'ethers'
import { MulticallWrapper } from 'ethers-multicall-provider'
import toast from 'react-hot-toast'

export default function CheckSubnames({
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
        } = parseName(normalizedName)

        try {
          const multi = MulticallWrapper.wrap(provider)
          const registry = new ethers.Contract(ensConfig[chain].Registry?.address, ensConfig[chain].Registry?.abi, multi)
          const nameWrapper = new ethers.Contract(ensConfig[chain].NameWrapper?.address, ensConfig[chain].NameWrapper?.abi, multi)

          // TODO: Switch off hosted service
          let offset = 0
          let limit = 100
          let done = false
          while (!done) {
            const response = await fetch(`https://api.thegraph.com/subgraphs/name/ensdomains/ens${chain === goerli.id ? 'goerli' : ''}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({query: `query {domain(id:"${node}"){subdomains(orderBy:labelhash,first:${limit},skip:${offset}){id labelName labelhash}}}`})
            });
            const rsp = await response.json();

            let subs = rsp.data?.domain?.subdomains || []

            // Get registry owners
            const registryResults = await Promise.all(subs.map(subdomain => registry.owner(subdomain.id)))
            registryResults.forEach((result, index) => {subs[index].registryOwner = result})

            // Get wrapped data
            const wrapperResults = await Promise.all(subs.map(subdomain => nameWrapper.getData(subdomain.id)))
            wrapperResults.forEach((result, index) => {
              subs[index].wrapperData = {
                owner: result.owner,
                fuses: result.fuses,
                expiry: result.expiry
              }
            })
            
            nameData.subdomains.push(...subs)

            if (subs.length < limit) {
              done = true
            } else {
              offset += limit
            }
          }

          nameData.success = true
        } catch (e) {
          console.error(e)
        }

        nameData.loaded = true
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
    const nameData = defaultNameData()
    nameData.loaded = true
    setNameData(nameData)
  }

  const cache = useCache('check-subnames-update', {name, chain}, doUpdate, onUpdateSuccess, onUpdateError)

  let showLoading = cache.showLoading
  if (cache.data && cache.data.keyData.name !== name) {
    showLoading = true
  }

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  if (isNameValid && validChain(chain, chains) && !nameData.loaded) {
    showLoading = true
  }

  const {
    level
  } = parseName(normalizedName)

  let subnameRows = <></>

  if (!showLoading && validChain(chain, chains)) {
    subnameRows = nameData.subdomains.map((subdomain, index) => {
      const stateTagInfo = {}
      const expiryTagInfo = {}

      if (subdomain.wrapperData) {
        const nameWrapperAddress = ensConfig[chain]?.NameWrapper?.address
        const isEmancipated = (subdomain.wrapperData.fuses & 65536) === 65536
        const isLocked = (subdomain.wrapperData.fuses & 1) === 1
        const expiryStr = parseExpiry(subdomain.wrapperData.expiry)

        if (subdomain.wrapperData.owner !== ethers.constants.AddressZero) {
          if (isLocked) {
            stateTagInfo.tag = 'Locked'
            stateTagInfo.tagColor = 'yellowSecondary'
            stateTagInfo.tagTooltip = 'This subname can no longer be unwrapped.'
            stateTagInfo.tagTooltipDialog = <>
              The parent owner also cannot delete/replace this name, or burn any additional fuses.
              <br/><br/>
              Be aware of the implications, especially if you are planning on purchasing the parent name &quot;<Typography>{bestDisplayName}</Typography>&quot;.
              <br/><br/>
              Even if the parent name is purchased / transferred, you will <b>not be able to replace</b> this subname.
              <br/><br/>
              This will be true until the subname expiry on <b>{expiryStr}</b>.
              <br/><br/>
              When the expiry is reached, the owner will lose ownership of this subname, and the parent owner will then be able to recreate/replace it.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
            </>
          } else if (isEmancipated) {
            stateTagInfo.tag = 'Emancipated'
            stateTagInfo.tagColor = 'yellowSecondary'
            stateTagInfo.tagTooltip = <>This name can no longer be deleted/replaced by the owner of the parent name &quot;<Typography>{bestDisplayName}</Typography>&quot;.</>
            stateTagInfo.tagTooltipDialog = <>
              Be aware of the implications, especially if you are planning on purchasing the parent name &quot;<Typography>{bestDisplayName}</Typography>&quot;.
              <br/><br/>
              Even if the parent name is purchased / transferred, you will <b>not be able to replace</b> this subname.
              <br/><br/>
              This will be true until the subname expiry on <b>{expiryStr}</b>.
              <br/><br/>
              When the expiry is reached, the owner will lose ownership of this subname, and the parent owner will then be able to recreate/replace it.
              <br/><br/>
              More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/expiry">Expiry</a>
            </>
          }
        }

        if (hasExpiry(subdomain.wrapperData.expiry) && subdomain.registryOwner === nameWrapperAddress) {
          const epochMs = subdomain.wrapperData.expiry * 1000
          const nowMs = new Date().getTime()
          const days90Ms = 90 * 24 * 60 * 60 * 1000

          if (nowMs >= epochMs && subdomain.wrapperData.owner === ethers.constants.AddressZero) {
            expiryTagInfo.tag2 = 'Expired'
            expiryTagInfo.tag2Color = 'redSecondary'
            expiryTagInfo.tag2Tooltip = 'This subname is expired.'
            expiryTagInfo.tag2TooltipDialog = <>
              It expired on {expiryStr}.
              <br/><br/>
              The parent owner can now recreate/replace this name.
            </>
          } else if (nowMs < epochMs && nowMs + days90Ms >= epochMs && isEmancipated) {
            expiryTagInfo.tag2 = 'Expiring Soon'
            expiryTagInfo.tag2Color = 'yellowSecondary'
            expiryTagInfo.tag2Tooltip = 'This subname is expiring soon.'
            expiryTagInfo.tag2TooltipDialog = <>
              It will expire on {expiryStr}.
              <br/><br/>
              If it is not renewed, then the owner will lose ownership of the subname, and the parent owner will then be able to recreate/replace this subname.
            </>
          }
        }
      }

      return (
        <RecordItemRow loading={showLoading} label="Label" value={subdomain.labelName} key={subdomain.labelhash || 'sub' + index} {...stateTagInfo} {...expiryTagInfo}/>
      )
    })
  }

  return (
    <div className={styles.containerMiddleCol}>
      <Card>
        <Heading>Subnames</Heading>
        {!hasProvider ? (
          !isChainSupported ? (
            <Typography>No web3 provider connected.</Typography>
          ) : (
            <Typography>Switch to a supported network.</Typography>
          )
        ) : isNameValid && level >= 2 ?
          (showLoading ? (<>
            <Typography>Loading subnames...</Typography>
            <table className={styles.itemTable}>
              <tbody>
                <RecordItemRow loading={showLoading}/>
              </tbody>
            </table>
          </>) : (
            nameData.subdomains.length > 0 ? (<>
              <table className={styles.itemTable}>
                <tbody>
                  {subnameRows}
                </tbody>
              </table>
            </>) : (<>
              <Typography>No subnames found.</Typography>
            </>)
          )
        ) : isNameValid ? (
          <Typography>Skipping subname checks.<br/>Search for a second-level domain<br/>or lower to check subnames.</Typography>
        ) : name && (
          <Typography>Skipping subname checks for invalid name.</Typography>
        )}
      </Card>
    </div>
  )
}

function defaultNameData() {
  return {
    loaded: false,
    success: false,
    subdomains: []
  }
}
