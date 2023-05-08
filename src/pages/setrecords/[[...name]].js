import styles from '../../styles/SetRecords.module.css'
import Head from 'next/head'
import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Heading,
  Input,
  EthSVG,
  CrossSVG,
  PlusSVG,
  Skeleton,
  Helper,
  Banner
} from '@ensdomains/thorin'
import { useAccount, useProvider } from 'wagmi'
import { goerli } from '@wagmi/core/chains'
import { ethers } from 'ethers'
import { MulticallWrapper } from 'ethers-multicall-provider'
import Header from '../../components/header'
import SetRecordsModal from '../../components/setrecords-modal'
import toast, { Toaster } from 'react-hot-toast'
import { ensConfig } from '../../lib/constants'
import {
  validChain,
  normalize,
  parseName,
  getAddress,
  convertToAddress,
  isValidAddress,
  universalResolveAddr
} from '../../lib/utils'
import { useChain, useDelayedName, useRouterPush } from '../../hooks/misc'

export default function SetRecords() {
  function defaultNameData() {
    return {
      name: '',
      registryOwner: '',
      registryResolver: '',
      ethAddress: '',
      offchain: false,
      records: {},
      eth2LDExpiry: 0,
      isWrapped: false,
      wrappedOwner: '',
      wrappedExpiry: 0,
      owner: '',
      expiry: 0
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [name, setName] = useState('')
  const [ethAddress, setEthAddress] = useState('')
  const [textRecords, setTextRecords] = useState([{key:'', value:''}])
  const [nameData, setNameData] = useState(defaultNameData())
  const [loading, setLoading] = useState(false)

  const delayedName = useDelayedName(name, '/setrecords/')
  const onNameChange = useRouterPush('/setrecords/', setName)

  const provider = useProvider()
  const { address } = useAccount()
  const { chain, chains } = useChain(provider)

  const getUpdatedRecords = (textRecords, nameData) => {
    const updatedRecords = []
    const textRecordsObj = {}

    for (let i in textRecords) {
      if ((!textRecords[i].key && textRecords[i].value) || (textRecords[i].key && textRecords[i].value !== nameData.records[textRecords[i].key])) {
        updatedRecords.push({
          key: textRecords[i].key,
          value: textRecords[i].value
        })
      }
      if (textRecords[i].key) {
        textRecordsObj[textRecords[i].key] = textRecords[i].value
      }
    }

    Object.entries(nameData.records).forEach(([key]) => {
      if (!textRecordsObj[key]) {
        updatedRecords.push({
          key: key,
          value: ''
        })
      }
    })

    return updatedRecords
  }

  const isDataChanged = (ethAddress, textRecords, nameData) => {
    if (getAddress(ethAddress) !== getAddress(nameData.ethAddress)) {
      return true
    }

    if (getUpdatedRecords(textRecords, nameData).length > 0) {
      return true
    }

    return false
  }

  const getCurrentData = useCallback(async (name) => {
    const nameData = defaultNameData()

    nameData.name = name

    if (name) {
      const {
        isNameValid,
        normalizedName
      } = normalize(name)

      if (isNameValid && validChain(chain, chains)) {
        const {
          node,
          isETH2LD,
          eth2LDTokenId,
          wrappedTokenId
        } = parseName(normalizedName)

        try {
          const multi = MulticallWrapper.wrap(provider)
          const batch1 = []

          // Get registry owner/resolver
          const registry = new ethers.Contract(ensConfig[chain].Registry?.address, ensConfig[chain].Registry?.abi, multi)
          batch1.push(registry.owner(node))
          batch1.push(registry.resolver(node))

          const universalResolver = new ethers.Contract(ensConfig[chain].UniversalResolver?.address, ensConfig[chain].UniversalResolver?.abi, multi)
          batch1.push(universalResolveAddr(universalResolver, normalizedName, node))

          const nameWrapperAddress = ensConfig[chain].NameWrapper?.address
          const nameWrapper = new ethers.Contract(nameWrapperAddress, ensConfig[chain].NameWrapper?.abi, multi)
          batch1.push(nameWrapper.getData(wrappedTokenId))

          if (isETH2LD) {
            // Get registrar expiry
            const ethRegistrar = new ethers.Contract(ensConfig[chain].ETHRegistrar?.address, ensConfig[chain].ETHRegistrar?.abi, multi)
            batch1.push(ethRegistrar.nameExpires(eth2LDTokenId))
          }

          const results1 = await Promise.all(batch1)
          let results1Index = 0

          // Get registry owner
          if (isValidAddress(results1[results1Index])) {
            nameData.registryOwner = getAddress(results1[results1Index])
            nameData.owner = nameData.registryOwner
          }
          results1Index++

          // Get registry resolver
          if (isValidAddress(results1[results1Index])) {
            nameData.registryResolver = getAddress(results1[results1Index])
          }
          results1Index++

          // Get ETH address (possibly via wildcard or offchain)
          if (results1[results1Index] && !(results1[results1Index] instanceof Error) && results1[results1Index].length > 0) {
            const ethAddress = convertToAddress(results1[results1Index][0])
            if (isValidAddress(ethAddress)) {
              nameData.ethAddress = ethAddress
            }
          }
          results1Index++

          nameData.isWrapped = nameData.registryOwner === nameWrapperAddress
          if (nameData.isWrapped) {
            // Get wrapped data
            const data = results1[results1Index]
            if (data && data.owner) {
              nameData.wrappedOwner = getAddress(data.owner)
              nameData.wrappedExpiry = data.expiry

              nameData.owner = nameData.wrappedOwner
              nameData.expiry = nameData.wrappedExpiry
            }
          }
          results1Index++

          if (isETH2LD) {
            // Get registrar expiry
            nameData.eth2LDExpiry = results1[results1Index]
            nameData.expiry = nameData.eth2LDExpiry
            results1Index++
          }

          if (!nameData.registryOwner && nameData.ethAddress) {
            nameData.offchain = true
          }

          if (nameData.registryResolver && !nameData.offchain) {
            try {
              // TODO: Switch off hosted service
              const response = await fetch(`https://api.thegraph.com/subgraphs/name/ensdomains/ens${chain === goerli.id ? 'goerli' : ''}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({query: `query {domain(id:"${node}"){resolver{texts}}}`})
              });
              const rsp = await response.json();
              const texts = rsp.data?.domain?.resolver?.texts || []

              if (texts.length > 0) {
                const batch2 = []

                const resolverContract = new ethers.Contract(nameData.registryResolver, ensConfig[chain].LatestPublicResolver?.abi, multi)
                for (let i in texts) {
                  batch2.push(resolverContract.text(node, texts[i]))
                }

                const results2 = await Promise.all(batch2)
                for (let i in texts) {
                  nameData.records[texts[i]] = results2[i]
                }
              }
            } catch (e) {
              console.error(e)
            }
          }
        } catch (e) {
          console.error(e)
        }
      }
    }

    setNameData(nameData)
    setEthAddress(nameData.ethAddress)
    const mappedRecords = Object.entries(nameData.records).map(([key, value]) => {return {key, value}})
    mappedRecords.push({key:'', value:''})
    setTextRecords(mappedRecords)
    setLoading(false)
  }, [setEthAddress, setTextRecords, setNameData, setLoading, chain, chains, provider])

  useEffect(() => {
    getCurrentData(delayedName)
    return () => {
      setNameData(defaultNameData())
      setEthAddress('')
      setTextRecords([{key:'', value:''}])
      setLoading(true)
    }
  }, [delayedName, setEthAddress, setTextRecords, getCurrentData, setNameData, setLoading])

  const onRecordChange = (i, key, value) => {
    const newRecords = JSON.parse(JSON.stringify(textRecords || []))

    while (newRecords.length <= i) {
      newRecords.push({key:'', value:''})
    }
    newRecords[i].key = key
    newRecords[i].value = value

    setTextRecords(newRecords)
  }

  const recordRows = textRecords.map(({key, value}, i) => {
    const lastRecord = i >= textRecords.length - 1
    return (
      <div key={`record${i}`} className={styles.recordrow}>
        <Skeleton loading={loading}>
          <Input
            name={`tkey${i}`}
            label="Key"
            value={key || ''}
            spellCheck="false"
            autoCapitalize="none"
            parentStyles={{ backgroundColor: '#fff' }}
            onChange={(e) => onRecordChange(i, e.target.value, value)}
          />
        </Skeleton>
        <Skeleton loading={loading}>
          <Input
            name={`tvalue${i}`}
            label="Value"
            value={value || ''}
            spellCheck="false"
            autoCapitalize="none"
            parentStyles={{ backgroundColor: '#fff' }}
            onChange={(e) => onRecordChange(i, key, e.target.value)}
          />
        </Skeleton>
        {!loading &&
          <Button className={styles.recordButton} shape="circle" colorStyle={lastRecord ? 'greenSecondary' : 'redSecondary'} onClick={() => {
            if (lastRecord) {
              setTextRecords(textRecords.concat({key:'', value:''}))
            } else {
              setTextRecords(textRecords.toSpliced(i, 1))
            }
          }}>
            {lastRecord ? <PlusSVG/> : <CrossSVG/>}
          </Button>
        }
      </div>
    )
  })

  const resolverNotSet = nameData.registryOwner && !nameData.registryResolver
  const isNameExpired = nameData.expiry > 0 && nameData.expiry <= (Date.now() / 1000)
  const dataChanged = isDataChanged(ethAddress, textRecords, nameData)

  let updatedEthAddress = ''
  if (getAddress(ethAddress) !== getAddress(nameData.ethAddress)) {
    if (ethAddress) {
      updatedEthAddress = getAddress(ethAddress)
    } else {
      updatedEthAddress = ethers.constants.AddressZero
    }
  }

  return (
    <>
      <Head>
        <title>ENS Tools - Set Records</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Set ETH address or text records if you can't use the official manager app"/>
        <meta property="og:title" content="ENS Tools - Set Records"/>
        <meta property="og:description" content="Set ETH address or text records if you can't use the official manager app"/>
        <meta property="og:image" content="https://tools.ens.domains/sharing-setrecords.jpg"/>
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:creator" content="@serenae_fansubs"/>
      </Head>
      <Header position="absolute" />
      <div className="container container--flex">
        <Heading
          as="h1"
          level="1"
          align="center"
          style={{ marginBottom: '2rem', lineHeight: '1' }}
        >
          Set Records
        </Heading>
        {showBanner &&
          <Banner alert="warning" title="Use the ENS Manager App!" className={styles.banner} onDismiss={() => setShowBanner(false)}>
            This tool is only needed if you can&apos;t use the official manager app. For example, if you have just approved a separate manager for the Public Resolver, and the official manager app doesn&apos;t yet support that.
            <br/><br/>
            Go here: <a href="https://app.ens.domains/">ENS Manager App</a>
          </Banner>
        }
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault()

            if (!nameData.name) {
              return toast.error('Please enter an ENS name')
            }

            const {
              isNameValid,
              normalizedName
            } = normalize(nameData.name)

            if (!isNameValid) {
              return toast.error(`${nameData.name} is not a valid name`)
            }

            // Check wallet connection
            if (!address) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!validChain(chain, chains)) {
              return toast.error('Switch to a supported network')
            }

            if (!isValidAddress(nameData.registryOwner)) {
              return toast.error('Name does not exist on-chain or has been deleted')
            }

            if (!isValidAddress(nameData.registryResolver)) {
              return toast.error('Name does not have any resolver set')
            }

            if (nameData.expiry > 0 && nameData.expiry <= (Date.now() / 1000)) {
              return toast.error('Name is expired')
            }

            if (ethAddress && !isValidAddress(ethAddress)) {
              return toast.error('ETH address is invalid')
            }

            const {
              node
            } = parseName(normalizedName)

            let isApproved = false

            try {
              const multi = MulticallWrapper.wrap(provider)
              const batch1 = []
              
              const resolverContract = new ethers.Contract(nameData.registryResolver, ensConfig[chain].LatestPublicResolver?.abi, multi)
              batch1.push(resolverContract.isApprovedForAll(nameData.owner, address).catch(e => e))
              batch1.push(resolverContract.isApprovedFor(nameData.owner, node, address).catch(e => e))

              const results1 = await Promise.all(batch1)
              let results1Index = 0

              if (!(results1[results1Index] instanceof Error)) {
                if (results1[results1Index]) {
                  isApproved = true
                }
              }
              results1Index++

              if (!(results1[results1Index] instanceof Error)) {
                if (results1[results1Index]) {
                  isApproved = true
                }
              }
              results1Index++
            } catch(e) {
              console.error(e)
            }

            if (!isApproved && nameData.owner !== address) {
              return toast.error('You are not a manager for this name')
            }

            setDialogOpen(true)
          }}
        >
          <div className={styles.col}>
            <Input
              name="tname"
              label="ENS Name"
              placeholder="myname.eth"
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className={styles.col}>
            <Skeleton loading={loading}>
              <Input
                name="tethaddr"
                prefix={<><EthSVG/>ETH</>}
                value={ethAddress}
                placeholder="0x..."
                spellCheck="false"
                autoCapitalize="none"
                parentStyles={{ backgroundColor: '#fff' }}
                onChange={(e) => setEthAddress(e.target.value)}
              />
            </Skeleton>
          </div>
          {nameData.offchain ? (
            <div className={styles.col}>
              <Helper type="warning">This is an offchain name. This tool only supports setting records for onchain names.</Helper>
            </div>
          ) : resolverNotSet ? (
            <div className={styles.col}>
              <Helper type="warning">
                <span>
                  This name does not have any resolver set. Set your resolver here: <a href={`https://app.ens.domains/${name}?tab=more`} style={{color:'rgb(82, 152, 255)'}}>ENS Manager App</a>
                </span>
              </Helper>
            </div>
          ) : isNameExpired ? (
            <div className={styles.col}>
              <Helper type="warning">
                <span>
                  This name is currently expired.
                </span>
              </Helper>
            </div>
          ) : (<></>)}
          {recordRows}
          <Button
            type="submit"
            variant="action"
            disabled={loading || !nameData.registryOwner || resolverNotSet || !dataChanged}
            style={{marginTop: '0.5rem'}}
          >
            Submit
          </Button>
          <SetRecordsModal
            name={nameData.name}
            resolver={nameData.registryResolver}
            ethAddress={updatedEthAddress}
            records={getUpdatedRecords(textRecords, nameData)}
            open={dialogOpen}
            setIsOpen={setDialogOpen}
          />
        </form>
      </div>

      <Toaster position="bottom-center" toastOptions={{style:{maxWidth:'420px'}}} />
    </>
  )
}
