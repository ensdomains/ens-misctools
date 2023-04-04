import styles from '../styles/Home.module.css'
import Head from 'next/head'
import Link from 'next/link'
import { Card, Typography, Button } from '@ensdomains/thorin'
import Header from '../components/header'

export default function Home() {
  return (
    <>
      <Head>
        <title>ENS Misc Tools</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Miscellaneous tasks that aren't yet in the ENS Manager App"/>
        <meta property="og:title" content="ENS Misc Tools"/>
        <meta property="og:description" content="Miscellaneous tasks that aren't yet in the ENS Manager App"/>
        <meta property="og:image" content="/sharing.png"/>
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:creator" content="@serenae_fansubs"/>
      </Head>
      <Header position="absolute" />
      <div className={styles.container}>
        <Card>
          <Link href="/check">
            <a>
              <Button>Check Name</Button>
            </a>
          </Link>
          <br/>
          <Typography>Check the current status of an ENS name, including normalization, expiry, resolver, wrapped state, and subnames. If you&apos;re about to buy a name, check this page first!</Typography>
        </Card>
        <Card>
          <Link href="/unwrap">
            <a>
              <Button>Unwrap Name</Button>
            </a>
          </Link>
          <br/>
          <Typography>You have &quot;upgraded&quot; a name, or in other words wrapped the name in the ENS Name Wrapper. Use this tool to unwrap that name, if the permission to unwrap has not been revoked.</Typography>
        </Card>
      </div>
    </>
  )
}
