// A tiny key-value store in IndexedDB: the local copy of the session in progress lives here.
const DB = 'healthmanager'
const STORE = 'muscu'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  opening.catch(() => (opening = null))
  return opening
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    // Written once the transaction commits, not when the request succeeds.
    tx.oncomplete = () => resolve(request.result as T)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const idbGet = <T>(key: string): Promise<T | undefined> => run<T | undefined>('readonly', (s) => s.get(key))

export const idbSet = (key: string, value: unknown): Promise<void> => run<void>('readwrite', (s) => s.put(value, key))

export const idbDelete = (key: string): Promise<void> => run<void>('readwrite', (s) => s.delete(key))
