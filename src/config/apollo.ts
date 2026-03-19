export const APOLLO_CONFIG = {
  apiKey: process.env.APOLLO_API_KEY ?? '',
  baseUrl: process.env.APOLLO_BASE_URL ?? 'https://api.apollo.io/v1',
} as const
