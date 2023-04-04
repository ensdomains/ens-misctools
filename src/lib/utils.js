import { keccak_256 } from 'js-sha3'
import { Buffer } from 'buffer'
import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ens_normalize, ens_beautify } from '@adraffy/ens-normalize'
import bigInt from 'big-integer'

export function namehash(name) {
  // Reject empty names:
  var node = '', i
  for (i = 0; i < 32; i++) {
    node += '00'
  }

  if (name) {
    var labels = name.split('.')

    for(i = labels.length - 1; i >= 0; i--) {
      var labelSha = keccak_256(labels[i])
      node = keccak_256(new Buffer(node + labelSha, 'hex'))
    }
  }

  return '0x' + node
}

export function normalize(name) {
  let isNameValid = false
  let isNameNormalized = false
  let nameNeedsBeautification = false
  let normalizedName = ''
  let beautifiedName = ''
  let normalizationError = ''
  let bestDisplayName = name

  try {
    normalizedName = ens_normalize(name)
    bestDisplayName = normalizedName
    isNameValid = true
    isNameNormalized = name === normalizedName
    beautifiedName = ens_beautify(normalizedName)
    nameNeedsBeautification = normalizedName !== beautifiedName
    if (nameNeedsBeautification) {
      bestDisplayName = beautifiedName
    }
  } catch (e) {
    normalizationError = e.toString()
  }

  return {
    isNameValid,
    isNameNormalized,
    nameNeedsBeautification,
    normalizedName,
    beautifiedName,
    normalizationError,
    bestDisplayName
  }
}

export function parseName(name) {
  let node = ''
  let parentName = ''
  let parentNode = ''
  let label = ''
  let labelhash = ''
  let level = 0
  let isETH = false
  let isETH2LD = false
  let eth2LDTokenId = ''
  let wrappedTokenId = ''

  try {
    if (typeof name === 'string') {
      node = namehash(name)

      const labels = name.split('.')
      level = labels.length

      if (level > 0) {
        label = labels[0]
        labelhash = '0x' + keccak_256(label)
        parentName = labels.slice(1).join('.')
        parentNode = namehash(parentName)

        if (labels[level - 1] === 'eth') {
          isETH = true
          if (level === 2) {
            isETH2LD = true
            eth2LDTokenId = bigInt(labelhash.substring(2), 16).toString()
          }
        }
        wrappedTokenId = bigInt(node.substring(2), 16).toString()
      }
    }
  } catch (e) {}

  return {
    node,
    parentName,
    parentNode,
    label,
    labelhash,
    level,
    isETH,
    isETH2LD,
    eth2LDTokenId,
    wrappedTokenId
  }
}

export function containsIgnoreCase(text, value) {
  return text && value && text.toLowerCase().indexOf(value.toLowerCase()) >= 0
}

export function shortAddr(address) {
  if (address && address.length >= 10) {
    address = address.substring(0, 6) + '...' + address.substring(address.length - 4)
  }
  return address
}

export function hasExpiry(expirySeconds) {
  return expirySeconds && expirySeconds > 0 && expirySeconds <= 8640000000000
}

export function parseExpiry(expirySeconds) {
  if (hasExpiry(expirySeconds)) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      minute: 'numeric',
      second: 'numeric',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZoneName: 'short',
    })
    return formatter.format(new Date(expirySeconds * 1000))
  } else {
    return 'None'
  }
}

export async function copyToClipBoard(text) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch (err) {
    console.error('Failed to copy text: ', err)
    toast.error('Failed to copy to clipboard')
  }
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

export function useSetupRouterPush(basePath, setName) {
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

export function useSetupDelayedName(name, setDelayedName) {
  useEffect(() => {
    const timeoutId = setTimeout(() => setDelayedName(name), 500);
    return () => clearTimeout(timeoutId);
  }, [name]);
}

// Testing purposes
export function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
