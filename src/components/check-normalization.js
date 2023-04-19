import styles from '../styles/Check.module.css'
import { Heading, Typography } from '@ensdomains/thorin'
import RecordItemRow from './recorditemrow'
import { normalize } from '../lib/utils'

export default function CheckNormalization({
  name
}) {
  const {
    isNameValid,
    isNameNormalized,
    nameNeedsBeautification,
    normalizedName,
    beautifiedName,
    normalizationError
  } = normalize(name)

  const inputTags = []
  const normalizedTags = []
  const beautifiedTags = []

  if (name !== '') {
    if (isNameNormalized) {
      if (nameNeedsBeautification) {
        inputTags.push({
          value: 'Has Beautified Form',
          color: 'blueSecondary',
          tooltip: 'This is the canonical version of the name. However, when displaying to users, you may also use the "beautified" version below.'
        })
      } else {
        inputTags.push({
          value: 'Normalized',
          color: 'greenSecondary'
        })
      }
    } else if (isNameValid) {
      inputTags.push({
        value: 'Not Normalized',
        color: 'yellowSecondary',
        tooltip: 'The input was not in the normalized format. See below for the canonical version of the name.'
      })
    } else {
      inputTags.push({
        value: 'Invalid',
        color: 'redSecondary',
        tooltip: 'The input was not a valid name. See below for normalization errors.'
      })
    }
  }

  if (isNameValid) {
    if (!isNameNormalized && nameNeedsBeautification) {
      normalizedTags.push({
        value: 'Has Beautified Form',
        color: 'blueSecondary',
        tooltip: 'This is the canonical version of the name. However, when displaying to users, you may also use the "beautified" version below.'
      })
    }

    if (nameNeedsBeautification && name === beautifiedName) {
      beautifiedTags.push({
        value: 'Matches Input',
        color: 'greenSecondary'
      })
    }
  }

  return (
    <>
      <Heading>Normalization</Heading>
      <table className={styles.itemTable}>
        <tbody>
          <RecordItemRow label="Input" value={name} tags={inputTags}/>
          { isNameValid && 
            <>
              {!isNameNormalized &&
                <RecordItemRow label="Normalized" value={normalizedName} tags={normalizedTags}/>
              }
              {nameNeedsBeautification &&
                <RecordItemRow label="Beautified" value={beautifiedName} tags={beautifiedTags}/>
              }
            </>
          }
        </tbody>
      </table>
      { name !== '' && !isNameValid &&
        <Typography font="mono">{normalizationError}</Typography>
      }
    </>
  )
}
