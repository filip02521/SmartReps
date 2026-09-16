import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { setKeepAwake } from '@/lib/keep-awake'

type FakeSentinel = {
  released: boolean
  release: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
}

function makeSentinel(): FakeSentinel {
  return {
    released: false,
    release: vi.fn(async function (this: FakeSentinel) {
      this.released = true
    }),
    addEventListener: vi.fn(),
  }
}

function installWakeLock(requestImpl?: () => Promise<FakeSentinel>) {
  const request = vi.fn(requestImpl ?? (() => Promise.resolve(makeSentinel())))
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
    writable: true,
  })
  return request
}

function removeWakeLock() {
  Object.defineProperty(navigator, 'wakeLock', {
    value: undefined,
    configurable: true,
    writable: true,
  })
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('setKeepAwake', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })
  afterEach(() => {
    setKeepAwake(false)
    removeWakeLock()
    vi.restoreAllMocks()
  })

  it('acquires a wake lock when enabled', async () => {
    const request = installWakeLock()
    setKeepAwake(true)
    await flush()
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('releases the lock when disabled', async () => {
    const s = makeSentinel()
    installWakeLock(() => Promise.resolve(s))
    setKeepAwake(true)
    await flush()
    setKeepAwake(false)
    await flush()
    expect(s.release).toHaveBeenCalled()
  })

  it('does not leak a lock when the request resolves after release (race)', async () => {
    let resolveRequest!: (s: FakeSentinel) => void
    installWakeLock(
      () =>
        new Promise<FakeSentinel>((res) => {
          resolveRequest = res
        }),
    )
    setKeepAwake(true)
    // Turn off while the request is still in flight
    setKeepAwake(false)
    const late = makeSentinel()
    resolveRequest(late)
    await flush()
    expect(late.release).toHaveBeenCalled() // released immediately — no leak
  })

  it('falls back to a looping video when Wake Lock API is missing', async () => {
    removeWakeLock()
    setKeepAwake(true)
    await flush()
    const video = document.querySelector('video') as HTMLVideoElement | null
    expect(video).not.toBeNull()
    expect(video?.loop).toBe(true)
    expect(video?.muted).toBe(true)
    expect(video?.play).toHaveBeenCalled()
    setKeepAwake(false)
    expect(document.querySelector('video')).toBeNull()
  })

  it('falls back to video when wakeLock.request rejects', async () => {
    installWakeLock(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    setKeepAwake(true)
    await flush()
    expect(document.querySelector('video')).not.toBeNull()
  })

  it('re-acquires when the page becomes visible again', async () => {
    const s = makeSentinel()
    const request = installWakeLock(() => Promise.resolve(s))
    setKeepAwake(true)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)

    // System released the lock while hidden (screen off, battery saver)
    s.released = true
    const releaseHandler = s.addEventListener.mock.calls.find(
      (c) => c[0] === 'release',
    )?.[1] as (() => void) | undefined
    releaseHandler?.() // fires 'release' — but page is visible, re-acquires
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })
})
