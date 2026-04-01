/**
 * CORS helper for routes called by the Chrome extension.
 * Allows chrome-extension:// origins and the app's own domains.
 */

const ALLOWED_ORIGINS = [
  'https://jobseek.ai',
  'https://www.jobseek.ai',
  'https://jobseek-sigma.vercel.app',
]

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin ?? ''

  const isAllowed =
    origin.startsWith('chrome-extension://') ||
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.vercel.app') ||
    (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost'))

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
