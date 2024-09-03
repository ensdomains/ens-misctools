import styles from '../styles/Home.module.css'
import Link from 'next/link'
import Image from 'next/image'
import { Card, Typography } from '@ensdomains/thorin'
import Header from '../components/header'
import Metadata from '../components/metadata'

export default function Home() {
  return (
    <>
      <Metadata title="ENS Tools" description="Miscellaneous ENS-related tasks" image="https://tools.ens.domains/sharing.jpg"/>
      <Header position="absolute" />
      <div className={styles.container}>
        <Card>
          <Link href="/check">
            <div><Image src="/sharing-check.png" alt="Check Name" width="350" height="175" priority/></div>
          </Link>
          <Typography>Check the current status of an ENS name, including normalization, expiry, resolver, wrapped state, and subnames. If you&apos;re about to buy a name, check this page first!</Typography>
        </Card>
        <Card>
          <Link href="/setprimary">
            <div><Image src="/sharing-setprimary.png" alt="Set Primary Name" width="350" height="175" priority/></div>
          </Link>
          <Typography>Set your ENS Primary Name. Works when setting on behalf of a contract address you own, or a separate address that you&apos;re an operator for, too!</Typography>
        </Card>
        <Card>
          <Link href="/unwrap">
            <div><Image src="/sharing-unwrap.png" alt="Unwrap Name" width="350" height="175" priority/></div>
          </Link>
          <Typography>You have &quot;upgraded&quot; a name, or in other words wrapped the name in the ENS Name Wrapper. Use this tool to unwrap that name, if the permission to unwrap has not been revoked.</Typography>
        </Card>
        <Card>
          <Link href="/setprmanager">
            <div><Image src="/sharing-setprmanager.png" alt="Set Public Resolver Manager" width="350" height="175" priority/></div>
          </Link>
          <Typography>If you are using the latest Public Resolver, then you can use this to approve separate manager accounts that can edit your records, but can&apos;t transfer any names.</Typography>
        </Card>
        <Card>
          <Link href="/setrecords">
            <div><Image src="/sharing-setrecords.png" alt="Set Records" width="350" height="175" priority/></div>
          </Link>
          <Typography>Set ETH address or text records if you can&apos;t use the official manager app. Useful if you&apos;re using a separate Public Resolver manager for wrapped names.</Typography>
        </Card>
         <Card>
          <Link href="/dnsquery">
              <div><Image src="/sharing-dnssec.png" alt="DNSSEC Query" width="350" height="175" priority/></div>
          </Link>
          <Typography>Query your DNS name to test if DNNSEC support works properly.</Typography>
        </Card>
      </div>
    </>
  )
}
