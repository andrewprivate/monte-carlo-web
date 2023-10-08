export class PhotonPacket {
  constructor () {
    this.x = 0
    this.y = 0
    this.z = 0
    this.r = 0

    this.ux = 0
    this.uy = 0
    this.uz = 0

    this.weight = 0
    this.stepSize = 0
    this.stepSizeLeft = 0
    this.scatters = 0
    this.layer = 0

    this.layerMua = 0
    this.layerMus = 0
    this.layerZ0 = 0
    this.layerZ1 = 0

    this.dead = false
  }
}
