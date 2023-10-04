export class OutputCalc {
  static sum2d (matrix) {
    const sumAxis0 = new Float32Array(matrix[0].length)
    const sumAxis1 = new Float32Array(matrix.length)
    let sum = 0

    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i]
      for (let j = 0; j < row.length; j++) {
        const val = row[j]
        sumAxis0[j] += val
        sumAxis1[i] += val
        sum += val
      }
    }

    return {
      sumAxis0,
      sumAxis1,
      sum
    }
  }

  static sum2dA (runConfig, a_rz) {
    const a_z = new Float32Array(runConfig.nz)
    const a_l = new Float32Array(runConfig.layers.length - 2)
    let a = 0

    for (let iz = 0; iz < runConfig.nz; iz++) {
      const layer = this.izToLayer(iz, runConfig.dz, runConfig.layers)
      for (let j = 0; j < runConfig.nr; j++) {
        const val = a_rz[j][iz]
        a_z[iz] += val
        a_l[layer - 1] += val
        a += val
      }
    }

    return {
      a_z,
      a_l,
      a
    }
  }

  static izToLayer (iz, dz, layers) {
    let i = 1
    const num_layers = layers.length - 2
    while ((iz + 0.5) * dz >= layers[i].z1 && i < num_layers) {
      i++
    }

    return i
  }

  static scaleRdTt (runConfig, results) {
    const nr = runConfig.nr
    const na = runConfig.na
    const dr = runConfig.dr
    const da = runConfig.da
    const n_photons = runConfig.number_of_photons
    let scale1, scale2

    scale1 = 4.0 * Math.PI * Math.PI * dr * dr * Math.sin(da / 2.0) * n_photons
    for (let ir = 0; ir < nr; ir++) {
      for (let ia = 0; ia < na; ia++) {
        scale2 = 1.0 / ((ir + 0.5) * Math.sin(2.0 * (ia + 0.5) * da) * scale1)
        results.rd_ra[ir][ia] *= scale2
        results.tt_ra[ir][ia] *= scale2
      }
    }

    scale1 = 2.0 * Math.PI * dr * dr * n_photons
    for (let ir = 0; ir < nr; ir++) {
      scale2 = 1.0 / ((ir + 0.5) * scale1)
      results.rd_r[ir] *= scale2
      results.tt_r[ir] *= scale2
    }

    scale1 = 2.0 * Math.PI * da * n_photons
    for (let ia = 0; ia < na; ia++) {
      scale2 = 1.0 / (Math.sin((ia + 0.5) * da) * scale1)
      results.rd_a[ia] *= scale2
      results.tt_a[ia] *= scale2
    }

    scale2 = 1.0 / n_photons
    results.rd *= scale2
    results.tt *= scale2
  }

  static scaleA (runConfig, results) {
    const nr = runConfig.nr
    const nz = runConfig.nz
    const dr = runConfig.dr
    const dz = runConfig.dz
    const n_photons = runConfig.number_of_photons
    let scale1

    scale1 = 2.0 * Math.PI * dr * dr * dz * n_photons
    for (let iz = 0; iz < nz; iz++) {
      for (let ir = 0; ir < nr; ir++) {
        results.a_rz[ir][iz] /= (ir + 0.5) * scale1
      }
    }

    scale1 = 1.0 / (dz * n_photons)
    for (let iz = 0; iz < nz; iz++) {
      results.a_z[iz] *= scale1
    }

    scale1 = 1.0 / n_photons
    for (let il = 0; il < runConfig.layers.length - 2; il++) {
      results.a_l[il] *= scale1
    }

    results.a *= scale1
  }

  static sumScaleResult (runConfig, results) {
    const { sumAxis0: rd_a, sumAxis1: rd_r, sum: rd } = OutputCalc.sum2d(results.rd_ra)
    const { sumAxis0: tt_a, sumAxis1: tt_r, sum: tt } = OutputCalc.sum2d(results.tt_ra)
    const { a_z, a_l, a } = OutputCalc.sum2dA(runConfig, results.a_rz)

    results.rd_a = rd_a
    results.rd_r = rd_r
    results.rd = rd
    results.tt_a = tt_a
    results.tt_r = tt_r
    results.tt = tt
    results.a_z = a_z
    results.a_l = a_l
    results.a = a

    this.scaleRdTt(runConfig, results)
    this.scaleA(runConfig, results)

    // calculate fluence
    const fluence = new Float32Array(runConfig.nz)
    for (let iz = 0; iz < runConfig.nz; iz++) {
      const layer = this.izToLayer(iz, runConfig.dz, runConfig.layers)
      if (runConfig.layers[layer].mua === 0) {
        fluence[iz] = 0
        continue
      }

      fluence[iz] = results.a_z[iz] / runConfig.layers[layer].mua
    }

    results.fluence = fluence
    results.config = runConfig
  }
}
