// ── Shared extension detection & communication ─────────────────────────────
// Used by onboarding page and signals page

export const EXTENSION_STORE_URL =
  'https://chromewebstore.google.com/detail/cbhlkanipdkdohhiocngfbcjhghpgcbm?utm_source=item-share-cb'

export const EXTENSION_ID = 'cbhlkanipdkdohhiocngfbcjhghpgcbm'

// Dev extension — loaded unpacked from extension/ with manifest.dev.json.
// ID is pinned via the `key` field in manifest.dev.json so it's stable
// across reloads and machines. See extension/README.md for the dev workflow.
export const DEV_EXTENSION_ID = 'cgcnjhiiilpipijbooeblhhjamkiafof'

const KNOWN_EXTENSION_IDS = [EXTENSION_ID, DEV_EXTENSION_ID]

export interface ExtensionPingResult {
  success: boolean
  version?: string
  deviceToken?: string
  scanningPaused?: boolean
  lastScanTime?: string | null
}

export interface ExtensionDetectResult {
  found: boolean
  extId?: string
  version?: string
  deviceToken?: string
  scanningPaused?: boolean
  lastScanTime?: string | null
}

type ChromeApi = {
  chrome?: {
    runtime?: {
      sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void
    }
  }
}

function getChromeApi() {
  return (window as unknown as ChromeApi).chrome
}

async function pingOnce(chromeApi: NonNullable<ReturnType<typeof getChromeApi>>, extId: string, timeoutMs: number): Promise<ExtensionPingResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ success: false }), timeoutMs)
    try {
      chromeApi.runtime!.sendMessage!(extId, { action: 'PING' }, (resp: unknown) => {
        clearTimeout(timer)
        const r = resp as ExtensionPingResult | undefined
        resolve(r?.success ? r : { success: false })
      })
    } catch {
      clearTimeout(timer)
      resolve({ success: false })
    }
  })
}

export async function pingExtension(extId: string): Promise<ExtensionPingResult> {
  const chromeApi = getChromeApi()
  if (!chromeApi?.runtime?.sendMessage) {
    console.log('[Jobseek Detect] No chrome.runtime.sendMessage API available')
    return { success: false }
  }

  // First attempt — 3s timeout
  console.log(`[Jobseek Detect] PING attempt 1 → ${extId.slice(0, 8)}...`)
  const first = await pingOnce(chromeApi, extId, 3000)
  if (first.success) {
    console.log('[Jobseek Detect] PING attempt 1 succeeded:', { version: first.version, deviceToken: first.deviceToken?.slice(0, 8), paused: first.scanningPaused })
    return first
  }
  console.log('[Jobseek Detect] PING attempt 1 failed (timeout or no response)')

  // Retry once after 1s — handles MV3 service worker wake-up delay
  await new Promise((r) => setTimeout(r, 1000))
  console.log(`[Jobseek Detect] PING attempt 2 (retry) → ${extId.slice(0, 8)}...`)
  const second = await pingOnce(chromeApi, extId, 3000)
  console.log(`[Jobseek Detect] PING attempt 2 ${second.success ? 'succeeded' : 'failed'}`)
  return second
}

export async function detectExtension(): Promise<ExtensionDetectResult> {
  const chromeApi = getChromeApi()
  if (!chromeApi?.runtime?.sendMessage) {
    console.log('[Jobseek Detect] detectExtension: chrome API not available (not Chrome?)')
    return { found: false }
  }

  // Try stored ID first
  const stored = localStorage.getItem('jobseek_extension_id')
  console.log(`[Jobseek Detect] detectExtension: stored ID = ${stored || 'none'}, known IDs = [${KNOWN_EXTENSION_IDS.join(', ')}]`)
  if (stored) {
    const r = await pingExtension(stored)
    if (r.success) {
      return {
        found: true,
        extId: stored,
        version: r.version,
        deviceToken: r.deviceToken,
        scanningPaused: r.scanningPaused,
        lastScanTime: r.lastScanTime,
      }
    }
  }

  // Try known IDs
  for (const id of KNOWN_EXTENSION_IDS) {
    if (id === stored) continue
    const r = await pingExtension(id)
    if (r.success) {
      localStorage.setItem('jobseek_extension_id', id)
      return {
        found: true,
        extId: id,
        version: r.version,
        deviceToken: r.deviceToken,
        scanningPaused: r.scanningPaused,
        lastScanTime: r.lastScanTime,
      }
    }
  }

  return { found: false }
}

export async function sendExtensionCommand(
  action: 'PAUSE_SCAN' | 'RESUME_SCAN' | 'TRIGGER_SCAN_NOW'
): Promise<boolean> {
  const chromeApi = getChromeApi()
  if (!chromeApi?.runtime?.sendMessage) return false

  const extId = localStorage.getItem('jobseek_extension_id')
  if (!extId) return false

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000)
    try {
      chromeApi.runtime!.sendMessage!(extId, { action }, (resp: unknown) => {
        clearTimeout(timer)
        const r = resp as { success?: boolean } | undefined
        resolve(!!r?.success)
      })
    } catch {
      clearTimeout(timer)
      resolve(false)
    }
  })
}
