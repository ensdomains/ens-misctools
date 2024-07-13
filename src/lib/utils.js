import { keccak_256 } from 'js-sha3'
import { Buffer } from 'buffer'
import { ens_normalize, ens_beautify } from '@adraffy/ens-normalize'
import { AddressZero } from './constants'
import dnsPacket from 'dns-packet'
import bigInt from 'big-integer'
import toast from 'react-hot-toast'
import * as viem from 'viem'
import { mainnet, goerli, sepolia, holesky } from '@wagmi/core/chains'

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
      node = keccak_256(Buffer.from(node + labelSha, 'hex'))
    }
  }

  return '0x' + node
}

export function dnsEncode(name, format) {
  const dnsBytes = dnsPacket.name.encode(name)
  return format === 'hex' ? '0x' + dnsBytes.toString('hex') : dnsBytes
}

export function encodeMethodData(method, data, format) {
  const methodID = Buffer.from(keccak_256(method).substring(0, 8), 'hex')
  if (data && Object.prototype.toString.call(data) === '[object String]') {
    if (data.indexOf('0x') === 0) {
      data = data.substring(2)
    }
    data = Buffer.from(data, 'hex')
  }
  const result = Buffer.concat([methodID, data])
  return format === 'hex' ? '0x' + result.toString('hex') : result
}

export function contractInfo(contract, functionName, ...args) {
  return {
    address: contract.address,
    abi: contract.abi,
    functionName,
    args
  }
}

export function readContract(client, contract, functionName, ...args) {
  return client.readContract(contractInfo(contract, functionName, ...args))
}

export function universalResolveAddrInfo(universalResolver, name, node) {
  if (!node) {
    node = parseName(name).node
  }
  return contractInfo(universalResolver, 'resolve', dnsEncode(name, 'hex'), encodeMethodData('addr(bytes32)', node, 'hex'))
}

export function universalResolveAddr(client, universalResolver, name, node) {
  return client.readContract(universalResolveAddrInfo(universalResolver, name, node)).catch(e => e)
}

export function universalResolveAvatarInfo(universalResolver, name, node) {
  return universalResolveTextRecordInfo(universalResolver, name, node, 'avatar')
}

export function universalResolveAvatar(client, universalResolver, name, node) {
  return universalResolveTextRecord(client, universalResolver, name, node, 'avatar')
}

export function universalResolveTextRecordInfo(universalResolver, name, node, key) {
  if (!node) {
    node = parseName(name).node
  }

  const data = viem.encodeAbiParameters([{name: 'node', type: 'bytes32'}, {name: 'key', type: 'string'}], [node, key])

  return contractInfo(universalResolver, 'resolve', dnsEncode(name, 'hex'), encodeMethodData('text(bytes32,string)', data, 'hex'))
}

export function universalResolveTextRecord(client, universalResolver, name, node, key) {
  return client.readContract(universalResolveTextRecordInfo(universalResolver, name, node, key)).catch(e => e)
}

export function universalResolvePrimaryNameInfo(universalResolver, address) {
  const reverseName = dnsEncode(address.toLowerCase().substring(2) + '.addr.reverse', 'hex')
  return contractInfo(universalResolver, 'reverse', reverseName)
}

export function universalResolvePrimaryName(client, universalResolver, address) {
  return client.readContract(universalResolvePrimaryNameInfo(universalResolver, address)).catch(e => e)
}

export function getUniversalResolverPrimaryName(address, result) {
  if (result && !(result instanceof Error) && result.length > 1 && getAddress(result[1]) === getAddress(address)) {
    return normalize(result[0]).bestDisplayName
  }
  return ''
}

export function convertToAddress(bytes) {
  try {
    // Ignore arbitrary bytes that may incorrectly be returned by a resolver
    if (bytes && typeof bytes === 'string' && bytes.indexOf('0x') === 0 && bytes.length > 66) { 
      return ''
    }
    return viem.decodeAbiParameters([{type: 'address'}], bytes)[0]
  } catch (e) {
    console.error(e)
    return ''
  }
}

export function getAddress(address) {
  if (address) {
    try {
      address = viem.getAddress(address)
    } catch (e) {}
  }
  return address
}

export function isAddress(address) {
  return viem.isAddress(address)
}

export function isValidAddress(address) {
  return isAddress(address) && address != AddressZero
}

export function getMulticallResult(result, throwIfError) {
  if ((!result && typeof result !== 'boolean') || result instanceof Error || (result.status && result.status !== 'success')) {
    if (!(result instanceof Error)) {
      if (!result || !result.status) {
        result = new Error(`Unknown error occurred. Result: ${result}`)
      } else if (result.error instanceof Error) {
        result = result.error
      } else {
        result = new Error(`Unknown error occurred. Status: ${result.status}, Error: ${result.error}`)
      }
    }
    if (throwIfError) {
      throw result
    } else {
      return result
    }
  }
  return result.result || result
}

export function normalize(name) {
  let isNameValid = false
  let isNameNormalized = false
  let nameNeedsBeautification = false
  let normalizedName = ''
  let beautifiedName = ''
  let normalizationError = ''
  let bestDisplayName = name

  if (name) {
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
  let nodeDecimal = ''
  let parentName = ''
  let parentNode = ''
  let label = ''
  let labelhash = ''
  let labelhashDecimal = ''
  let level = 0
  let isETH = false
  let isETH2LD = false
  let eth2LDTokenId = ''
  let wrappedTokenId = ''

  try {
    if (typeof name === 'string') {
      node = namehash(name)
      nodeDecimal = bigInt(node.substring(2), 16).toString()

      const labels = name.split('.')
      level = labels.length

      if (level > 0) {
        label = labels[0]
        labelhash = '0x' + keccak_256(label)
        labelhashDecimal = bigInt(labelhash.substring(2), 16).toString()
        parentName = labels.slice(1).join('.')
        parentNode = namehash(parentName)

        if (labels[level - 1] === 'eth') {
          isETH = true
          if (level === 2) {
            isETH2LD = true
            eth2LDTokenId = labelhashDecimal
          }
        }
        wrappedTokenId = nodeDecimal
      }
    }
  } catch (e) {}

  return {
    node,
    nodeDecimal,
    parentName,
    parentNode,
    label,
    labelhash,
    labelhashDecimal,
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

export function abbreviatedValue(value) {
  if (value) {
    if (value.indexOf('0x') === 0) {
      value = abbreviatedAddr(value)
    } else if (value.length > 8) {
      value = value.substring(0, 4) + '...' + value.substring(value.length - 4)
    }
  }
  return value
}

export function abbreviatedAddr(address) {
  if (address && address.length > 10) {
    address = address.substring(0, 6) + '...' + address.substring(address.length - 4)
  }
  return address
}

export function hasExpiry(expirySeconds) {
  return expirySeconds && expirySeconds > 0n && expirySeconds <= 8640000000000n
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
    return formatter.format(new Date(Number(expirySeconds * 1000n)))
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

export function getChainName(chainId) {
  if (chainId === mainnet.id) {
    return mainnet.name
  } else if (chainId === goerli.id) {
    return goerli.name
  } else if (chainId === sepolia.id) {
    return sepolia.name
  } else if (chainId === holesky.id) {
    return holesky.name
  }
}

export function validChain(chain, chains) {
  return chains.some((c) => c.id === chain)
}

// Testing purposes
export function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
