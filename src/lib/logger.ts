/**
 * Structured API logger.
 * Produces consistent, scannable output for every route step.
 *
 * Usage:
 *   const log = routeLogger('search')
 *   log.req({ query })
 *   log.step('exa', { results: 8 })
 *   log.res(200, { results: 8 })
 *   log.err('Supabase upsert failed', error)
 */

type LogLevel = 'REQ' | 'STEP' | 'RES' | 'ERR' | 'WARN'

function fmt(route: string, level: LogLevel, label: string, data?: unknown): string {
  const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  const dataStr = data !== undefined
    ? ' ' + JSON.stringify(data, null, 0)
        .replace(/"([^"]+)":/g, '$1:')   // unquote keys for readability
        .slice(0, 300)                    // cap length to avoid log spam
    : ''
  return `[${route}] ${level} ${label}${dataStr}`
}

export function routeLogger(route: string) {
  return {
    /** Log incoming request */
    req(data?: unknown) {
      console.log(fmt(route, 'REQ', '→', data))
    },

    /** Log an intermediate step */
    step(label: string, data?: unknown) {
      console.log(fmt(route, 'STEP', label, data))
    },

    /** Log successful response */
    res(status: number, data?: unknown) {
      console.log(fmt(route, 'RES', `${status}`, data))
    },

    /** Log a non-fatal warning */
    warn(label: string, data?: unknown) {
      console.warn(fmt(route, 'WARN', label, data))
    },

    /** Log an error */
    err(label: string, error?: unknown) {
      const msg = error instanceof Error ? error.message : String(error ?? '')
      console.error(fmt(route, 'ERR', label, msg ? { error: msg } : undefined))
    },
  }
}
