import Link from 'next/link'
import { Heading, Tag, AlertSVG, EthSVG } from '@ensdomains/thorin'
import ConnectButtonWrapper from '../components/connect-button'
import { useProvider } from 'wagmi'
import { mainnet, goerli } from '@wagmi/core/chains'
import { useChain } from '../hooks/misc'
import { useState, useEffect } from 'react'

export default function Header({ position }) {
  const provider = useProvider()
  const { chain } = useChain(provider)
  const [tagInfo, setTagInfo] = useState({})
  const [topLinkDisabled, setTopLinkDisabled] = useState(false)

  useEffect(() => {
    let tagColor = 'greyPrimary'
    let tagIcon = <AlertSVG/>
    let tagValue = `Unsupported Chain (${chain})`
  
    if (chain === mainnet.id) {
      tagColor = 'greenPrimary'
      tagIcon = <EthSVG/>
      tagValue = 'Mainnet'
    } else if (chain === goerli.id) {
      tagColor = 'tealPrimary'
      tagIcon = <EthSVG/>
      tagValue = 'Goerli'
    } else if (chain === 0) {
      tagValue = 'No Network'
    }

    setTagInfo({
      tagColor,
      tagIcon,
      tagValue
    })
  }, [chain])

  useEffect(() => {
    if (window.location.hash === '#embedded' && !topLinkDisabled) {
      setTopLinkDisabled(true)
    }
  }, [])

  return (
    <header className={['header', [position && `header--${position}`]].join(' ')}>
      <Link href={topLinkDisabled ? '#' : '/'}>
        <a>
          <Heading as="span" level="2" className="header__name">
            ENS Misc Tools
          </Heading>
        </a>
      </Link>
      <div style={{display:'flex', flexDirection:'row', alignItems:'center'}}>
        {tagInfo?.tagValue ? <Tag colorStyle={tagInfo.tagColor} size="medium" style={{height:'min-content', marginRight:'1rem'}}>{tagInfo.tagIcon}{tagInfo.tagValue}</Tag> : <></>}
        <ConnectButtonWrapper />
      </div>
    </header>
  )
}