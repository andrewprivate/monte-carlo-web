import { MonteCarlo } from './MonteCarlo.mjs'
import { WorkerMessageHandler } from './WorkerMessageHander.mjs'

const messageHandler = new WorkerMessageHandler(self)

messageHandler.on('run', (config) => {
  const {
    runConfig,
    numPhotons,
    seed
  } = config

  const monteCarlo = new MonteCarlo(runConfig, seed)

  for (let i = 0; i < numPhotons; i++) {
    monteCarlo.launchPhoton()
  }

  return monteCarlo.result
})

console.log('worker loaded')
