import styles from '../styles/RecordItem.module.css'
import {
  Skeleton,
  RecordItem,
  InfoCircleSVG,
  CheckCircleSVG,
  CrossCircleSVG,
  EnsSVG,
  Tag,
  Tooltip,
  Dialog,
  Typography
} from '@ensdomains/thorin'
import { copyToClipBoard, containsIgnoreCase } from '../lib/utils'
import { useState } from 'react'

function RecordItemWithTooltip({
  recordValue,
  tooltipValue,
  ...recordProps
}) {
  return tooltipValue ? (
    <Tooltip
      additionalGap={0}
      content={<div className={styles.recorditemtooltip}>{tooltipValue}</div>}
      mobilePlacement="top"
      mobileWidth={250}
      placement="top"
      targetId="buttonIdTop"
      width={400}
      hideOverflow={true}
    >
      <div><RecordItem {...recordProps}>{recordValue}</RecordItem></div>
    </Tooltip>
  ) : (
    <div><RecordItem {...recordProps}>{recordValue}</RecordItem></div>
  )
}

function TagWithTooltip({
  tagValue,
  tagIcon,
  tooltipValue,
  tooltipDialogValue,
  ...tagProps
}) {
  const [tagDialogOpen, setTagDialogOpen] = useState(false)

  return tooltipValue ? (
    <Tooltip
      additionalGap={0}
      content={<Typography className={styles.recorditemtooltip}>{tooltipValue}</Typography>}
      mobilePlacement="top"
      mobileWidth={250}
      placement="top"
      width={400}
      hideOverflow={true}
    >
      <div>
        <Tag className={tooltipDialogValue ? styles.recorditemtagtooltip : styles.recorditemtag} onClick={tooltipDialogValue ? (() => setTagDialogOpen(true)) : () => {}} {...tagProps}>{tagIcon}{tagValue}</Tag>
        { tooltipDialogValue && (
          <Dialog
            open={tagDialogOpen}
            onDismiss={() => setTagDialogOpen(false)}
            alert={tagProps.colorStyle ? (tagProps.colorStyle.indexOf('red') >= 0 ? 'error' : tagProps.colorStyle.indexOf('yellow') >= 0 ? 'warning' : 'info') : 'info'}
            title={tagValue}
          >
            <div className={styles.recorditemdialog}>
              {tooltipValue}
              <br/><br/>
              {tooltipDialogValue}
            </div>
          </Dialog>
        )}
      </div>
    </Tooltip>
  ) : (
    <Tag className={styles.recorditemtag} {...tagProps}>{tagIcon}{tagValue}</Tag>
  )
}

export default function RecordItemRow({
  loading,
  label,
  subLabel,
  icon,
  link,
  updateNameInput,
  value,
  shortValue,
  tooltipValue,
  secondaryLabel,
  secondarySubLabel,
  secondaryValue,
  secondaryShortValue,
  secondaryIcon,
  secondaryInline,
  tags,
  indent
}) {
  const getIcon = (icon, color) => {
    return icon || (containsIgnoreCase(color, 'red') ? <CrossCircleSVG/> : containsIgnoreCase(color, 'green') ? <CheckCircleSVG/> : <InfoCircleSVG/>)
  }

  return (
    <tr>
      <td style={{paddingLeft: ((indent || 0) * 1.5) + 'rem'}}>
        <Skeleton loading={loading}>
          <RecordItemWithTooltip
            keyLabel={label}
            keySublabel={subLabel}
            icon={icon}
            recordValue={shortValue || value}
            tooltipValue={tooltipValue}
            onClick={link ? (e) => {
              if (updateNameInput) {
                e.preventDefault()
                updateNameInput(link)
              }
            } : async () => {await copyToClipBoard(value)}}
            link={link}
          />
        </Skeleton>
      </td>
      <td>
        <div className={styles.recorditemtagtd}>
          { secondaryValue &&
            <div style={(tags && tags.length > 0 && !loading) ? {paddingRight:'1rem'} : {}}>
              <Skeleton loading={loading}>
                <RecordItem
                  keyLabel={secondaryLabel}
                  keySublabel={secondarySubLabel}
                  icon={secondaryIcon === false ? null : <EnsSVG/>}
                  onClick={async () => {await copyToClipBoard(secondaryValue)}}
                  size="small"
                  {...(secondaryInline === false ? {} : {inline:true})}
                >
                  {secondaryShortValue || secondaryValue}
                </RecordItem>
              </Skeleton>
            </div>
          }
          <div className={styles.recorditemtagdiv}>
            {tags && tags.length > 0 && tags.map((tag) => {
              return (
                <TagWithTooltip
                  key={tag.value}
                  tagValue={tag.value}
                  tagIcon={getIcon(tag.icon, tag.color)}
                  tooltipValue={tag.tooltip}
                  tooltipDialogValue={tag.tooltipDialog}
                  colorStyle={tag.color}
                  size="medium"
                />
              )
            })}
          </div>
        </div>
      </td>
    </tr>
  )
}