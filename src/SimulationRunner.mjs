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
    const numWorkers = this.workerCount
    for (let i = 0; i < numWorkers; i++) {
      this.createWorker()
    }
  }

  reset () {
    this.cancelSimulation()
    this.initializeWorkers()
  }

  cancelSimulation () {
    this.task = null
    this.removeWorkers()
  }

  async runSimulation (runConfig, progressCallback) {
    if (this.task) throw new Error('Simulation is already running')

    this.reset()

    const seed = Math.floor(Math.random() * 0xffffffff)
    const random = new MersenneTwister(seed)

    const task = runConfig

    this.task = task

    const checkCancel = () => {
      if (this.task !== task) throw new Error('Simulation cancelled')
    }

    console.log('Sending config to workers')
    let now = performance.now()
    // Send config to workers
    await Promise.all(this.workers.map(worker => {
      return worker.emit('config', {
        runConfig,
        seed: random.genrand_int31()
      })
    }))
    checkCancel()

    console.log('Config sent to workers in', performance.now() - now, 'ms')
    console.log('Launching photons')
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

    console.log('Photon simulation finished in', timeEnd - timeStart, 'ms')
    console.log('Collecting results')
    now = performance.now()

    const results = await Promise.all(this.workers.map(worker => {
      return worker.emit('sendresult')
    }))

    console.log('Results collected in', performance.now() - now, 'ms')
    console.log('Summing results')
    now = performance.now()

    const summedResults = results[0]

    for (let i = 1; i < results.length; i++) {
      const result = results[i]

      result.tt_ra.forEach((value, i) => {
        summedResults.tt_ra[i] += value
      })

      result.rd_ra.forEach((value, i) => {
        summedResults.rd_ra[i] += value
      })

      result.rd_x.forEach((value, i) => {
        summedResults.rd_x[i] += value
      })

      result.a_rz.forEach((value, i) => {
        summedResults.a_rz[i] += value
      })

      result.w_txz.forEach((value, i) => {
        summedResults.w_txz[i] += value
      })

      summedResults.tt_unscattered += result.tt_unscattered
      summedResults.rd_unscattered += result.rd_unscattered
    }

    console.log('Results summed in', performance.now() - now, 'ms')
    console.log('Unflattening results')
    now = performance.now()

    // unflatten results
    const finalResults = {
      tt_ra: new Array(runConfig.nr),
      rd_ra: new Array(runConfig.nr),
      rd_x: summedResults.rd_x,
      a_rz: new Array(runConfig.nr),
      w_txz: new Array(runConfig.nt),
      tt_unscattered: summedResults.tt_unscattered,
      rd_unscattered: summedResults.rd_unscattered
    }

    for (let i = 0; i < runConfig.nr; i++) {
      finalResults.tt_ra[i] = summedResults.tt_ra.slice(i * runConfig.na, (i + 1) * runConfig.na)
      finalResults.rd_ra[i] = summedResults.rd_ra.slice(i * runConfig.na, (i + 1) * runConfig.na)
      finalResults.a_rz[i] = summedResults.a_rz.slice(i * runConfig.nz, (i + 1) * runConfig.nz)
    }

    for (let i = 0; i < runConfig.nt; i++) {
      finalResults.w_txz[i] = new Array(runConfig.nr * 2)
      for (let j = 0; j < runConfig.nr * 2; j++) {
        finalResults.w_txz[i][j] = summedResults.w_txz.slice(i * runConfig.nr * 2 * runConfig.nz + j * runConfig.nz, i * runConfig.nr * 2 * runConfig.nz + (j + 1) * runConfig.nz)
      }
    }

    console.log('Results unflattened in', performance.now() - now, 'ms')
    console.log('Calculating final results')
    now = performance.now()

    OutputCalc.sumScaleResult(runConfig, finalResults)

    finalResults.simulationTime = (timeEnd - timeStart) / 1000

    finalResults.rsp = Go.calculateRSpecular(runConfig.layers)

    const output = new OutputWriter()
    output.writeResult(runConfig, finalResults)

    console.log('Final results calculated in', performance.now() - now, 'ms')

    checkCancel()

    this.task = null
    this.removeWorkers()

    return {
      results: finalResults,
      output: output.build()
    }
  }
}
