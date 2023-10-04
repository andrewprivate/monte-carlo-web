import { Grammar } from './src/grammar.mjs'
import { MonteCarloConfigParser } from './src/MonteCarloConfig.mjs'
import { SimulationRunner } from './src/SimulationRunner.mjs'
import { Utils } from './src/Utils.mjs'

const simulationRunner = new SimulationRunner()

const configInput = document.getElementById('configInput')

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
    configInput.classList.remove('error')
    simulationRunner.setConfig(config)
    updateDropdown(config)
  } catch (e) {
    console.error(e)
    configInput.classList.add('error')
  }
}

const runButton = document.getElementById('runbtn')
runButton.addEventListener('click', async () => {
  if (!runButton.classList.contains('clickable') || configInput.classList.contains('error')) {
    return
  }

  runButton.classList.remove('clickable')

  const progress = runButton.getElementsByClassName('progress')[0]
  const text = runButton.getElementsByClassName('text')[0]

  progress.style.width = '0%'
  text.textContent = 'Running...'

  const { results, output } = await simulationRunner.runSimulation(selectedRun, (results, completed, total) => {
    text.textContent = `Simulated ${completed} / ${total} photons`
    progress.style.width = `${(completed / total) * 100}%`
  })

  outputEditor.setValue(output, -1)
  runButton.classList.add('clickable')
  text.textContent = 'Run'
  progress.style.width = '100%'
})

window.simulationRunner = simulationRunner
