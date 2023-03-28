import { Heading } from '@ensdomains/thorin'
import ConnectButtonWrapper from '../components/connect-button'

export default function Header({ position }) {
  return (
    <header className={['header', [position && `header--${position}`]].join(' ')}>
      <Heading as="span" level="2" className="header__name">
        ENS Misc Tools
      </Heading>
      <ConnectButtonWrapper />
    </header>
  )
}