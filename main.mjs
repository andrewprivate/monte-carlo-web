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
    obj[i] = 'Run ' + (i + 1) + ' (' + run.number_of_photons + ' photons)'
  }

  const el = Utils.createDropdown(0, 'Selected', obj, (val) => {
    selectedRun = parseInt(val)
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
  runButton.classList.add('clickable')
  text.textContent = 'Run'
  progress.style.width = '100%'

  appendChartData(results)
})

function createLineChart (title, xlabel, ylabel) {
  const chartCanvas = document.createElement('canvas')
  const dataset = []
  const chart = new window.Chart(chartCanvas, {
    type: 'line',
    data: {
      datasets: dataset
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title
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
      }
    }
  })

  const container = document.createElement('div')
  container.classList.add('chartContainer')
  container.appendChild(chartCanvas)

  return {
    chart,
    dataset,
    chartCanvas,
    container,
    appendData: (data) => {
      dataset.push(data)
      chart.update()
    }
  }
}

function initializeCharts () {
  ChartsContainer.replaceChildren()
  Charts.fluence = createLineChart('Internal Fluence Over Depth', 'Depth (cm)', 'Fluence (-)')
  ChartsContainer.appendChild(Charts.fluence.container)

  Charts.absorbance = createLineChart('Absorbance Over Depth', 'Depth (cm)', 'Absorbance (-)')
  ChartsContainer.appendChild(Charts.absorbance.container)

  Charts.reflectance = createLineChart('Diffuse Reflectance Over Distance', 'Distance (cm)', 'Reflectance (-)')
  ChartsContainer.appendChild(Charts.reflectance.container)

  Charts.transmittance = createLineChart('Transmittance Over Distance', 'Distance (cm)', 'Transmittance (-)')
  ChartsContainer.appendChild(Charts.transmittance.container)
}

function appendChartData (result) {
  const fluenceData = []
  for (let i = 0; i < result.fluence.length; i++) {
    const z = result.config.dz * (i + 0.5)
    fluenceData.push({
      x: z,
      y: result.fluence[i]
    })
  }

  Charts.fluence.appendData({
    label: `Run ${selectedRun + 1}`,
    data: fluenceData
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
    label: `Run ${selectedRun + 1}`,
    data: absorbanceData
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
    label: `Run ${selectedRun + 1}`,
    data: reflectanceData
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
    label: `Run ${selectedRun + 1}`,
    data: transmittanceData
  })
}

initializeCharts()

window.simulationRunner = simulationRunner
