import styles from '../styles/Home.module.css'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/future/image'
import { Card, Typography } from '@ensdomains/thorin'
import Header from '../components/header'

export default function Home() {
  return (
    <>
      <Head>
        <title>ENS Tools</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Miscellaneous ENS-related tasks"/>
        <meta property="og:title" content="ENS Tools"/>
        <meta property="og:description" content="Miscellaneous ENS-related tasks"/>
        <meta property="og:image" content="https://tools.ens.domains/sharing.jpg"/>
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:creator" content="@serenae_fansubs"/>
      </Head>
      <Header position="absolute" />
      <div className={styles.container}>
        <Card>
          <Link href="/check">
            <a>
              <div><Image src="/sharing-check.png" alt="Check Name" width="350" height="175" priority/></div>
            </a>
          </Link>
          <Typography>Check the current status of an ENS name, including normalization, expiry, resolver, wrapped state, and subnames. If you&apos;re about to buy a name, check this page first!</Typography>
        </Card>
        <Card>
          <Link href="/setprimary">
            <a>
              <div><Image src="/sharing-setprimary.png" alt="Set Primary Name" width="350" height="175" priority/></div>
            </a>
          </Link>
          <Typography>Set your ENS Primary Name. Works when setting on behalf of a contract address you own, or a separate address that you&apos;re an operator for, too!</Typography>
        </Card>
        <Card>
          <Link href="/unwrap">
            <a>
              <div><Image src="/sharing-unwrap.png" alt="Unwrap Name" width="350" height="175" priority/></div>
            </a>
          </Link>
          <Typography>You have &quot;upgraded&quot; a name, or in other words wrapped the name in the ENS Name Wrapper. Use this tool to unwrap that name, if the permission to unwrap has not been revoked.</Typography>
        </Card>
        <Card>
          <Link href="/setprmanager">
            <a>
              <div><Image src="/sharing-setprmanager.png" alt="Set Public Resolver Manager" width="350" height="175" priority/></div>
            </a>
          </Link>
          <Typography>If you are using the latest Public Resolver, then you can use this to approve separate manager accounts that can edit your records, but can&apos;t transfer any names.</Typography>
        </Card>
        <Card>
          <Link href="/setrecords">
            <a>
              <div><Image src="/sharing-setrecords.png" alt="Set Records" width="350" height="175" priority/></div>
            </a>
          </Link>
          <Typography>Set ETH address or text records if you can&apos;t use the official manager app. Useful if you&apos;re using a separate Public Resolver manager for wrapped names.</Typography>
        </Card>
      </div>
    </>
  )
}
