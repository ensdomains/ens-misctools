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
      targetId="buttonIdTop"
      width={400}
      hideOverflow={true}
    >
      <div>
        <Tag className={tooltipDialogValue ? styles.recorditemtagtooltip : styles.recorditemtag} onClick={tooltipDialogValue && (() => setTagDialogOpen(true))} {...tagProps}>{tagIcon}{tagValue}</Tag>
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
  value,
  shortValue,
  tooltipValue,
  secondaryLabel,
  secondaryValue,
  secondaryIcon,
  tag,
  tagColor,
  tagIcon,
  tagTooltip,
  tagTooltipDialog,
  tag2,
  tag2Color,
  tag2Icon,
  tag2Tooltip,
  tag2TooltipDialog
}) {
  let tIcon = tagIcon
  if (!tIcon) {
    tIcon = containsIgnoreCase(tagColor, 'red') ? <CrossCircleSVG/> : containsIgnoreCase(tagColor, 'green') ? <CheckCircleSVG/> : <InfoCircleSVG/>
  }
  let t2Icon = tag2Icon
  if (!t2Icon) {
    t2Icon = containsIgnoreCase(tag2Color, 'red') ? <CrossCircleSVG/> : containsIgnoreCase(tag2Color, 'green') ? <CheckCircleSVG/> : <InfoCircleSVG/>
  }

  return (
    <tr>
      <td>
        <Skeleton loading={loading}>
          <RecordItemWithTooltip
            keyLabel={label}
            keySublabel={subLabel}
            icon={icon}
            recordValue={shortValue || value}
            tooltipValue={tooltipValue}
            onClick={async () => {await copyToClipBoard(value)}}
          />
        </Skeleton>
      </td>
      <td>
        <div className={styles.recorditemtagtd}>
          { secondaryValue &&
            <div style={(tag && !loading) ? {paddingRight:'1rem'} : {}}>
              <Skeleton loading={loading}>
                <RecordItem
                  keyLabel={secondaryLabel}
                  icon={secondaryIcon || <EnsSVG/>}
                  onClick={async () => {await copyToClipBoard(secondaryValue)}}
                  size="small"
                  inline
                >
                  {secondaryValue}
                </RecordItem>
              </Skeleton>
            </div>
          }
          <div className={styles.recorditemtagdiv}>
            {tag && !loading &&
              <TagWithTooltip
                tagValue={tag}
                tagIcon={tIcon}
                tooltipValue={tagTooltip}
                tooltipDialogValue={tagTooltipDialog}
                colorStyle={tagColor}
                size="medium"
              />
            }
            {tag2 && !loading &&
              <TagWithTooltip
                tagValue={tag2}
                tagIcon={t2Icon}
                tooltipValue={tag2Tooltip}
                tooltipDialogValue={tag2TooltipDialog}
                colorStyle={tag2Color}
                size="medium"
              />
            }
          </div>
        </div>
      </td>
    </tr>
  )
}