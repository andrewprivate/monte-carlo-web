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
}
