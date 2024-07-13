import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { ThemeProvider } from 'styled-components'
import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { WagmiProvider, http } from 'wagmi'
import { mainnet, goerli, sepolia, holesky } from '@wagmi/core/chains'
import PlausibleProvider from 'next-plausible'

const config = getDefaultConfig({
  appName: 'ENS Tools',
  projectId: '425cdecf2ed0ec72984a703069b4bac9',
  ssr: true,
  chains: [mainnet, goerli, sepolia, holesky],
  transports: {
    [mainnet.id]: http(),
    [goerli.id]: http(),
    [sepolia.id]: http(),
    [holesky.id]: http(),
  },
})

const queryClient = new QueryClient()

const isProdEnv = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={lightTheme}>
      <ThorinGlobalStyles />
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <PlausibleProvider
              domain={isProdEnv ? 'tools.ens.domains' : 'ens-misctools.vercel.app'}
              trackLocalhost={!isProdEnv}
              trackOutboundLinks
            >
              <Component {...pageProps} />
            </PlausibleProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}

export default App
