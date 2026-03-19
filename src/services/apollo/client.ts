import { APOLLO_CONFIG } from '@/config/apollo'

export class ApolloError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Apollo API error ${status}: ${body}`)
  }
}

export function apolloHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'x-api-key': APOLLO_CONFIG.apiKey,
  }
}

export async function apolloPost<T>(path: string, body: unknown): Promise<T> {
  if (!APOLLO_CONFIG.apiKey) {
    throw new ApolloError(401, 'APOLLO_API_KEY not set')
  }

  const res = await fetch(`${APOLLO_CONFIG.baseUrl}${path}`, {
    method: 'POST',
    headers: apolloHeaders(),
    body: JSON.stringify(body),
  })

  if (res.status === 429) throw new ApolloError(429, 'Rate limit hit — retry after 60s')
  if (res.status === 401) throw new ApolloError(401, 'Invalid API key')
  if (res.status === 403) throw new ApolloError(403, 'Endpoint not available on current Apollo plan')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApolloError(res.status, text)
  }

  return res.json() as Promise<T>
}
