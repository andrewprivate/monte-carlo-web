import { Vec3d } from '../Vec3d.mjs'

export class PhotonPacket {
  constructor () {
    this.position = new Vec3d(0, 0, 0)
    this.velocity = new Vec3d(0, 0, 0)

    this.weight = 0
    this.stepSize = 0
    this.stepSizeLeft = 0
    this.scatters = 0
    this.layer = 0

    this._dead = false
  }

  get dead () {
    return this._dead
  }

  set dead (value) {
    // throw new Error('PhotonPacket.dead is read-only')
    this._dead = value
  }
}
