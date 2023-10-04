export const WorkerMessageTypes = {
  EVENT: 'event',
  RESPONSE: 'response'
}

export class WorkerMessageHandler {
  constructor (channel) {
    this.channel = channel
    this.promises = []
    this.listeners = new Map()

    this.channel.addEventListener('message', this.onMessage.bind(this))
  }

  onMessage (event) {
    const data = event.data
    switch (data.type) {
      case WorkerMessageTypes.EVENT:
        this.onEvent(data)
        break
      case WorkerMessageTypes.RESPONSE:
        this.onResponse(data)
        break
    }
  }

  async onEvent (data) {
    const { event } = data
    const listeners = this.listeners.get(event)
    let responses = []
    if (listeners) {
      responses = await Promise.all(listeners.map(async listener => {
        try {
          const response = await listener(...data.args)
          return response
        } catch (error) {
          console.error('Listener throws error', data)
          throw error
        }
      }))
    }

    this.channel.postMessage({
      type: WorkerMessageTypes.RESPONSE,
      event,
      responses
    })
  }

  onResponse (data) {
    const { event, responses } = data
    const promises = []

    this.promises = this.promises.filter(promise => {
      if (promise.event === event) {
        promises.push(promise)
        return false
      }
      return true
    })

    promises.forEach((promise, index) => {
      if (promise.event === event) {
        try {
          promise.resolve(responses.length > 1 ? responses : responses[0])
        } catch (error) {
          console.error('Promise throws error', data)
          throw error
        }
      }
    })
  }

  emit (event, ...args) {
    this.channel.postMessage({
      type: WorkerMessageTypes.EVENT,
      event,
      args
    })

    return new Promise((resolve) => {
      this.promises.push({
        event,
        resolve
      })
    })
  }

  on (event, callback) {
    let listeners = this.listeners.get(event)
    if (!listeners) {
      listeners = []
      this.listeners.set(event, listeners)
    }

    if (listeners.indexOf(callback) >= 0) {
      throw new Error('Listener already registered')
    }

    listeners.push(callback)
  }

  off (event, callback) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index >= 0) {
        listeners.splice(index, 1)
      }
    }
  }

  close () {
    this.channel.close()
    this.channel = null
  }
}
