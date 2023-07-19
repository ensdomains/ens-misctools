import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useNetwork } from 'wagmi'
import { mainnet, goerli, sepolia } from '@wagmi/core/chains'
import { validChain } from '../lib/utils'

const defaultChains = [mainnet, goerli, sepolia]

export function useChain(provider) {
  const [hasProvider, setHasProvider] = useState(false)
  const [isChainSupported, setChainSupported] = useState(false)
  const [providerChain, setProviderChain] = useState(0)
  const { chain: walletChain, chains: walletChains } = useNetwork()

  provider.getNetwork().then(network => {
    if (network && providerChain !== network.chainId) {
      setProviderChain(network.chainId)
    }
  })

  const chain = walletChain ? walletChain.id : providerChain
  const chains = walletChain ? walletChains : defaultChains

  useEffect(() => {
    setHasProvider(!!chain)
    setChainSupported(validChain(chain, chains))
  }, [chain, chains])

  return {
    chain,
    chains,
    hasProvider,
    isChainSupported
  }
}

export function useDelayedName(name, basePath) {
  const [delayedName, setDelayedName] = useState('')
  const router = useRouter()

  useEffect(() => {
    const delayedNameTimeoutId = setTimeout(() => setDelayedName(name), 500);
    const routerPushTimeoutId = setTimeout(() => {
      if (basePath) {
        routerPush(router, name, basePath)
      }
    }, 2000);

    return () => {
      clearTimeout(delayedNameTimeoutId)
      clearTimeout(routerPushTimeoutId)
    }
  }, [router, name, basePath, setDelayedName]);

  return delayedName
}

function encodeNameForRouter(name) {
  let encodedName = ''
  if (name && name.length > 0) {
    while (name.length > 0 && name.charAt(0) === ' ') {
      name = name.substring(1)
    }
    while (name.length > 0 && name.charAt(name.length - 1) === ' ') {
      name = name.substring(0, name.length - 1)
    }
    if (name !== '..') {
      encodedName = encodeURIComponent(name)
    }
  }

  return {
    name,
    encodedName
  }
}

function routerPush(router, name, basePath) {
  const {
    name: updatedName,
    encodedName
  } = encodeNameForRouter(name)
  
  router.push(basePath + encodedName, undefined, { shallow: true })

  return updatedName
}

export function useRouterPush(basePath, setName, pushImmediately) {
  const [routerQuery, setRouterQuery] = useState('')
  const [initialized, setInitialized] = useState(false)

  const router = useRouter()
  const { name: names } = router.query
  if (names && names.length) {
    const joined = names.join('/')
    if (routerQuery !== joined) {
      setRouterQuery(joined)
    }
  }

  const onRouterQueryInit = useCallback((name) => {
    setName(routerPush(router, name, basePath))
  }, [router, basePath, setName])

  useEffect(() => {
    if (routerQuery && !initialized) {
      setInitialized(true)
      let tname = document.getElementsByName('tname')
      if (tname && tname.length) {
        tname[0].value = routerQuery
      }
      onRouterQueryInit(routerQuery)
    }
  }, [routerQuery, initialized, onRouterQueryInit])

  return (name) => {
    if (pushImmediately) {
      setName(routerPush(router, name, basePath))
    } else {
      setName(encodeNameForRouter(name).name)
    }
  }
}

export function useRouterUpdate(basePath, name, onNameChange) {
  const router = useRouter()

  if (basePath && basePath.charAt(basePath.length - 1) === '/') {
    basePath = basePath.substring(0, basePath.length - 1)
  }

  useEffect(() => {
    const handleRouteChange = (url) => {
      if (url && url.indexOf(basePath) === 0) {
        let routerName = url.substring(basePath.length)
        if (routerName.indexOf('/') === 0) {
          routerName = routerName.substring(1)
        }
        const decodedName = decodeURIComponent(routerName)

        if (name !== decodedName) {
          let tname = document.getElementsByName('tname')
          if (tname && tname.length) {
            tname[0].value = decodedName
            onNameChange(decodedName)
          }
        }
      }
    }
    router.events.on('routeChangeStart', handleRouteChange)

    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [router, basePath, name, onNameChange])
}

const exports = {
  useChain,
  useDelayedName,
  useRouterPush,
  useRouterUpdate
}
export default exports
