export class LayerConfig {
  constructor (n, mua, mus, g, d, z0, z1, cos_crit0, cos_crit1) {
    this.n = n
    this.mua = mua
    this.mus = mus
    this.g = g
    this.d = d

    this.z0 = z0
    this.z1 = z1

    this.cos_crit0 = cos_crit0
    this.cos_crit1 = cos_crit1
  }
}

export class RunConfig {
  constructor (output_file, number_of_photons, dz, dr, nz, nr, na, layers) {
    this.output_file = output_file
    this.number_of_photons = number_of_photons
    this.dz = dz
    this.dr = dr
    this.da = 0.5 * Math.PI / na
    this.nz = nz
    this.nr = nr
    this.na = na
    this.layers = layers

    this.wth = 1e-4
    this.chance = 0.1
  }
}

export class MonteCarloConfig {
  constructor (runs) {
    this.runs = runs
  }
}

export class MonteCarloConfigParser {
  static parseConfigFile (body) {
    const lines = body.split('\n').map(
      line => line.split('#')[0].trim()
    ).filter(
      line => line.length > 0
    )

    let index = 0
    const nextLine = () => {
      if (index >= lines.length) throw new Error('Unexpected end of file')
      return lines[index++]
    }

    const lineArgs = () => {
      const line = nextLine()
      return line.split(/\s+/)
    }

    // eslint-disable-next-line no-unused-vars
    const version = nextLine()

    const number_of_runs = parseInt(nextLine())

    const runs = []

    for (let i = 0; i < number_of_runs; i++) {
      // eslint-disable-next-line no-unused-vars
      const output_file = nextLine()

      const number_of_photons = parseInt(nextLine())
      const [dz, dr] = lineArgs().map(a => parseFloat(a))
      const [nz, nr, na] = lineArgs().map(a => parseInt(a))
      const number_of_layers = parseInt(nextLine())

      const layers = []

      const n_above = parseFloat(nextLine())
      layers.push(new LayerConfig(n_above, 0, 0, 0, 0, 0, 0, 0, 0, 0))

      let z = 0.0
      for (let j = 0; j < number_of_layers; j++) {
        const [n, mua, mus, g, d] = lineArgs().map(a => parseFloat(a))
        layers.push(new LayerConfig(n, mua, mus, g, d, z, z + d, 0, 0))
        z += d
      }

      const n_below = parseFloat(nextLine())
      layers.push(new LayerConfig(n_below, 0, 0, 0, 0, 0, 0))

      for (let j = 1; j < layers.length - 1; j++) {
        const layer = layers[j]
        const layer_above = layers[j - 1]
        const layer_below = layers[j + 1]

        const n1 = layer.n
        const n2 = layer_above.n
        const n3 = layer_below.n

        layer.cos_crit0 = n1 > n2 ? Math.sqrt(1 - n2 * n2 / (n1 * n1)) : 0
        layer.cos_crit1 = n1 > n3 ? Math.sqrt(1 - n3 * n3 / (n1 * n1)) : 0
      }

      runs.push(new RunConfig(output_file, number_of_photons, dz, dr, nz, nr, na, layers))
    }

    return new MonteCarloConfig(runs)
  }
}
