import { Pallete } from './chartjs/pallete.mjs'
import { Grammar } from './src/grammar.mjs'
import { MonteCarloConfigParser } from './src/MonteCarloConfig.mjs'
import { SimulationRunner } from './src/SimulationRunner.mjs'
import { Utils } from './src/Utils.mjs'

const simulationRunner = new SimulationRunner()
const ChartsContainer = document.getElementById('charts')
const ConfigInput = document.getElementById('configInput')

const Charts = {}

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

function updateDropdown (config) {
  const selectorContainer = document.getElementsByClassName('runSelector')[0]
  selectorContainer.replaceChildren()

  const runs = config.runs.length

  const obj = {}
  for (let i = 0; i < runs; i++) {
    const run = config.runs[i]
    if (!run.name) run.name = (run.output_file.split(/\s/)[0].replace('.mco', '') || ('Run ' + (i + 1))) + ' (' + run.number_of_photons + ' photons)'
    obj[i] = run.name
  }

  const el = Utils.createDropdown(0, 'Selected Run', obj, (val) => {
    selectedRun = parseInt(val)
  }, (val, newName) => {
    const run = config.runs[parseInt(val)]
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
    const config = MonteCarloConfigParser.parseConfigFile(inputEditor.getValue())
    ConfigInput.classList.remove('error')
    simulationRunner.setConfig(config)
    resetRunButton()
    updateDropdown(config)
  } catch (e) {
    console.error(e)
    ConfigInput.classList.add('error')
  }
}

const runButton = document.getElementById('runbtn')
runButton.addEventListener('click', async () => {
  if (!runButton.classList.contains('clickable') || ConfigInput.classList.contains('error')) {
    return
  }

  runButton.classList.remove('clickable')

  const progress = runButton.getElementsByClassName('progress')[0]
  const text = runButton.getElementsByClassName('text')[0]

  progress.style.width = '0%'
  text.textContent = 'Running...'

  const runIndex = selectedRun
  const { results, output } = await simulationRunner.runSimulation(runIndex, (results, completed, total) => {
    text.textContent = `Simulated ${completed} / ${total} photons`
    progress.style.width = `${(completed / total) * 100}%`
  })

  outputEditor.setValue(output, -1)

  resetRunButton()

  appendChartData(results)
})

function resetRunButton () {
  const progress = runButton.getElementsByClassName('progress')[0]
  const text = runButton.getElementsByClassName('text')[0]
  runButton.classList.add('clickable')
  text.textContent = 'Run Simulation Using ' + simulationRunner.workers.length + ' Workers'
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
          type: 'linear'
        },
        y: {
          title: {
            display: true,
            text: ylabel
          },
          type: 'linear'
        }
      },
      elements: {
        point: {
          radius: 1
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
  const runName = simulationRunner.config.runs[selectedRun].name
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
})

window.simulationRunner = simulationRunner
