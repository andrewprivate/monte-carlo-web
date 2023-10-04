import { Go } from './mcml/Go.mjs'
import { PhotonPacket } from './mcml/PhotonPacket.mjs'
import { MersenneTwister } from './mcml/Twister.mjs'

export class MonteCarlo {
  constructor (runConfig, seed) {
    this.layers = runConfig.layers
    this.dz = runConfig.dz
    this.dr = runConfig.dr
    this.da = runConfig.da
    this.nz = runConfig.nz
    this.nr = runConfig.nr
    this.na = runConfig.na
    this.survivalChance = runConfig.chance
    this.weightThreshold = runConfig.wth

    this.rSpecular = Go.calculateRSpecular(this.layers)
    this.random = new MersenneTwister(seed || 0)

    this.result = {}
    this.result.tt_ra = new Array(this.nr)
    this.result.rd_ra = new Array(this.nr)
    this.result.a_rz = new Array(this.nr)

    for (let i = 0; i < this.nr; i++) {
      this.result.tt_ra[i] = new Float32Array(this.na)
      this.result.rd_ra[i] = new Float32Array(this.na)
      this.result.a_rz[i] = new Float32Array(this.nz)
    }
  }

  launchPhoton () {
    const photon = new PhotonPacket()

    // Initialize the photon packet.
    Go.launchPhoton(this.rSpecular, this.layers, photon)

    while (!photon.dead) {
      Go.hopDropSpin(this, photon, this.result)
    }
  }
}
