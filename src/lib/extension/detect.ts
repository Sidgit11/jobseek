// ── Shared extension detection & communication ─────────────────────────────
// Used by onboarding page and signals page

export const EXTENSION_STORE_URL =
  'https://chromewebstore.google.com/detail/cbhlkanipdkdohhiocngfbcjhghpgcbm?utm_source=item-share-cb'

export const EXTENSION_ID = 'cbhlkanipdkdohhiocngfbcjhghpgcbm'

const KNOWN_EXTENSION_IDS = [EXTENSION_ID]

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

export async function pingExtension(extId: string): Promise<ExtensionPingResult> {
  const chromeApi = getChromeApi()
  if (!chromeApi?.runtime?.sendMessage) return { success: false }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ success: false }), 3000)
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

export async function detectExtension(): Promise<ExtensionDetectResult> {
  const chromeApi = getChromeApi()
  if (!chromeApi?.runtime?.sendMessage) return { found: false }

  // Try stored ID first
  const stored = localStorage.getItem('jobseek_extension_id')
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
