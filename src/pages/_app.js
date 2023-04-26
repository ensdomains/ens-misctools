import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { ThemeProvider } from 'styled-components'
import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { configureChains, createClient, WagmiConfig } from 'wagmi'
import { mainnet, goerli } from '@wagmi/core/chains'
import { infuraProvider } from 'wagmi/providers/infura'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from 'wagmi/providers/public'
import PlausibleProvider from 'next-plausible'

const { chains, provider } = configureChains(
  [mainnet, goerli],
  [
    infuraProvider({ apiKey: process.env.INFURA_API_KEY }),
    alchemyProvider({ apiKey: process.env.ALCHEMY_API_KEY }),
    publicProvider()
  ]
)

const { connectors } = getDefaultWallets({
  appName: 'ENS Tools',
  chains,
})

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
})

const isProdEnv = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={lightTheme}>
      <ThorinGlobalStyles />
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains}>
          <PlausibleProvider
            domain={isProdEnv ? 'tools.ens.domains' : 'ens-misctools.vercel.app'}
            trackLocalhost={!isProdEnv}
            trackOutboundLinks
          >
            <Component {...pageProps} />
          </PlausibleProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </ThemeProvider>
  )
}

export default App
