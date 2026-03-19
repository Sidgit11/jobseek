import type { Company } from '@/types'

interface CrunchbaseOrg {
  properties: {
    short_description?: string
    funding_total?: { value_usd?: number }
    last_funding_type?: string
    last_funding_at?: string
    num_employees_enum?: string
    website_url?: string
    linkedin?: { value?: string }
    investor_identifiers?: Array<{ value: string }>
  }
}

function parseHeadcount(enum_val: string | undefined): number | null {
  if (!enum_val) return null
  const map: Record<string, number> = {
    c_00001_00010: 5,
    c_00011_00050: 30,
    c_00051_00100: 75,
    c_00101_00250: 175,
    c_00251_00500: 375,
    c_00501_01000: 750,
    c_01001_05000: 3000,
    c_05001_10000: 7500,
    c_10001_max: 15000,
  }
  return map[enum_val.toLowerCase()] ?? null
}

function parseFundingStage(type: string | undefined): string | null {
  if (!type) return null
  const map: Record<string, string> = {
    pre_seed: 'Pre-Seed',
    seed: 'Seed',
    series_a: 'Series A',
    series_b: 'Series B',
    series_c: 'Series C',
    series_d: 'Series D+',
    series_e: 'Series D+',
    series_f: 'Series D+',
    growth_equity: 'Growth',
    ipo: 'Public',
    angel: 'Pre-Seed',
    grant: 'Bootstrapped',
  }
  return map[type.toLowerCase()] ?? type
}

function formatFunding(usd: number | undefined): string | null {
  if (!usd) return null
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`
  return `$${usd}`
}

const FIELDS = 'short_description,funding_total,last_funding_type,last_funding_at,num_employees_enum,website_url,investor_identifiers'

/** Generate slug candidates to try in order. Crunchbase slugs ≠ domain names.
 *  e.g. scale.ai → try "scale" first, then "scale-ai"
 *       elevenlabs.io → try "elevenlabs" (correct), "elevenlabs-io" (fallback)
 */
function slugCandidates(domain: string): string[] {
  const clean = domain.replace('www.', '').toLowerCase()
  const parts = clean.split('.')
  const name = parts[0]
  const tld = parts[parts.length - 1]
  return [name, `${name}-${tld}`]
}

async function fetchOrgBySlug(slug: string, apiKey: string): Promise<Partial<Company> | null> {
  try {
    const res = await fetch(
      `https://api.crunchbase.com/api/v4/entities/organizations/${slug}?user_key=${apiKey}&field_ids=${FIELDS}`,
      { next: { revalidate: 86400 } } // 24h Next.js edge cache
    )
    if (!res.ok) return null

    const data: { data: CrunchbaseOrg } = await res.json()
    const props = data.data.properties

    return {
      funding_stage: parseFundingStage(props.last_funding_type),
      last_round_date: props.last_funding_at ?? null,
      headcount: parseHeadcount(props.num_employees_enum),
      total_funding: formatFunding(props.funding_total?.value_usd),
      investors: props.investor_identifiers?.slice(0, 5).map(i => i.value) ?? [],
      description: props.short_description ?? null,
      website_url: props.website_url ?? null,
    }
  } catch {
    return null
  }
}

export async function enrichCompany(domain: string): Promise<Partial<Company>> {
  const apiKey = process.env.CRUNCHBASE_API_KEY
  if (!apiKey) return {}

  for (const slug of slugCandidates(domain)) {
    const result = await fetchOrgBySlug(slug, apiKey)
    if (result) return result
  }

  return {}
}
