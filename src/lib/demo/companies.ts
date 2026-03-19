/**
 * Tier-3 fallback: curated real startups used when BOTH Exa AND Claude are
 * unavailable (no API keys / no credits). Lets the UI work end-to-end
 * so you can see the full flow without any external APIs.
 */
import type { CompanySearchResult } from '@/lib/exa/search'

interface DemoCompany extends CompanySearchResult {
  _meta: {
    stage: string
    headcount: number
    location: string
    investors: string[]
    industries: string[]
    keywords: string[]
  }
}

const DEMO_COMPANIES: DemoCompany[] = [
  {
    name: 'Linear', domain: 'linear.app', url: 'https://linear.app', score: 0.9,
    snippet: 'The issue tracking tool built for high-performance teams. Linear streamlines software projects, sprints, tasks, and bug tracking with a beautifully fast interface.',
    published_date: null,
    _meta: { stage: 'Series B', headcount: 80, location: 'San Francisco, CA', investors: ['Sequoia', 'Accel'], industries: ['Developer Tools', 'SaaS'], keywords: ['developer tools', 'productivity', 'saas'] },
  },
  {
    name: 'Retool', domain: 'retool.com', url: 'https://retool.com', score: 0.87,
    snippet: 'The fastest way to build internal tools. Retool lets you drag-and-drop pre-built components onto a canvas, connecting them to databases and APIs.',
    published_date: null,
    _meta: { stage: 'Series C', headcount: 400, location: 'San Francisco, CA', investors: ['Sequoia', 'Y Combinator'], industries: ['Developer Tools', 'SaaS'], keywords: ['developer tools', 'internal tools', 'low-code'] },
  },
  {
    name: 'Runway', domain: 'runwayml.com', url: 'https://runwayml.com', score: 0.85,
    snippet: 'AI-powered creative tools for video editing, image generation, and more. Backed by Google and Salesforce with $237M raised.',
    published_date: null,
    _meta: { stage: 'Series C', headcount: 150, location: 'New York, NY', investors: ['Google', 'Salesforce Ventures', 'General Atlantic'], industries: ['AI / ML', 'Consumer'], keywords: ['AI', 'video generation', 'creative tools'] },
  },
  {
    name: 'Glean', domain: 'glean.com', url: 'https://glean.com', score: 0.84,
    snippet: 'Enterprise AI search and knowledge management. Glean uses AI to search across all company apps and surfaces the right information instantly.',
    published_date: null,
    _meta: { stage: 'Series D+', headcount: 300, location: 'Palo Alto, CA', investors: ['Kleiner Perkins', 'Sequoia', 'Lightspeed'], industries: ['AI / ML', 'SaaS', 'Developer Tools'], keywords: ['enterprise search', 'AI', 'knowledge management'] },
  },
  {
    name: 'EvenUp', domain: 'evenuplaw.com', url: 'https://evenuplaw.com', score: 0.82,
    snippet: 'AI-powered legal demand letter generation for personal injury law firms. Raised $135M Series D to transform legal document workflows.',
    published_date: null,
    _meta: { stage: 'Series D+', headcount: 250, location: 'San Francisco, CA', investors: ['Base10 Partners', 'Bain Capital Ventures'], industries: ['AI / ML', 'SaaS'], keywords: ['legaltech', 'AI', 'documents'] },
  },
  {
    name: 'Hex', domain: 'hex.tech', url: 'https://hex.tech', score: 0.81,
    snippet: 'Collaborative data workspace for notebooks, dashboards, and data apps. Teams at Spotify, Lyft and more use Hex for analytics.',
    published_date: null,
    _meta: { stage: 'Series B', headcount: 100, location: 'San Francisco, CA', investors: ['Andreessen Horowitz', 'Redpoint Ventures'], industries: ['Developer Tools', 'SaaS'], keywords: ['data analytics', 'notebooks', 'BI'] },
  },
  {
    name: 'Vanta', domain: 'vanta.com', url: 'https://vanta.com', score: 0.80,
    snippet: 'Automated security compliance for SOC 2, ISO 27001, and HIPAA. Vanta helps 5000+ companies get and stay compliant with continuous monitoring.',
    published_date: null,
    _meta: { stage: 'Series C', headcount: 400, location: 'San Francisco, CA', investors: ['Sequoia', 'Y Combinator'], industries: ['SaaS', 'Developer Tools'], keywords: ['security', 'compliance', 'SOC2'] },
  },
  {
    name: 'Cognition AI', domain: 'cognition.ai', url: 'https://cognition.ai', score: 0.88,
    snippet: 'Building Devin, the world\'s first AI software engineer. Cognition raised $175M Series A at a $2B valuation from Peter Thiel and others.',
    published_date: null,
    _meta: { stage: 'Series A', headcount: 30, location: 'San Francisco, CA', investors: ['Peter Thiel', 'Eric Schmidt', 'Andreessen Horowitz'], industries: ['AI / ML', 'Developer Tools'], keywords: ['AI engineering', 'coding agent', 'LLM'] },
  },
  {
    name: 'Cursor', domain: 'cursor.sh', url: 'https://cursor.sh', score: 0.87,
    snippet: 'The AI-first code editor built for pair-programming with AI. Cursor has taken the developer market by storm with deep codebase understanding.',
    published_date: null,
    _meta: { stage: 'Series B', headcount: 50, location: 'San Francisco, CA', investors: ['Andreessen Horowitz', 'OpenAI'], industries: ['AI / ML', 'Developer Tools'], keywords: ['AI coding', 'code editor', 'LLM'] },
  },
  {
    name: 'Cohere', domain: 'cohere.com', url: 'https://cohere.com', score: 0.83,
    snippet: 'Enterprise AI platform for language understanding and generation. Cohere powers RAG, classification and embedding for Fortune 500 companies.',
    published_date: null,
    _meta: { stage: 'Series C', headcount: 400, location: 'Toronto, Canada', investors: ['NVIDIA', 'Salesforce', 'Index Ventures'], industries: ['AI / ML', 'Developer Tools'], keywords: ['LLM', 'enterprise AI', 'NLP'] },
  },
  {
    name: 'Rippling', domain: 'rippling.com', url: 'https://rippling.com', score: 0.79,
    snippet: 'The workforce management platform that unifies HR, IT, and Finance. Rippling connects every part of the employee system of record.',
    published_date: null,
    _meta: { stage: 'Series F', headcount: 2000, location: 'San Francisco, CA', investors: ['Founders Fund', 'Kleiner Perkins'], industries: ['SaaS', 'Fintech'], keywords: ['HR tech', 'workforce', 'SaaS'] },
  },
  {
    name: 'Ramp', domain: 'ramp.com', url: 'https://ramp.com', score: 0.78,
    snippet: 'Corporate card and finance automation platform. Ramp helps companies spend less with automated expense management, bill pay, and accounting.',
    published_date: null,
    _meta: { stage: 'Series D+', headcount: 700, location: 'New York, NY', investors: ['Founders Fund', 'D1 Capital Partners', 'Stripe'], industries: ['Fintech', 'SaaS'], keywords: ['fintech', 'expense management', 'corporate card'] },
  },
]

/**
 * Filter companies by search intent keywords and industries.
 * Returns best-matched companies ordered by score.
 */
export function getDemoCompanies(
  keywords: string[],
  industries: string[]
): CompanySearchResult[] {
  const kwLower = keywords.map(k => k.toLowerCase())
  const indLower = industries.map(i => i.toLowerCase())

  const scored = DEMO_COMPANIES.map(c => {
    let boost = 0
    const meta = c._meta

    // Keyword match in name/snippet/keywords
    const searchable = `${c.name} ${c.snippet} ${meta.keywords.join(' ')}`.toLowerCase()
    for (const kw of kwLower) {
      if (searchable.includes(kw)) boost += 10
    }

    // Industry match
    for (const ind of indLower) {
      if (meta.industries.some(i => i.toLowerCase().includes(ind) || ind.includes(i.toLowerCase()))) {
        boost += 15
      }
    }

    return { ...c, score: Math.min(c.score + boost / 100, 1.0) }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ ...rest }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _meta, ...clean } = rest as DemoCompany
      return clean
    })
}
