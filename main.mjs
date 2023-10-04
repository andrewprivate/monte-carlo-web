import { Pallete } from './chartjs/pallete.mjs'
import { Grammar } from './src/grammar.mjs'
import { MonteCarloConfigParser } from './src/MonteCarloConfig.mjs'
import { SimulationRunner } from './src/SimulationRunner.mjs'
import { Utils } from './src/Utils.mjs'

const simulationRunner = new SimulationRunner()
const ChartsContainer = document.getElementById('charts')
const ConfigInput = document.getElementById('configInput')

const Charts = {}
let Config = null

const inputEditor = window.ace.edit('configInput')
inputEditor.session.setOptions({
  tabSize: 8,
  setUseSoftTabs: false
})
inputEditor.setShowPrintMargin(false)
inputEditor.session.setMode(window.AceGrammar.getMode(Grammar))

const outputEditor = window.ace.edit('configOutput')
outputEditor.session.setOptions({
  tabSize: 8,
  setUseSoftTabs: false
})
outputEditor.setShowPrintMargin(false)
outputEditor.session.setMode(window.AceGrammar.getMode(Grammar))

let selectedRun = 0

function updateDropdown () {
  const selectorContainer = document.getElementsByClassName('runSelector')[0]
  selectorContainer.replaceChildren()

  const runs = Config.runs.length

  const obj = {}
  for (let i = 0; i < runs; i++) {
    const run = Config.runs[i]
    if (!run.name) run.name = (run.output_file.split(/\s/)[0].replace('.mco', '') || ('Run ' + (i + 1))) + ' (' + run.number_of_photons + ' photons)'
    obj[i] = run.name
  }

  const el = Utils.createDropdown(0, 'Selected Run', obj, (val) => {
    selectedRun = parseInt(val)
  }, (val, newName) => {
    const run = Config.runs[parseInt(val)]
    run.name = newName
  })
  selectedRun = 0
  selectorContainer.appendChild(el)
}

// get default config file from /sample.mci
fetch('sample.mci').then(response => response.text()).then(text => {
  inputEditor.setValue(text, -1)
  parseConfig()
})

inputEditor.session.addEventListener('change', () => {
  parseConfig()
})

function parseConfig () {
  try {
    Config = MonteCarloConfigParser.parseConfigFile(inputEditor.getValue())
    ConfigInput.classList.remove('error')
    simulationRunner.reset()
    resetRunButton()
    updateDropdown()
  } catch (e) {
    console.error(e)
    ConfigInput.classList.add('error')
  }
}

const runButton = document.getElementById('runbtn')
runButton.addEventListener('click', async () => {
  if (!runButton.classList.contains('clickable')) {
    simulationRunner.reset()
    resetRunButton()
    return
  }

  if (ConfigInput.classList.contains('error') || !Config) {
    return
  }

  const progress = runButton.getElementsByClassName('progress')[0]
  const text = runButton.getElementsByClassName('text')[0]

  const runIndex = selectedRun
  const runConfig = Config.runs[runIndex]

  if (!runConfig) {
    return
  }

  runButton.classList.remove('clickable')
  progress.style.width = '0%'
  text.textContent = 'Running...'

  const { results, output } = await simulationRunner.runSimulation(runConfig, (launching, launched, total) => {
    text.textContent = `Simulated ${launched} / ${total} photons`
    progress.style.width = `${(launched / total) * 100}%`
  })

  outputEditor.setValue(output, -1)

  resetRunButton()

  appendChartData(results)

  const videoContainer = document.getElementById('videoContainer')
  const container = document.createElement('div')
  container.classList.add('container')

  const title = document.createElement('div')
  title.classList.add('title')
  title.textContent = runConfig.name

  const video = document.createElement('div')
  video.classList.add('video')

  const removeBtn = document.createElement('button')
  removeBtn.classList.add('remove-button')
  removeBtn.textContent = 'Remove Video'

  removeBtn.addEventListener('click', () => {
    container.remove()

    // revoke url
    const videoEl = video.getElementsByTagName('video')[0]
    if (videoEl) {
      URL.revokeObjectURL(videoEl.src)
    }
  })

  container.appendChild(title)
  container.appendChild(video)
  container.appendChild(removeBtn)
  videoContainer.appendChild(container)
  syncVideos()
  createVideo(results, video).then(url => {
    const videoEl = document.createElement('video')
    videoEl.src = url
    videoEl.autoplay = true
    videoEl.muted = true
    video.replaceChildren(videoEl)

    videoEl.addEventListener('ended', () => {
      syncVideos()
    })

    const downloadBtn = document.createElement('button')
    downloadBtn.textContent = 'Download Video'
    downloadBtn.addEventListener('click', () => {
      const a = document.createElement('a')
      a.href = url
      a.download = runConfig.name + '.webm'
      a.click()
    })
    video.appendChild(downloadBtn)
  })
  console.log(results)
})

function resetRunButton () {
  const progress = runButton.getElementsByClassName('progress')[0]
  const text = runButton.getElementsByClassName('text')[0]
  runButton.classList.add('clickable')
  text.textContent = 'Run Simulation Using ' + simulationRunner.workerCount + ' Workers'
  progress.style.width = '100%'
}

function createLineChart (title, xlabel, ylabel) {
  const chartCanvas = document.createElement('canvas')
  const dataset = []
  const chart = new window.Chart(chartCanvas, {
    type: 'line',
    data: {
      datasets: dataset
    },
    options: {
      aspectRatio: 1.5,
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: false
            },
            pinch: {
              enabled: true
            },
            pan: {
              enabled: true,
              mode: 'xy'
            },
            drag: {
              enabled: true
            }
          }
        },
        tooltip: {
          mode: 'interpolate',
          intersect: false,
          animation: false,
          callbacks: {
            title: function (a, d) {
              return a[0].element.x.toFixed(4)
            },
            label: function (d) {
              return (
                d.chart.data.datasets[d.datasetIndex].label + ': ' + d.element.y.toFixed(4)
              )
            }
          }
        },
        crosshair: {
          zoom: {
            enabled: false
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xlabel
          },
          type: 'linear',
          ticks: {
            autoSkip: true
          }
        },
        y: {
          title: {
            display: true,
            text: ylabel
          },
          type: 'linear',
          ticks: {
            autoSkip: true,
            autoSkipPadding: 10
          }
        }
      },
      elements: {
        point: {
          radius: 0
        },
        line: {
          tension: 0,
          borderWidth: 1
        }
      }
    }
  })

  const container = document.createElement('div')
  container.classList.add('chartContainer')
  container.appendChild(chartCanvas)

  chartCanvas.addEventListener('dblclick', (e) => {
    // reset zoom
    chart.resetZoom()
  })
  return {
    chart,
    dataset,
    chartCanvas,
    container,
    appendData: (data) => {
      data.interpolate = true
      dataset.push(data)
      chart.update()
    }
  }
}

function initializeCharts () {
  ChartsContainer.replaceChildren()
  Charts.fluence = createLineChart('Internal Fluence Over Depth', 'Depth (cm)', 'Fluence (-)')
  ChartsContainer.appendChild(Charts.fluence.container)

  Charts.fluence.chart.options.scales.y.type = 'logarithmic'
  Charts.fluence.chart.update()

  Charts.absorbance = createLineChart('Absorbance Over Depth', 'Depth (cm)', 'Absorbance (-)')
  ChartsContainer.appendChild(Charts.absorbance.container)

  Charts.reflectance = createLineChart('Diffuse Reflectance Over Distance', 'Distance (cm)', 'Reflectance (-)')
  ChartsContainer.appendChild(Charts.reflectance.container)

  Charts.transmittance = createLineChart('Transmittance Over Distance', 'Distance (cm)', 'Transmittance (-)')
  ChartsContainer.appendChild(Charts.transmittance.container)
}

const colors = Pallete('tol', 10).map((hex) => {
  return '#' + hex
})

function appendChartData (result) {
  const runName = Config.runs[selectedRun].name
  const color = colors[Charts.fluence.dataset.length % colors.length]
  const fluenceData = []
  for (let i = 0; i < result.fluence.length; i++) {
    const z = result.config.dz * (i + 0.5)
    fluenceData.push({
      x: z,
      y: result.fluence[i]
    })
  }

  Charts.fluence.appendData({
    label: runName,
    data: fluenceData,
    borderColor: color,
    backgroundColor: color
  })

  const absorbanceData = []
  for (let i = 0; i < result.a_z.length; i++) {
    const z = result.config.dz * (i + 0.5)
    absorbanceData.push({
      x: z,
      y: result.a_z[i]
    })
  }

  Charts.absorbance.appendData({
    label: runName,
    data: absorbanceData,
    borderColor: color,
    backgroundColor: color
  })

  const reflectanceData = []
  for (let i = 0; i < result.rd_r.length; i++) {
    const r = result.config.dr * (i + 0.5)
    reflectanceData.push({
      x: r,
      y: result.rd_r[i]
    })
  }

  Charts.reflectance.appendData({
    label: runName,
    data: reflectanceData,
    borderColor: color,
    backgroundColor: color
  })

  const transmittanceData = []
  for (let i = 0; i < result.tt_r.length; i++) {
    const r = result.config.dr * (i + 0.5)
    transmittanceData.push({
      x: r,
      y: result.tt_r[i]
    })
  }

  Charts.transmittance.appendData({
    label: runName,
    data: transmittanceData,
    borderColor: color,
    backgroundColor: color
  })
}

initializeCharts()

document.getElementById('cleargraphs').addEventListener('click', () => {
  initializeCharts()
  document.getElementById('videoContainer').replaceChildren()
})

window.simulationRunner = simulationRunner

async function createVideo (results, container) {
  return new Promise((resolve, reject) => {
    const w_txz = results.w_txz
    const nx = results.config.nr * 2
    const nz = results.config.nz
    const nt = results.config.nt
    const dr = results.config.dr
    const dz = results.config.dz

    const scaleT = 40 // mseconds per frame

    const canvas = document.createElement('canvas')

    const scale = 1920 / Math.max(nx * dr, nz * dz)

    canvas.width = Math.ceil(nx * dr * scale)
    canvas.height = Math.ceil(nz * dz * scale)

    if (container) container.replaceChildren(canvas)

    const ctx = canvas.getContext('2d')

    const startTime = performance.now()
    const stream = canvas.captureStream(30 /* fps */)
    const mediaRecorder = new MediaRecorder(stream,
      {
        mimeType: 'video/webm; codecs=vp8',
        videoBitsPerSecond: 50 * 1024 * 1024
      })
    const chunks = []

    mediaRecorder.addEventListener('dataavailable', (e) => {
      chunks.push(e.data)
    })

    mediaRecorder.addEventListener('stop', (e) => {
      const blob = new Blob(chunks, {
        type: 'video/webm'
      })
      const url = URL.createObjectURL(blob)
      resolve(url)
    })

    const maxValue = 0.8 * w_txz.reduce((max, t_rz) => {
      return Math.max(max, t_rz.reduce((max, r_z) => {
        return Math.max(max, r_z.reduce((max, z) => {
          return Math.max(max, z)
        }, 0))
      }, 0))
    }, 0)

    const gcolors = Pallete('tol-rainbow', 128).map((hex) => {
      return '#' + hex
    })
    function render () {
      const now = performance.now()
      const elapsed = now - startTime
      if (elapsed >= scaleT * nt) {
        mediaRecorder.stop()
        return
      }
      requestAnimationFrame(render)

      const it = Math.floor(elapsed / scaleT)
      const t_rz = w_txz[it]

      // fill white
      ctx.fillStyle = 'white'
      ctx.globalAlpha = 1
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // draw layers
      for (let i = 1; i < results.config.layers.length - 1; i++) {
        const layer = results.config.layers[i]
        const z0 = layer.z0
        const z1 = layer.z1
        ctx.fillStyle = colors[i % colors.length]
        // opacity
        ctx.globalAlpha = 0.5
        ctx.fillRect(0, z0 * scale, canvas.width, (z1 - z0) * scale)
      }
      ctx.globalAlpha = 0.5

      // draw photons
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          const value = t_rz[ix][iz]
          if (value === 0) continue
          const r = Math.log(value + 1) / Math.log(maxValue + 1)

          if (r > 0) {
            ctx.fillStyle = gcolors[Math.min(Math.floor(r * gcolors.length), gcolors.length - 1)]
            ctx.fillRect(ix * dr * scale, iz * dz * scale, dr * scale, dz * scale)
          }
        }
      }
    }

    render()
    mediaRecorder.start()
  })
}

function syncVideos () {
  const videoContainer = document.getElementById('videoContainer')
  const videos = videoContainer.getElementsByTagName('video')
  for (let i = 0; i < videos.length; i++) {
    // if there is video that hasn't ended, then don't sync
    if (!videos[i].ended) return
  }

  for (let i = 0; i < videos.length; i++) {
    videos[i].currentTime = 0
    videos[i].play()
  }
}
