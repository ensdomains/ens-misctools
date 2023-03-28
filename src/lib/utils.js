import { keccak_256 } from 'js-sha3'
import { Buffer } from 'buffer';

export function namehash (name) {
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