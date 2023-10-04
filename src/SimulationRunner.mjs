import { WorkerMessageHandler } from './WorkerMessageHander.mjs'
import { Go } from './mcml/Go.mjs'
import { OutputCalc } from './mcml/OutputCalc.mjs'
import { OutputWriter } from './mcml/OutputWriter.mjs'
import { MersenneTwister } from './mcml/Twister.mjs'

const WorkerPath = new URL('SimulationWorker.mjs', import.meta.url)
export class SimulationRunner {
  constructor () {
    this.workers = []
    this.task = null
    this.workerCount = navigator.hardwareConcurrency || 1
  }

  createWorker () {
    const worker = new Worker(WorkerPath, {
      type: 'module'
    })
    const handler = new WorkerMessageHandler(worker)
    this.workers.push(handler)
  }

  removeWorkers () {
    this.workers.forEach(worker => {
      worker.channel.terminate()
    })
    this.workers = []
  }

  initializeWorkers () {
    this.removeWorkers()
    const numWorkers = this.workerCount
    for (let i = 0; i < numWorkers; i++) {
      this.createWorker()
    }
  }

  reset () {
    this.task = null
    this.initializeWorkers()
  }

  async runSimulation (runConfig, progressCallback) {
    if (this.task) throw new Error('Simulation is already running')

    const seed = Math.floor(Math.random() * 0xffffffff)
    const random = new MersenneTwister(seed)

    const task = runConfig

    this.task = task

    const checkCancel = () => {
      if (this.task !== task) throw new Error('Simulation cancelled')
    }

    // Send config to workers
    await Promise.all(this.workers.map(worker => {
      return worker.emit('config', {
        runConfig,
        seed: random.genrand_int31()
      })
    }))

    checkCancel()

    const taskDivision = 5000
    const numPhotons = task.number_of_photons
    let launched = 0
    let launching = 0

    const launchPhotons = async (worker) => {
      while (launched + launching < numPhotons) {
        const photons = Math.min(taskDivision, numPhotons - launched - launching)
        launching += photons
        await worker.emit('launch', photons)
        checkCancel()
        launched += photons
        launching -= photons
        if (progressCallback) progressCallback(launching, launched, numPhotons)
      }
    }

    const timeStart = performance.now()
    await Promise.all(this.workers.map(launchPhotons))
    const timeEnd = performance.now()

    const results = await Promise.all(this.workers.map(worker => {
      return worker.emit('sendresult')
    }))

    const finalResult = results[0]

    finalResult.simulationTime = (timeEnd - timeStart) / 1000

    for (let i = 1; i < results.length; i++) {
      const result = results[i]

      result.tt_ra.forEach((rows, i) => {
        rows.forEach((value, j) => {
          finalResult.tt_ra[i][j] += value
        })
      })

      result.rd_ra.forEach((rows, i) => {
        rows.forEach((value, j) => {
          finalResult.rd_ra[i][j] += value
        })
      })

      result.a_rz.forEach((rows, i) => {
        rows.forEach((value, j) => {
          finalResult.a_rz[i][j] += value
        })
      })
    }

    OutputCalc.sumScaleResult(runConfig, finalResult)

    finalResult.rsp = Go.calculateRSpecular(runConfig.layers)

    const output = new OutputWriter()
    output.writeResult(runConfig, finalResult)

    checkCancel()
    this.task = null

    return {
      results: finalResult,
      output: output.build()
    }
  }
}
