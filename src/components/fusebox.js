import styles from '../styles/Fusebox.module.css'
import {
  Skeleton,
  FlameSVG,
  Tooltip,
  Button,
  Dialog,
  Typography
} from '@ensdomains/thorin'
import { useState } from 'react'

function Fuse({
  name,
  fuse,
  burned,
  isParentControlled,
  loading
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Skeleton loading={loading} className={styles.fuseskeleton}>
      <Tooltip
        additionalGap={0}
        content={<Typography>{fuseInfo[fuse].tooltip}</Typography>}
        mobilePlacement="top"
        mobileWidth={250}
        placement="top"
        targetId="buttonIdTop"
        width={400}
        hideOverflow={true}
      >
        <Button className={styles.fuse} colorStyle={burned ? 'redPrimary' : 'greyPrimary'} onClick={() => setDialogOpen(true)}>
          {burned && <FlameSVG/>}
          {fuseInfo[fuse].name}
        </Button>
      </Tooltip>
      <Dialog
        open={dialogOpen}
        onDismiss={() => setDialogOpen(false)}
        alert='info'
        title={fuseInfo[fuse].name}
      >
        <div className={styles.fusedialog}>
          {name && <>
            This fuse {burned ? <b>has been burned</b> : <>has <b>not yet</b> been burned</>} on the name "{name}".
          </>}
          {isParentControlled && !burned && <>
            <br/><br/>
            This is a <a href="https://support.ens.domains/dev-basics/namewrapper/fuses#parent-controlled-fuses">Parent-Controlled Fuse</a>, so only the parent owner can burn this fuse.
          </>}
          <br/><br/>
          <p>{burned ? <>This means that</> : <>If this fuse is burned,</>} {fuseInfo[fuse].dialog}</p>
        </div>
      </Dialog>
    </Skeleton>
  )
}

function CustomFuses({
  name,
  fuses,
  isParentControlled,
  loading
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const customFusesArray = isParentControlled ? customParentFuses : customOwnerFuses
  const burnedCount = customFusesArray.reduce((acc, curr) => acc + (Math.abs(fuses & curr) === curr ? 1 : 0), 0)
  const totalCount = customFusesArray.length

  return (
    <Skeleton loading={loading} className={styles.fuseskeleton}>
      <Tooltip
        additionalGap={0}
        content={<Typography>{`${burnedCount} of ${totalCount} custom ${isParentControlled ? 'parent' : 'owner'}-controlled fuses burned`}</Typography>}
        mobilePlacement="top"
        mobileWidth={250}
        placement="top"
        targetId="buttonIdTop"
        width={400}
        hideOverflow={true}
      >
        <Button className={styles.fuse} colorStyle={burnedCount === totalCount ? 'redPrimary' : burnedCount === 0 ? 'greyPrimary' : 'orangePrimary'} onClick={() => setDialogOpen(true)}>
          {burnedCount > 0 && <FlameSVG/>}
          Custom: {burnedCount} of {totalCount} burned
        </Button>
      </Tooltip>
      <Dialog
        open={dialogOpen}
        onDismiss={() => setDialogOpen(false)}
        alert='info'
        title={`Custom ${isParentControlled ? 'Parent' : 'Owner'}-Controlled Fuses`}
      >
        <div className={styles.fusedialog}>
          {`${burnedCount} of ${totalCount} custom ${isParentControlled ? 'parent' : 'owner'}-controlled fuses burned`} on the name "{name}"{burnedCount > 0 ? ':' : '.'}          
          {burnedCount > 0 && <>
            <br/><br/>
            <ul>
              {customFusesArray.filter(fuse => Math.abs(fuses & Number(fuse)) === Number(fuse)).map(fuse => (
                <li key={fuse}>• {fuse}</li>
              ))}
            </ul>
          </>}
        </div>
      </Dialog>
    </Skeleton>
  )
}

export default function Fusebox({
  name,
  fuses,
  loading
}) {
  return (
    <div className={styles.fusebox}>
      <div>
        <h2 className={styles.fuseheader}><u>Parent-Controlled Fuses</u></h2>
        <br/>
        {Object.keys(fuseInfo).filter(fuse => fuseInfo[fuse].parentControlled).map((fuse) => (
          <Fuse key={fuse} name={name} fuse={fuse} burned={(fuses & Number(fuse)) === Number(fuse)} isParentControlled={true} loading={loading}/>
        ))}
        <CustomFuses name={name} fuses={fuses} isParentControlled={true} loading={loading}/>
      </div>
      <div>
        <h2 className={styles.fuseheader}><u>Owner-Controlled Fuses</u></h2>
        <br/>
        {Object.keys(fuseInfo).filter(fuse => !fuseInfo[fuse].parentControlled).map((fuse) => (
          <Fuse key={fuse} name={name} fuse={fuse} burned={(fuses & Number(fuse)) === Number(fuse)} loading={loading}/>
        ))}
        <CustomFuses name={name} fuses={fuses} isParentControlled={false} loading={loading}/>
      </div>
    </div>
  )
}

const customParentFuses = [
  0x80000, 0x100000, 0x200000, 0x400000, 0x800000, 0x1000000, 0x2000000,
  0x4000000, 0x8000000, 0x10000000, 0x20000000, 0x40000000, 0x80000000
]

const customOwnerFuses = [
  128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768
]

const fuseInfo = {
  1: {
    name: 'Cannot Unwrap',
    parentControlled: false,
    tooltip: 'Revokes the permission to unwrap this name',
    dialog: <>this name can no longer be unwrapped. The name is now <a href="https://support.ens.domains/dev-basics/namewrapper/states#locked">Locked</a>.
      <br/><br/>
      The owner of the name can burn any Owner-Controlled Fuses, as well as any subname fuses.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  2: {
    name: 'Cannot Burn Fuses',
    parentControlled: false,
    tooltip: 'Revokes the permission to burn additional fuses',
    dialog: <>no further fuses can be burned on the name.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  4: {
    name: 'Cannot Transfer',
    parentControlled: false,
    tooltip: 'Revokes the permission to transfer ownership of this name',
    dialog: <>the name (wrapped NFT) can no longer be transferred.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  8: {
    name: 'Cannot Set Resolver',
    parentControlled: false,
    tooltip: 'Revokes the permission to update the resolver contract for this name',
    dialog: <>the resolver contract for the name can no longer be updated.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  16: {
    name: 'Cannot Set TTL',
    parentControlled: false,
    tooltip: 'Revokes the permission to update the TTL for this name',
    dialog: <>the TTL (client-side caching suggestion) for the name can no longer be updated.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  32: {
    name: 'Cannot Create Subnames',
    parentControlled: false,
    tooltip: 'Revokes the permission to create new subnames under this name',
    dialog: <>new subdomains can no longer be created under this name.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  64: {
    name: 'Cannot Approve',
    parentControlled: false,
    tooltip: 'Revokes the permission to set/update the approved Subname Renewal Manager',
    dialog: <>the approved "subname renewal manager" for the name can no longer be updated.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  65536: {
    name: 'Parent Cannot Control',
    parentControlled: true,
    tooltip: 'Revokes the permission for a parent to control a subname',
    dialog: <>the parent will no longer be able to burn any further fuses, and will no longer be able to replace/delete the child name.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  131072: {
    name: 'Is .eth 2LD',
    parentControlled: true,
    tooltip: 'Special-purpose fuse that is only burned on .eth 2LDs',
    dialog: <>this name is a .eth 2LD (second-level domain)
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
  262144: {
    name: 'Can Extend Expiry',
    parentControlled: true,
    tooltip: 'Grants permission to a subname owner to extend their own subname expiry',
    dialog: <>the owner of the child name will be able to extend their own expiry. Normally, only the parent owner can extend the expiry of a child name.
      <br/><br/>
      More information here: <a href="https://support.ens.domains/dev-basics/namewrapper/fuses">Fuses</a>
    </>,
  },
}
