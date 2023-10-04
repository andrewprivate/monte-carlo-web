export class Go {
  /***********************************************************
     * Compute the specular reflection.
     *
     * If the first layer is a turbid medium, use the Fresnel
     * reflection from the boundary of the first layer as the
     * specular reflectance.
     *
     * If the first layer is glass, multiple reflections in
     * the first layer is considered to get the specular
     * reflectance.
     *
     * The subroutine assumes the Layerspecs array is correctly
     * initialized.
     ****/
  static calculateRSpecular (layers) {
    let r1, r2
    /* direct reflections from the 1st and 2nd layers. */
    let temp

    temp = (layers[0].n - layers[1].n) / (layers[0].n + layers[1].n)
    r1 = temp * temp

    if ((layers[1].mua === 0.0) && (layers[1].mus === 0.0)) { /* glass layer. */
      temp = (layers[1].n - layers[2].n) / (layers[1].n + layers[2].n)
      r2 = temp * temp
      r1 = r1 + (1 - r1) * (1 - r1) * r2 / (1 - r1 * r2)
    }
    return r1
  }

  /***********************************************************
    *   Initialize a photon packet.
    ****/
  static launchPhoton (rSpecular, layers, photon) {
    photon.weight = 1 - rSpecular
    photon.layer = 1
    photon.velocity.z = 1

    // check if the first layer is clear
    if (layers[1].mua === 0.0 && layers[1].mus === 0.0) {
      photon.layer = 2
      photon.position.z = this.layers[2].z0
    }
  }

  /***********************************************************
 *  Choose (sample) a new theta angle for photon propagation
 *  according to the anisotropy.
 *
 *  If anisotropy g is 0, then
 *      cos(theta) = 2*rand-1.
 *  otherwise
 *  sample according to the Henyey-Greenstein function.
 *
 *  Returns the cosine of the polar deflection angle theta.
 ****/
  static spinTheta (random, g) {
    let cost

    if (g === 0.0) {
      cost = 2 * random.random() - 1
    } else {
      const temp = (1 - g * g) / (1 - g + 2 * g * random.random())
      cost = (1 + g * g - temp * temp) / (2 * g)
      if (cost < -1) cost = -1
      else if (cost > 1) cost = 1
    }
    return cost
  }

  /***********************************************************
 *  Choose a new direction for photon propagation by
 *  sampling the polar deflection angle theta and the
 *  azimuthal angle psi.
 *
 *  Note:
 *      theta: 0 - pi so sin(theta) is always positive
 *      feel free to use sqrt() for cos(theta).
 *
 *      psi:   0 - 2pi
 *      for 0-pi  sin(psi) is +
 *      for pi-2pi sin(psi) is -
 ****/
  static spin (random, g, photon) {
    const ux = photon.velocity.x
    const uy = photon.velocity.y
    const uz = photon.velocity.z

    /* cosine and sine of the */
    /* polar deflection angle theta. */
    const cost = this.spinTheta(random, g)
    const sint = Math.sqrt(1.0 - cost * cost)
    /* sqrt() is faster than sin(). */

    /* cosine and sine of the */
    /* azimuthal angle psi. */
    const psi = 2.0 * Math.PI * random.random() /* spin psi 0-2pi. */
    const cosp = Math.cos(psi)
    let sinp

    if (psi < Math.PI) {
      sinp = Math.sqrt(1.0 - cosp * cosp)
    } else {
      /* sqrt() is faster than sin(). */
      sinp = -Math.sqrt(1.0 - cosp * cosp)
    }

    if (Math.abs(uz) > 1.0 - 1.0E-12) { /* normal incident. */
      photon.velocity.x = sint * cosp
      photon.velocity.y = sint * sinp
      photon.velocity.z = cost * Math.sign(uz)
      /* SIGN() is faster than division. */
    } else { /* regular incident. */
      const temp = Math.sqrt(1.0 - uz * uz)
      photon.velocity.x = sint * (ux * uz * cosp - uy * sinp) /
              temp + ux * cost
      photon.velocity.y = sint * (uy * uz * cosp + ux * sinp) /
              temp + uy * cost
      photon.velocity.z = -sint * cosp * temp + uz * cost
    }
  }

  /***********************************************************
     * Move the photon s away in the current layer of medium.
    ****/
  static hop (photon) {
    const s = photon.stepSize

    photon.position.x += s * photon.velocity.x
    photon.position.y += s * photon.velocity.y
    photon.position.z += s * photon.velocity.z
  }

  /***********************************************************
     *  If uz != 0, return the photon step size in glass,
     *  Otherwise, return 0.
     *
     *  The step size is the distance between the current
     *  position and the boundary in the photon direction.
     *
     *  Make sure uz !=0 before calling this function.
     ****/
  static stepSizeInGlass (main, photon) {
    let dl_b /* step size to boundary. */
    const layer = main.layers[photon.layer]
    const uz = photon.velocity.z

    /* Stepsize to the boundary. */
    if (uz > 0.0) {
      dl_b = (layer.z1 - photon.position.z) / uz
    } else if (uz < 0.0) {
      dl_b = (layer.z0 - photon.position.z) / uz
    } else { dl_b = 0.0 }

    photon.stepSize = dl_b
  }

  /**
     * Pick a step size for a photon packet when it is in tissue.
     * If the member sleft is zero, make a new step size with: -Math.log(Math.random()) / (mua + mus).
     * Otherwise, pick up the leftover in sleft.
     */
  static stepSizeInTissue (main, photon) {
    const layer = main.layers[photon.layer]
    const mua = layer.mua
    const mus = layer.mus

    if (photon.stepSizeLeft === 0.0) { // Make a new step.
      let rnd

      do {
        rnd = main.random.random()
      } while (rnd <= 0.0) // Avoid zero.

      photon.stepSize = -Math.log(rnd) / (mua + mus)
    } else { // Take the leftover.
      photon.stepSize = photon.stepSizeLeft / (mua + mus)
      photon.stepSizeLeft = 0.0
    }
  }

  /**
     * Check if the step will hit the boundary.
     * Return true (1) if it hits the boundary.
     * Return false (0) otherwise.
     * If the projected step hits the boundary, update the s and sleft members of Photon_Ptr.
     */
  static hitBoundary (main, photon) {
    let dl_b // Length to boundary.
    const layer = main.layers[photon.layer]
    const uz = photon.velocity.z
    let hit

    // Calculate distance to the boundary.
    if (uz > 0.0) {
      dl_b = (layer.z1 - photon.position.z) / uz // dl_b > 0.
    } else if (uz < 0.0) {
      dl_b = (layer.z0 - photon.position.z) / uz // dl_b > 0.
    }

    if (uz !== 0.0 && photon.stepSize > dl_b) {
      // Not horizontal and crossing.
      const mut = layer.mua + layer.mus

      photon.stepSizeLeft = (photon.stepSize - dl_b) * mut
      photon.stepSize = dl_b
      hit = true
    } else {
      hit = false
    }

    return hit
  }

  /**
     * Drop photon weight inside the tissue (not glass).
     * The photon is assumed not dead.
     * The weight drop is dw = w * mua / (mua + mus).
     * The dropped weight is assigned to the absorption array elements.
     */
  static drop (main, photon, output) {
    const x = photon.position.x
    const y = photon.position.y
    const layer = main.layers[photon.layer]

    // Compute array indices.
    const izd = photon.position.z / main.dz
    const iz = Math.min(Math.floor(izd), main.nz - 1)

    const ird = Math.sqrt(x * x + y * y) / main.dr
    const ir = Math.min(Math.floor(ird), main.nr - 1)

    // Update photon weight.
    const mua = layer.mua
    const mus = layer.mus
    const dwa = (photon.weight * mua) / (mua + mus)
    photon.weight -= dwa

    // Assign dwa to the absorption array element.
    output.a_rz[ir][iz] += dwa
  }

  /***********************************************************
     *  The photon weight is small, and the photon packet tries
     *  to survive a roulette.
     ****/
  static roulette (main, photon) {
    if (photon.weight === 0.0) {
      photon.dead = true
    } else if (main.random.random() < main.survivalChance) { /* survived the roulette. */
      photon.weight /= main.survivalChance
    } else {
      photon.dead = true
    }
  }

  /***********************************************************
     * Compute the Fresnel reflectance.
     *
     * Make sure that the cosine of the incident angle a1
     * is positive, and the case when the angle is greater
     * than the critical angle is ruled out.
     *
     * Avoid trigonometric function operations as much as
     * possible, because they are computation-intensive.
     ****/
  static RFresnel (n1, n2, ca1) {
    let r
    let ca2

    if (n1 === n2) { // matched boundary.
      ca2 = ca1
      r = 0.0
    } else if (ca1 > 1.0 - 1.0E-12) { // normal incident.
      ca2 = ca1
      r = Math.pow((n2 - n1) / (n2 + n1), 2)
    } else if (ca1 < 1.0E-6) { // very slant.
      ca2 = 0.0
      r = 1.0
    } else { // general.
      // sine of the incident and transmission angles.
      const sa1 = Math.sqrt(1 - ca1 * ca1)
      const sa2 = (n1 * sa1) / n2

      if (sa2 >= 1.0) { // double check for total internal reflection.
        ca2 = 0.0
        r = 1.0
      } else {
        // cosines of the sum ap or difference am of the two angles.
        // sines.

        ca2 = Math.sqrt(1 - sa2 * sa2)
        const cap = ca1 * ca2 - sa1 * sa2 // c+ = cc - ss.
        const cam = ca1 * ca2 + sa1 * sa2 // c- = cc + ss.
        const sap = sa1 * ca2 + ca1 * sa2 // s+ = sc + cs.
        const sam = sa1 * ca2 - ca1 * sa2 // s- = sc - cs.

        r = 0.5 * sam * sam * (cam * cam + cap * cap) / (sap * sap * cam * cam) // rearranged for speed.
      }
    }

    return { r, ca2 }
  }

  /***********************************************************
     * Record the photon weight exiting the first layer (uz < 0),
     * no matter whether the layer is glass or not, to the
     * reflection array.
     *
     * Update the photon weight as well.
     ****/
  static recordR (main, Refl, photon, output) {
    const x = photon.position.x
    const y = photon.position.y

    let ir, ia

    const ird = Math.sqrt(x * x + y * y) / main.dr
    if (ird > main.nr - 1) ir = main.nr - 1
    else ir = Math.floor(ird)

    const iad = Math.acos(-photon.velocity.z) / main.da
    if (iad > main.na - 1) ia = main.na - 1
    else ia = Math.floor(iad)

    // Assign photon to the reflection array element.
    output.rd_ra[ir][ia] += photon.weight * (1.0 - Refl)

    photon.weight *= Refl
  }

  /***********************************************************
     *  Record the photon weight exiting the last layer(uz>0),
     *  no matter whether the layer is glass or not, to the
     *  transmittance array.
     *
     *  Update the photon weight as well.
     ****/
  static recordT (main, Refl, photon, output) {
    const x = photon.position.x
    const y = photon.position.y
    let ir, ia // index to r & angle.

    const ird = Math.sqrt(x * x + y * y) / main.dr
    if (ird > main.nr - 1) {
      ir = main.nr - 1
    } else {
      ir = Math.floor(ird)
    }

    const iad = Math.acos(photon.velocity.z) / main.da
    if (iad > main.na - 1) {
      ia = main.na - 1
    } else {
      ia = Math.floor(iad)
    }

    // Assign photon to the transmittance array element.
    output.tt_ra[ir][ia] += photon.weight * (1.0 - Refl)

    photon.weight *= Refl
  }

  /***********************************************************
 *Decide whether the photon will be transmitted or
 *reflected on the upper boundary (uz<0) of the current
 *layer.
 *
 *If "layer" is the first layer, the photon packet will
 *be partially transmitted and partially reflected if
 *PARTIALREFLECTION is set to 1,
 *or the photon packet will be either transmitted or
 *reflected determined statistically if PARTIALREFLECTION
 *is set to 0.
 *
 *Record the transmitted photon weight as reflection.
 *
 *If the "layer" is not the first layer and the photon
 *packet is transmitted, move the photon to "layer-1".
 *
 *Update the photon parmameters.
 ****/
  static crossUpOrNot (main, photon, output) {
    const uz = photon.velocity.z /* z directional cosine. */
    let uz1/* cosines of transmission alpha. always */
    /* positive. */
    let r = 0.0/* reflectance */
    const layer = photon.layer
    const ni = main.layers[layer].n
    const nt = main.layers[layer - 1].n

    /* Get r. */
    if (-uz <= main.layers[layer].cos_crit0) {
      r = 1.0 /* total internal reflection. */
    } else {
      const res = this.RFresnel(ni, nt, -uz)
      r = res.r
      uz1 = res.ca2
    }

    if (main.random.random() > r) { /* transmitted to layer-1. */
      if (layer === 1) {
        photon.velocity.z = -uz1
        this.recordR(main, 0, photon, output)
        photon.dead = true
      } else {
        photon.layer--
        photon.velocity.x *= ni / nt
        photon.velocity.y *= ni / nt
        photon.velocity.z = -uz1
      }
    } else {
      /* reflected. */
      photon.velocity.z = -uz
    }
  }

  /***********************************************************
 * Decide whether the photon will be transmitted  or be
 * reflected on the bottom boundary (uz>0) of the current
 * layer.
 *
 * If the photon is transmitted, move the photon to
 * "layer+1". If "layer" is the last layer, record the
 * transmitted weight as transmittance. See comments for
 * CrossUpOrNot.
 *
 * Update the photon parmameters.
 ****/
  static crossDnOrNot (main, photon, output) {
    const uz = photon.velocity.z /* z directional cosine. */
    let uz1 /* cosines of transmission alpha. */
    let r = 0.0 /* reflectance */
    const layer = photon.layer
    const ni = main.layers[layer].n
    const nt = main.layers[layer + 1].n

    /* Get r. */
    if (uz <= main.layers[layer].cos_crit1) {
      r = 1.0 /* total internal reflection. */
    } else {
      const res = this.RFresnel(ni, nt, uz)
      r = res.r
      uz1 = res.ca2
    }

    if (main.random.random() > r) { /* transmitted to layer+1. */
      if (layer === main.layers.length - 2) {
        photon.velocity.z = uz1
        this.recordT(main, 0, photon, output)
        photon.dead = true
      } else {
        photon.layer++
        photon.velocity.x *= ni / nt
        photon.velocity.y *= ni / nt
        photon.velocity.z = uz1
      }
    } else {
      /* reflected. */
      photon.velocity.z = -uz
    }
  }

  /***********************************************************
 ****/
  static crossOrNot (main, photon, output) {
    if (photon.velocity.z < 0.0) {
      this.crossUpOrNot(main, photon, output)
    } else {
      this.crossDnOrNot(main, photon, output)
    }
  }

  /***********************************************************
     *  Move the photon packet in glass layer.
     *  Horizontal photons are killed because they will
     *  never interact with tissue again.
     ****/
  static hopInGlass (main, photon, output) {
    if (photon.velocity.z === 0.0) {
      /* horizontal photon in glass is killed. */
      photon.dead = true
    } else {
      this.stepSizeInGlass(main, photon)
      this.hop(photon)
      this.crossOrNot(main, photon, output)
    }
  }

  /***********************************************************
 * Set a step size, move the photon, drop some weight,
 * choose a new photon direction for propagation.
 *
 * When a step size is long enough for the photon to
 * hit an interface, this step is divided into two steps.
 * First, move the photon to the boundary free of
 * absorption or scattering, then decide whether the
 * photon is reflected or transmitted.
 * Then move the photon in the current or transmission
 * medium with the unfinished stepsize to interaction
 * site.  If the unfinished stepsize is still too long,
 * repeat the above process.
 ****/
  static hopDropSpinInTissue (main, photon, output) {
    this.stepSizeInTissue(main, photon)

    if (this.hitBoundary(main, photon)) {
      this.hop(photon) /* move to boundary plane. */
      this.crossOrNot(main, photon, output)
    } else {
      this.hop(photon)
      this.drop(main, photon, output)
      this.spin(main.random, main.layers[photon.layer].g, photon)
    }
  }

  static hopDropSpin (main, photon, output) {
    const layers = main.layers
    const layer = layers[photon.layer]

    if (layer.mua === 0.0 && layer.mus === 0.0) {
      /* glass layer. */
      this.hopInGlass(main, photon, output)
    } else {
      this.hopDropSpinInTissue(main, photon, output)
    }

    if (photon.weight < main.weightThreshold && !photon.dead) {
      this.roulette(main, photon)
    }
  }
}
