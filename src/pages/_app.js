import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { ThemeProvider } from 'styled-components'
import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { configureChains, createClient, WagmiConfig } from 'wagmi'
import { mainnet, goerli } from '@wagmi/core/chains'
import { infuraProvider } from 'wagmi/providers/infura'
import { publicProvider } from 'wagmi/providers/public'
import PlausibleProvider from 'next-plausible'

const { chains, provider } = configureChains(
  [mainnet, goerli],
  [infuraProvider({}), publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: 'ENS Misc Tools',
  chains,
})

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
})

// const isProdEnv = process.env.NEXT_PUBLIC_VERCEL_ENV == 'production'

function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={lightTheme}>
      <ThorinGlobalStyles />
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains}>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </WagmiConfig>
    </ThemeProvider>
  )
}

export default App
