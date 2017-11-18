import { firestore } from 'firebase/app'
import { $$asyncIterator } from 'iterall'

export function queryToIterator<T>(
  query: firestore.Query,
  operationName: string
): AsyncIterator<T> {
  const pullQueue: any[] = []
  const pushQueue: any[] = []
  let listening = true

  const pushValue = (event: any) => {
    if (pullQueue.length !== 0) {
      pullQueue.shift()({ value: event, done: false })
    } else {
      pushQueue.push(event)
    }
  }

  const pullValue = () => {
    return new Promise(resolve => {
      if (pushQueue.length !== 0) {
        resolve({ value: pushQueue.shift(), done: false })
      } else {
        pullQueue.push(resolve)
      }
    })
  }

  const unsubscribe = query.onSnapshot(snapshot => {
    snapshot.forEach(document => {
      pushValue({ [operationName]: { id: document.id, ...document.data() } })
    })
  })

  const emptyQueue = () => {
    if (listening) {
      listening = false
      unsubscribe()
      pullQueue.forEach(resolve => resolve({ value: undefined, done: true }))
      pullQueue.length = 0
      pushQueue.length = 0
    }
  }

  return {
    return() {
      emptyQueue()
      return Promise.resolve({ value: undefined, done: true })
    },
    next() {
      return listening ? pullValue() : this.return()
    },
    throw(error: Error) {
      emptyQueue()
      return Promise.reject(error)
    },
    [$$asyncIterator]() {
      return this
    }
  } as any
}
