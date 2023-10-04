import { WorkerMessageHandler } from './WorkerMessageHander.mjs'
import { Go } from './mcml/Go.mjs'
import { OutputCalc } from './mcml/OutputCalc.mjs'
import { OutputWriter } from './mcml/OutputWriter.mjs'
import { MersenneTwister } from './mcml/Twister.mjs'

const WorkerPath = new URL('SimulationWorker.mjs', import.meta.url)

export class SimulationTask {
  constructor (runConfig, numPhotons, seed) {
    this.runConfig = runConfig
    this.numPhotons = numPhotons
    this.seed = seed
  }
}

export class SimulationRunner {
  constructor () {
    this.config = null
    this.workers = []
    this.tasks = []
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
    const numWorkers = navigator.hardwareConcurrency
    for (let i = 0; i < numWorkers; i++) {
      this.createWorker()
    }
  }

  reset () {
    this.tasks = []
    this.initializeWorkers()
  }

  setConfig (config) {
    this.reset()
    this.config = config
    return this.config
  }

  async runTask (task) {
    return new Promise((resolve, reject) => {
      this.tasks.push({
        resolve,
        task
      })

      this.run()
    })
  }

  async run () {
    if (this.tasks.length === 0) return

    const worker = this.workers.find(worker => !worker.busy)
    if (!worker) return

    const task = this.tasks.shift()

    worker.busy = true
    const result = await worker.emit('run', task.task)
    worker.busy = false

    try {
      task.resolve(result)
    } catch (e) {
      console.error('Task resolution throws error', task)
      throw e
    }

    this.run()
  }

  async runSimulation (runIndex, progressCallback) {
    const seed = Math.floor(Math.random() * 0xffffffff)
    const random = new MersenneTwister(seed)

    const run = this.config.runs[runIndex]
    if (!run) {
      throw new Error('Run index out of bounds')
    }

    const tasks = []
    const taskDivision = 5000
    for (let i = 0; i < run.number_of_photons; i += taskDivision) {
      const numPhotons = Math.min(taskDivision, run.number_of_photons - i)
      tasks.push(new SimulationTask(run, numPhotons, random.genrand_int31()))
    }

    let progress = 0
    const results = []

    const timeStart = performance.now()

    await Promise.all(tasks.map(async task => {
      const result = await this.runTask(task)
      progress += task.numPhotons
      results.push(result)
      if (progressCallback) progressCallback(results, progress, run.number_of_photons)
    }))

    const timeEnd = performance.now()

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

    OutputCalc.sumScaleResult(run, finalResult)

    finalResult.rsp = Go.calculateRSpecular(run.layers)

    const output = new OutputWriter()
    output.writeResult(run, finalResult)
    return {
      results: finalResult,
      output: output.build()
    }
  }
}
