import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useNetwork } from 'wagmi'
import { mainnet, goerli } from '@wagmi/core/chains'

export function useChain(provider) {
  const [providerChain, setProviderChain] = useState(0)
  const { chain: connectedChain, chains } = useNetwork()

  provider.getNetwork().then(network => {
    if (network && providerChain !== network.chainId) {
      setProviderChain(network.chainId)
    }
  })

  if (connectedChain) {
    return {
      chain: connectedChain.id,
      chains
    }
  } else {
    return {
      chain: providerChain,
      chains: [mainnet, goerli]
    }
  }
}

export function useDelayedName(name, setDelayedName) {
  useEffect(() => {
    const timeoutId = setTimeout(() => setDelayedName(name), 500);
    return () => clearTimeout(timeoutId);
  }, [name]);
}

function routerPush(router, name, basePath) {
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
  
  router.push(basePath + encodedName, undefined, { shallow: true })

  return name
}

export function useRouterPush(basePath, setName) {
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

  const onNameChange = (name) => {
    setName(routerPush(router, name, basePath))
  }

  useEffect(() => {
    if (routerQuery && !initialized) {
      setInitialized(true)
      let tname = document.getElementsByName('tname')
      if (tname && tname.length) {
        tname[0].value = routerQuery
      }
      onNameChange(routerQuery)
    }
  }, [routerQuery])

  return onNameChange
}

const exports = {
  useChain,
  useDelayedName,
  useRouterPush
}
export default exports
