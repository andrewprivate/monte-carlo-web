import { MonteCarlo } from './MonteCarlo.mjs'
import { WorkerMessageHandler } from './WorkerMessageHander.mjs'

const messageHandler = new WorkerMessageHandler(self)

let monteCarlo = null

messageHandler.on('config', (config) => {
  const {
    runConfig,
    seed
  } = config
  monteCarlo = new MonteCarlo(runConfig, seed)
})

messageHandler.on('launch', (numPhotons) => {
  for (let i = 0; i < numPhotons; i++) {
    monteCarlo.launchPhoton()
  }
})

messageHandler.on('sendresult', () => {
  return monteCarlo.result
})

console.log('worker loaded')
