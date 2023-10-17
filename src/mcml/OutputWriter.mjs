export class OutputWriter {
  constructor () {
    this.lines = []
  }

  numToSci (val) {
    return val.toExponential(4).replace('e', 'E')
  }

  build () {
    return this.lines.map(o => {
      return typeof o === 'number' ? ('\t' + this.numToSci(o)) : o
    }).join('\n')
  }

  writeLine (line) {
    this.lines.push(line)
  }

  writeResult (runConfig, result) {
    this.writeVersion('A1')

    this.writeLine(`# Simulation time: ${result.simulationTime.toFixed(3)} seconds`)
    this.writeInputParameters(runConfig)
    this.writeRAT(result)

    this.writeALayer(result)
    this.writeAZ(result)
    this.writeRdR(result)
    this.writeRdA(result)
    this.writeTtR(result)
    this.writeTtA(result)

    this.writeARZ(result)
    this.writeRdRA(result)
    this.writeTtRA(result)
  }

  writeALayer (results) {
    this.writeLine('A_l #Absorption as a function of layer. [-]')
    for (let i = 0; i < results.a_l.length; i++) {
      this.writeLine(results.a_l[i])
    }
    this.writeLine('')
  }

  writeAZ (results) {
    this.writeLine('A_z #A[0], [1],..A[nz-1]. [1/cm]')
    for (let i = 0; i < results.a_z.length; i++) {
      this.writeLine(results.a_z[i])
    }
    this.writeLine('')
  }

  writeRdR (results) {
    this.writeLine('Rd_r #Rd[0], [1],..Rd[nr-1]. [1/cm2]')
    for (let i = 0; i < results.rd_r.length; i++) {
      this.writeLine(results.rd_r[i])
    }
    this.writeLine('')
  }

  writeRdA (results) {
    this.writeLine('Rd_a #Rd[0], [1],..Rd[na-1]. [sr-1]')
    for (let i = 0; i < results.rd_a.length; i++) {
      this.writeLine(results.rd_a[i])
    }
    this.writeLine('')
  }

  writeTtR (results) {
    this.writeLine('Tt_r #Tt[0], [1],..Tt[nr-1]. [1/cm2]')
    for (let i = 0; i < results.tt_r.length; i++) {
      this.writeLine(results.tt_r[i])
    }
    this.writeLine('')
  }

  writeTtA (results) {
    this.writeLine('Tt_a #Tt[0], [1],..Tt[na-1]. [sr-1]')
    for (let i = 0; i < results.tt_a.length; i++) {
      this.writeLine(results.tt_a[i])
    }
    this.writeLine('')
  }

  writeMatrix (matrix) {
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i]
      const line = []
      for (let j = 0; j < row.length; j++) {
        line.push(this.numToSci(row[j]))
      }
      this.writeLine(line.join('\t'))
    }
  }

  writeARZ (results) {
    this.writeLine('#A[r][z]. [1/cm3]')
    this.writeLine('# A[0][0], [0][1],..[0][nz-1]')
    this.writeLine('# A[1][0], [1][1],..[1][nz-1]')
    this.writeLine('# ...')
    this.writeLine('# A[nr-1][0], [nr-1][1],..[nr-1][nz-1]')
    this.writeLine('A_rz')

    this.writeMatrix(results.a_rz)

    this.writeLine('')
  }

  writeRdRA (results) {
    this.writeLine('#Rd[r][angle]. [1/(cm2sr)].')
    this.writeLine('# Rd[0][0], [0][1],..[0][na-1]')
    this.writeLine('# Rd[1][0], [1][1],..[1][na-1]')
    this.writeLine('# ...')
    this.writeLine('# Rd[nr-1][0], [nr-1][1],..[nr-1][na-1]')
    this.writeLine('Rd_ra')

    this.writeMatrix(results.rd_ra)

    this.writeLine('')
  }

  writeTtRA (results) {
    this.writeLine('#Tt[r][angle]. [1/(cm2sr)].')
    this.writeLine('# Tt[0][0], [0][1],..[0][na-1]')
    this.writeLine('# Tt[1][0], [1][1],..[1][na-1]')
    this.writeLine('# ...')
    this.writeLine('# Tt[nr-1][0], [nr-1][1],..[nr-1][na-1]')
    this.writeLine('Tt_ra')

    this.writeMatrix(results.tt_ra)

    this.writeLine('')
  }

  writeRAT (result) {
    this.writeLine('RAT #Reflectance, absorption, transmission.')
    this.writeLine(`${result.rsp.toFixed(6)} \t# Specular reflectance [-]`)
    this.writeLine(`${result.rd.toFixed(6)} \t# Diffuse reflectance [-]`)
    this.writeLine(`# ${(result.rd + result.rsp).toFixed(6)} \t# Total reflectance [-]`)
    this.writeLine(`${result.a.toFixed(6)} \t# Absorbed fraction [-]`)
    this.writeLine(`# ${result.tt_unscattered.toFixed(6)} \t# Specular Transmittance [-]`)
    this.writeLine(`# ${result.tt.toFixed(6)} \t# Diffuse Transmittance [-]`)
    this.writeLine(`${(result.tt + result.tt_unscattered).toFixed(6)} \t# Total Transmittance [-]\n`)
  }

  writeInputParameters (runConfig) {
    this.writeLine('InParm\t\t\t\t\t# Input parameters. cm is used.')
    this.writeLine(`${runConfig.output_file.split(/\s/)[0]}\t\t\t\t# output file name, ASCII.`)
    this.writeLine(`${runConfig.number_of_photons}\t\t\t\t\t# No. of photons`)

    this.writeLine(`${runConfig.dz}\t${runConfig.dr}\t\t\t\t# dz, dr [cm]`)
    this.writeLine(`${runConfig.nz}\t${runConfig.nr}\t${runConfig.na}\t${runConfig.nt}\t\t# No. of dz, dr, da, & t.\n`)

    this.writeLine(`${runConfig.layers.length - 2}\t\t\t\t\t# Number of layers`)
    this.writeLine('#n\tmua\tmus\tg\td\t# One line for each layer')
    this.writeLine(`${runConfig.layers[0].n}\t\t\t\t\t# n for medium above`)

    for (let i = 1; i < runConfig.layers.length - 1; i++) {
      const s = runConfig.layers[i]
      this.writeLine(`${s.n}\t${s.mua}\t${s.mus}\t${s.g}\t${s.z1 - s.z0}\t# layer ${i}`)
    }

    this.writeLine(`${runConfig.layers[runConfig.layers.length - 1].n} \t\t\t\t\t# n for medium below\n`)
  }

  writeVersion (version) {
    this.writeLine(`${version} \t# Version number of the file format.\n`)
    this.writeLine('####\n# Data categories include:')
    this.writeLine('# InParm, RAT,')
    this.writeLine('# A_l, A_z, Rd_r, Rd_a, Tt_r, Tt_a,')
    this.writeLine('# A_rz, Rd_ra, Tt_ra\n####\n')
  }
}
