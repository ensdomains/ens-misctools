import styles from '../../styles/Check.module.css'
import Head from 'next/head'
import { useState } from 'react'
import { Heading, Input, Card } from '@ensdomains/thorin'
import Header from '../../components/header'
import CheckNormalization from '../../components/check-normalization'
import CheckGeneral from '../../components/check-general'
import CheckWrapper from '../../components/check-wrapper'
import CheckSubnames from '../../components/check-subnames'
import { useRouterPush, useDelayedName } from '../../hooks/misc'
import { Toaster } from 'react-hot-toast'

export default function Check() {
  const [name, setName] = useState('')
  const delayedName = useDelayedName(name)
  const onNameChange = useRouterPush('/check/', setName)

  return (
    <>
      <Head>
        <title>ENS Misc Tools - Check Name</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Quick dashboard for normalization, expiry, parent expiry, resolver, wrapped state, and subnames"/>
        <meta property="og:title" content="ENS Misc Tools - Check Name"/>
        <meta property="og:description" content="Quick dashboard for normalization, expiry, parent expiry, resolver, wrapped state, and subnames"/>
        <meta property="og:image" content="https://ens-misctools.vercel.app/sharing-check.jpg"/>
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:creator" content="@serenae_fansubs"/>
      </Head>
      <Header position="absolute" />
      <div className={styles.container}>
        <div className={styles.containerTop}>
          <Heading
            as="h1"
            level="1"
            align="center"
            style={{ marginBottom: '2rem', lineHeight: '1' }}
          >
            Check an ENS name
          </Heading>
          <Input
            name="tname"
            placeholder="myname.eth"
            spellCheck="false"
            autoCapitalize="none"
            parentStyles={{ backgroundColor: '#fff' }}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <div className={styles.containerMiddle}>
          <div className={styles.containerMiddleCol}>
            <Card>
              <CheckNormalization name={name}/>
              <CheckGeneral name={delayedName}/>
            </Card>
          </div>
          <CheckWrapper name={delayedName}/>
          <CheckSubnames name={delayedName}/>
        </div>
      </div>

      <Toaster position="bottom-center" />
    </>
  )
}
