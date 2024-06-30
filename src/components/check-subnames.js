import styles from '../styles/Check.module.css'
import { Card, Heading, Typography, PageButtons } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import { ensConfig } from '../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  readContract,
  getAddress,
  isValidAddress,
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

export default function CheckSubnames({
  name,
  updateNameInput
}) {
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [nameData, setNameData] = useState(defaultNameData())
  const client = usePublicClient()
  const { chain, chains, hasClient, isChainSupported } = useChain(client)

  const PAGE_SIZE = 10

  const doUpdateTotalPages = async ({name, chain}) => {
    let totalPages = 0

    if (name) {
      const {
        isNameValid,
        normalizedName
      } = normalize(name)

      if (isNameValid && validChain(chain, chains)) {
        const {
          node,
          level
        } = parseName(normalizedName)

        if (level >= 2) {
          try {
            // TODO: Switch off hosted service
            const countResponse = await fetch(ensConfig[chain].subgraphURL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({query: `query {domain(id:"${node}"){subdomainCount}}`})
            });
            const countRsp = await countResponse.json();
            totalPages = Math.ceil((countRsp.data?.domain?.subdomainCount || 0) / 10)
          } catch (e) {
            console.error(e)
          }
        }
      }
    }

    return totalPages
  }

  const onUpdateTotalPagesSuccess = (totalPages) => {
    setTotalPages(totalPages)
    setPage(1)
  }

  const onUpdateTotalPagesError = (error) => {
    toast.error('Error loading subname information')
    console.error(error)
    setTotalPages(0)
    setPage(1)
  }

  const totalPagesCache = useCache('check-subnames-updatetotalpages', {name, chain}, doUpdateTotalPages, onUpdateTotalPagesSuccess, onUpdateTotalPagesError)

  const doUpdate = async ({name, chain, page, totalPages}) => {
    const nameData = defaultNameData();

    if (name && page > 0 && totalPages > 0) {
      const {
        isNameValid,
        normalizedName
      } = normalize(name)

      if (isNameValid && validChain(chain, chains)) {
        const {
          node,
          level
        } = parseName(normalizedName)

        if (level >= 2) {
          try {
            const registry = getContract({address: ensConfig[chain].Registry?.address, abi: ensConfig[chain].Registry?.abi, client})
            const nameWrapper = getContract({address: ensConfig[chain].NameWrapper?.address, abi: ensConfig[chain].NameWrapper?.abi, client})

            // TODO: Switch off hosted service
            let limit = PAGE_SIZE
            let offset = (page - 1) * limit
            const response = await fetch(ensConfig[chain].subgraphURL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({query: `query {domain(id:"${node}"){subdomains(orderBy:labelhash,first:${limit},skip:${offset}){id labelName labelhash subdomains(orderBy:labelhash,first:10){id labelName labelhash subdomains(orderBy:labelhash,first:10) {id labelName labelhash}}}}}`})
            });
            const rsp = await response.json();

            let subs = rsp.data?.domain?.subdomains || []

            if (subs.length > 0) {
              const batch = []
              subs.forEach((sub) => {
                batch.push(readContract(client, registry, 'owner', sub.id))
                batch.push(readContract(client, nameWrapper, 'getData', sub.id))
                sub.subdomains.forEach((sub) => {
                  batch.push(readContract(client, registry, 'owner', sub.id))
                  batch.push(readContract(client, nameWrapper, 'getData', sub.id))
                  sub.subdomains.forEach((sub) => {
                    batch.push(readContract(client, registry, 'owner', sub.id))
                    batch.push(readContract(client, nameWrapper, 'getData', sub.id))
                  })
                })
              })

              const results = await Promise.all(batch)
              const resultIndex = {i: 0}
              const unknownLabels = []

              subs.forEach((sub) => {
                if (!sub.labelName) {
                  unknownLabels.push(sub.labelhash)
                }
                sub.registryOwner = getAddress(getMulticallResult(results[resultIndex.i++], true))
                const wrapperData = getMulticallResult(results[resultIndex.i++], true)
                sub.wrapperData = {
                  owner: getAddress(wrapperData[0]),
                  fuses: BigInt(wrapperData[1]),
                  expiry: BigInt(wrapperData[2])
                }
                sub.subdomains.forEach((sub) => {
                  if (!sub.labelName) {
                    unknownLabels.push(sub.labelhash)
                  }
                  sub.registryOwner = getAddress(getMulticallResult(results[resultIndex.i++], true))
                  const wrapperData = getMulticallResult(results[resultIndex.i++], true)
                  sub.wrapperData = {
                    owner: getAddress(wrapperData[0]),
                    fuses: BigInt(wrapperData[1]),
                    expiry: BigInt(wrapperData[2])
                  }
                  sub.subdomains.forEach((sub) => {
                    if (!sub.labelName) {
                      unknownLabels.push(sub.labelhash)
                    }
                    sub.registryOwner = getAddress(getMulticallResult(results[resultIndex.i++], true))
                    const wrapperData = getMulticallResult(results[resultIndex.i++], true)
                    sub.wrapperData = {
                      owner: getAddress(wrapperData[0]),
                      fuses: BigInt(wrapperData[1]),
                      expiry: BigInt(wrapperData[2])
                    }
                  })
                })
              })

              if (unknownLabels.length > 0) {
                const response = await fetch(ensConfig[chain].subgraphURL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({query: `query {${unknownLabels.map((labelhash, i) => `label${i}: domains(where:{labelhash:"${labelhash}",labelName_not:null}first:1){labelName}`)}}`})
                });
                const rsp = await response.json();

                if (rsp.data) {
                  const labelMap = {}

                  unknownLabels.forEach((labelhash, i) => {
                    const labelResult = rsp.data[`label${i}`]
                    if (labelResult && labelResult.length > 0) {
                      labelMap[labelhash] = labelResult[0].labelName
                    }
                  })

                  subs.forEach((sub) => {
                    if (!sub.labelName && labelMap[sub.labelhash]) {
                      sub.labelName = labelMap[sub.labelhash]
                    }
                    sub.subdomains.forEach((sub) => {
                      if (!sub.labelName && labelMap[sub.labelhash]) {
                        sub.labelName = labelMap[sub.labelhash]
                      }
                      sub.subdomains.forEach((sub) => {
                        if (!sub.labelName && labelMap[sub.labelhash]) {
                          sub.labelName = labelMap[sub.labelhash]
                        }
                      })
                    })
                  })
                }
              }
            }
            
            nameData.subdomains[page] = subs
            nameData.success = true
          } catch (e) {
            console.error(e)
          }
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
    toast.error('Error loading subname information')
    console.error(error)
    const nameData = defaultNameData()
    nameData.loaded = true
    setNameData(nameData)
  }

  const cache = useCache('check-subnames-update', {name, chain, page, totalPages}, doUpdate, onUpdateSuccess, onUpdateError)

  let showLoading = totalPagesCache.showLoading || cache.showLoading
  if (cache.data && cache.data.keyData.name !== name) {
    showLoading = true
  }

  const {
    isNameValid,
    normalizedName,
    bestDisplayName
  } = normalize(name)

  if (isNameValid && validChain(chain, chains) && page > 0 && totalPages > 0 && !nameData.loaded) {
    showLoading = true
  }

  const {
    level
  } = parseName(normalizedName)

  let subs = nameData.subdomains[page]
  if (totalPages > 0 && !subs) {
    showLoading = true
  }
  const subnameRows = []

  if (!showLoading && validChain(chain, chains)) {
    subs = nameData.subdomains[page] || []

    const createSubnameRow = (subdomain, parentName, indent) => {
      const tags = []

      if (subdomain.wrapperData) {
        const nameWrapperAddress = ensConfig[chain]?.NameWrapper?.address
        const isWrapped = subdomain.registryOwner === nameWrapperAddress && isValidAddress(subdomain.wrapperData.owner)
        const isEmancipated = isWrapped && (subdomain.wrapperData.fuses & 65536n) === 65536n
        const isLocked = isWrapped && (subdomain.wrapperData.fuses & 1n) === 1n
        const expiryStr = parseExpiry(subdomain.wrapperData.expiry)

        if (isLocked) {
          tags.push({
            value: 'Locked',
            color: 'yellowSecondary',
            tooltip: 'This subname is wrapped and can no longer be unwrapped.',
            tooltipDialog: <>
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
          })
        } else if (isEmancipated) {
          tags.push({
            value: 'Emancipated',
            color: 'yellowSecondary',
            tooltip: <>This name is wrapped and can no longer be deleted/replaced by the owner of the parent name &quot;<Typography>{bestDisplayName}</Typography>&quot;.</>,
            tooltipDialog: <>
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
          })
        } else if (isWrapped) {
          tags.push({
            value: 'Wrapped',
            color: 'blueSecondary',
            tooltip: <>This name is wrapped, but can still be deleted/replaced by the owner of the parent name &quot;<Typography>{bestDisplayName}</Typography>&quot;.</>
          })
        }

        if (hasExpiry(subdomain.wrapperData.expiry) && subdomain.registryOwner === nameWrapperAddress) {
          const epochMs = subdomain.wrapperData.expiry * 1000n
          const nowMs = BigInt(new Date().getTime())
          const days90Ms = 90n * 24n * 60n * 60n * 1000n

          if (nowMs >= epochMs && subdomain.wrapperData.owner === ethers.constants.AddressZero) {
            tags.push({
              value: 'Expired',
              color: 'redSecondary',
              tooltip: 'This subname is expired.',
              tooltipDialog: <>
                It expired on {expiryStr}.
                <br/><br/>
                The parent owner can now recreate/replace this name.
              </>
            })
          } else if (nowMs < epochMs && nowMs + days90Ms >= epochMs && isEmancipated) {
            tags.push({
              value: 'Expiring Soon',
              color: 'yellowSecondary',
              tooltip: 'This subname is expiring soon.',
              tooltipDialog: <>
                It will expire on {expiryStr}.
                <br/><br/>
                If it is not renewed, then the owner will lose ownership of the subname, and the parent owner will then be able to recreate/replace this subname.
              </>
            })
          }
        }
      }

      if (!subdomain.labelName) {
        tags.push({
          value: 'Label Unknown',
          color: 'yellowSecondary',
          tooltip: 'The label for this subname could not be found.',
          tooltipDialog: <>
            This does not mean that anything is wrong with this subname. The label was just not able to be found in the ENS subgraph.
            <br/><br/>
            If you know what the label is, you can still search for that subname in the search field above.
            <br/><br/>
            You can also view the subname on the ENS manager app by entering in the subname manually.
          </>
        })
      }

      const convertLabelhash = (labelhash) => {
        if (labelhash) {
          const len = labelhash.length
          if (len >= 10) {
            return '[' + labelhash.substring(2, 6) + '...' + labelhash.substring(len - 4, len) + ']'
          }
        }
        return ''
      }

      const labelValue = subdomain.labelName || subdomain.labelhash
      const labelShortValue = subdomain.labelName || convertLabelhash(subdomain.labelhash)
      const link = (subdomain.labelName && parentName) ? normalize(subdomain.labelName + '.' + parentName).bestDisplayName : ''

      subnameRows.push(
        <RecordItemRow loading={showLoading} label="Label" value={labelValue} shortValue={labelShortValue} key={subdomain.labelhash} link={link} updateNameInput={updateNameInput} tags={tags} indent={indent}/>
      )

      if (subdomain.subdomains) {
        subdomain.subdomains.forEach((subsubdomain) => {
          createSubnameRow(subsubdomain, (subdomain.labelName && parentName) ? subdomain.labelName + '.' + parentName : '', (indent || 0) + 1)
        })
      }
    }

    subs.forEach((subdomain) => createSubnameRow(subdomain, name))
  }

  return (
    <div className={styles.containerMiddleCol}>
      <Card>
        <Heading>Subnames</Heading>
        {!hasClient ? (
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
            subs.length > 0 ? (<>
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
        {hasClient && isNameValid && level >= 2 && totalPages > 1 && (
          <PageButtons
            alwaysShowFirst
            alwaysShowLast
            current={page}
            max={5}
            total={totalPages}
            onChange={(value) => setPage(value)}
          />
        )}
      </Card>
    </div>
  )
}

function defaultNameData() {
  return {
    loaded: false,
    success: false,
    subdomains: {}
  }
}
