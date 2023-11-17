import { WorkerMessageHandler } from './WorkerMessageHander.mjs'
import init, { Simulation } from '../rust/pkg/MonteCarloRS.js'

const messageHandler = new WorkerMessageHandler(self)
let monteCarloSimulator

messageHandler.on('config', async (config) => {
  await init()

  if (monteCarloSimulator) {
    monteCarloSimulator.free()
  }

  monteCarloSimulator = Simulation.new()

  const {
    runConfig,
    seed
  } = config

  monteCarloSimulator.configure_run(
    runConfig.incident_angle,
    runConfig.dz,
    runConfig.dr,
    runConfig.da,
    runConfig.nz,
    runConfig.nr,
    runConfig.na,
    runConfig.nt,
    runConfig.wth,
    runConfig.chance
  )
  monteCarloSimulator.set_seed(BigInt(seed))

  runConfig.layers.forEach(layer => {
    monteCarloSimulator.add_layer(layer.n, layer.mua, layer.mus, layer.g, layer.d)
  })

  monteCarloSimulator.initialize()
})

messageHandler.on('launch', (numPhotons) => {
  monteCarloSimulator.launch_photons(numPhotons)
})

messageHandler.on('sendresult', () => {
  const results = {
    tt_ra: monteCarloSimulator.get_tt_ra(),
    rd_ra: monteCarloSimulator.get_rd_ra(),
    rd_x: monteCarloSimulator.get_rd_x(),
    a_rz: monteCarloSimulator.get_a_rz(),
    w_txz: monteCarloSimulator.get_w_txz(),
    tt_unscattered: monteCarloSimulator.get_tt_unscattered(),
    rd_unscattered: monteCarloSimulator.get_rd_unscattered()
  }

  return results
})
