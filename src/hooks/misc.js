import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useChainId, useChains, useConnections, useDisconnect, useSwitchChain } from 'wagmi'
import { mainnet, goerli, sepolia } from '@wagmi/core/chains'
import { validChain } from '../lib/utils'

const defaultChains = [mainnet, goerli, sepolia]

export function useChain(client) {
  const [hasClient, setHasClient] = useState(false)
  const [isChainSupported, setChainSupported] = useState(false)
  const [clientChain, setClientChain] = useState(0)
  const walletChain = useChainId()
  const walletChains = useChains()

  if (client.chain) {
    if (clientChain !== client.chain.id) {
      setClientChain(client.chain.id)
    }
  } else {
    client.getChainId().then(clientChainId => {
      if (clientChain !== clientChainId) {
        setClientChain(clientChainId)
      }
    })
  }

  const chain = walletChain ? walletChain : clientChain
  const chains = walletChain ? walletChains : defaultChains

  useEffect(() => {
    setHasClient(!!chain)
    setChainSupported(validChain(chain, chains))
  }, [chain, chains])

  return {
    chain,
    chains,
    hasClient,
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

export function useDisconnectToMainnet() {
  const connections = useConnections()

  const { switchChain } = useSwitchChain()

  const onSettled = useCallback(() => {
    if (!connections || connections.length === 0) {
      switchChain({chainId: mainnet.id})
    }
  }, [connections, switchChain])

  // TODO: Is this right?
  const { disconnect } = useDisconnect({
    mutation: { onSettled }
  })
  
  return { disconnect }
}

const exports = {
  useChain,
  useDelayedName,
  useRouterPush,
  useRouterUpdate,
  useDisconnectToMainnet
}
export default exports
