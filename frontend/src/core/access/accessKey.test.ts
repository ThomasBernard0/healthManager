import {
  captureKeyFromUrl,
  currentAccessKey,
  getAccessKey,
  notifyUnauthorized,
  onUnauthorized,
} from './accessKey'

describe('access key', () => {
  beforeEach(() => localStorage.clear())

  it('moves ?key=… from the URL to storage and cleans the address bar', () => {
    window.history.replaceState(null, '', '/jour?key=abc123&x=1#top')
    captureKeyFromUrl()
    expect(currentAccessKey()).toBe('abc123')
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/jour?x=1#top')
  })

  it('leaves the URL alone without a key', () => {
    window.history.replaceState(null, '', '/jour')
    captureKeyFromUrl()
    expect(getAccessKey()).toBeNull()
    expect(window.location.pathname).toBe('/jour')
  })

  it('notifies listeners on 401', () => {
    const listener = vi.fn()
    const off = onUnauthorized(listener)
    notifyUnauthorized()
    off()
    notifyUnauthorized()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
