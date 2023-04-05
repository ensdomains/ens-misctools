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

  const inputTagInfo = {}
  const normalizedTagInfo = {}
  const beautifiedTagInfo = {}

  if (name !== '') {
    if (isNameNormalized) {
      if (nameNeedsBeautification) {
        inputTagInfo.tag = 'Has Beautified Form'
        inputTagInfo.tagColor = 'blueSecondary'
        inputTagInfo.tagTooltip = 'This is the canonical version of the name. However, when displaying to users, you may also use the "beautified" version below.'
      } else {
        inputTagInfo.tag = 'Normalized'
        inputTagInfo.tagColor = 'greenSecondary'
      }
    } else if (isNameValid) {
      inputTagInfo.tag = 'Not Normalized'
      inputTagInfo.tagColor = 'yellowSecondary'
      inputTagInfo.tagTooltip = 'The input was not in the normalized format. See below for the canonical version of the name.'
    } else {
      inputTagInfo.tag = 'Invalid'
      inputTagInfo.tagColor = 'redSecondary'
      inputTagInfo.tagTooltip = 'The input was not a valid name. See below for normalization errors.'
    }
  }

  if (isNameValid) {
    if (!isNameNormalized && nameNeedsBeautification) {
      normalizedTagInfo.tag = 'Has Beautified Form'
      normalizedTagInfo.tagColor = 'blueSecondary'
      normalizedTagInfo.tagTooltip = 'This is the canonical version of the name. However, when displaying to users, you may also use the "beautified" version below.'
    }

    if (nameNeedsBeautification && name === beautifiedName) {
      beautifiedTagInfo.tag = 'Matches Input'
      beautifiedTagInfo.tagColor = 'greenSecondary'
    }
  }

  return (
    <>
      <Heading>Normalization</Heading>
      <table className={styles.itemTable}>
        <tbody>
          <RecordItemRow label="Input" value={name} {...inputTagInfo}/>
          { isNameValid && 
            <>
              {!isNameNormalized &&
                <RecordItemRow label="Normalized" value={normalizedName} {...normalizedTagInfo}/>
              }
              {nameNeedsBeautification &&
                <RecordItemRow label="Beautified" value={beautifiedName} {...beautifiedTagInfo}/>
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
