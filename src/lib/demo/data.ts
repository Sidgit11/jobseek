/**
 * Complete demo dataset for the Jobseek.ai demo mode.
 * All data is realistic and research-based — real companies, real people,
 * high-quality AI-style summaries and outreach messages.
 *
 * Persona: Jordan Park, PM targeting Series A-C AI / SaaS companies in SF.
 */
import type { Company, Person, SearchResult, PipelineEntry, NewsItem } from '@/types'

// ─── Persona ────────────────────────────────────────────────────────────────

export const DEMO_PERSONA = {
  name: 'Jordan Park',
  email: 'jordan@demo.jobseek.ai',
  targetRoles: ['Product Manager', 'Head of Product'],
  targetIndustries: ['AI / ML', 'SaaS'],
  location: 'San Francisco, CA',
  candidateSummary:
    'Product manager with 5 years shipping consumer and enterprise AI products. Led search experience at [Company] from 0 to 2M daily queries. Obsessed with how AI explains its reasoning. Looking for Series A-C companies where PMs own outcomes end-to-end.',
}

// ─── Companies ──────────────────────────────────────────────────────────────

const perplexity: Company = {
  id: 'demo-perplexity',
  name: 'Perplexity AI',
  domain: 'perplexity.ai',
  website_url: 'https://perplexity.ai',
  funding_stage: 'Series B',
  last_round_date: '2024-04-23',
  headcount: 170,
  headcount_growth: '+112% YoY',
  total_funding: '$165M',
  investors: ['NEA', 'Databricks Ventures', 'Jeff Bezos', 'NVIDIA', 'IVP'],
  growth_signal: '15M+ MAU, 2x in 6 months',
  summary:
    'Perplexity AI is a Series B answer engine that has grown to 15M+ monthly active users in under two years, directly challenging Google in the $280B search market. After raising $165M, the company is aggressively expanding from consumer to enterprise with a Pro tier and API platform showing strong commercial traction. They recently launched a dedicated enterprise search product positioning against Microsoft Copilot and Google Workspace.',
  why_fit:
    'At ~170 people post-Series B, Perplexity is at the exact inflection point where product thinking compounds fastest — enterprise is wide open, the API platform needs PM leadership, and shipping decisions actually reach millions of users. For a PM with search and AI experience, the ownership here is unusually high for the stage.',
  hiring_signals: [
    '3 open PM roles on their careers page',
    'Engineering team doubled in the last 12 months',
    'Enterprise product line launched Q1 2025',
    'API platform for developers shipped — needs PM ownership',
  ],
  red_flags: [
    'Highly competitive — Google and OpenAI both shipping answer features',
  ],
  summary_updated_at: new Date().toISOString(),
  source: 'demo',
  logo_url: null,
  description:
    'The AI-powered answer engine. Ask anything, get instant, accurate answers backed by cited sources.',
  created_at: new Date().toISOString(),
}

const elevenlabs: Company = {
  id: 'demo-elevenlabs',
  name: 'ElevenLabs',
  domain: 'elevenlabs.io',
  website_url: 'https://elevenlabs.io',
  funding_stage: 'Series B',
  last_round_date: '2024-01-22',
  headcount: 200,
  headcount_growth: '+85% YoY',
  total_funding: '$101M',
  investors: ['Andreessen Horowitz', 'Salesforce Ventures', 'SoftBank', 'Instagram co-founder Mike Krieger'],
  growth_signal: '1M+ users, enterprise contracts at major media co\'s',
  summary:
    'ElevenLabs is the leading AI voice synthesis platform enabling ultra-realistic voice cloning and text-to-speech in 29+ languages. They\'ve grown from a research project to 1M+ users with enterprise contracts at major media companies including major publishers and streaming platforms. The ElevenLabs Studio product for enterprise dubbing and voice design is seeing rapid adoption.',
  why_fit:
    'Strong PM opportunity for someone interested in the creator economy and audio AI — ElevenLabs is building infrastructure for the next wave of media production, and the product surface is exploding from basic TTS to real-time voice synthesis, enterprise dubbing, and interactive audio. The Series B stage means defined product-market fit with room to own new lines.',
  hiring_signals: [
    'Launched ElevenLabs Studio for enterprise clients',
    'Expanding into gaming and interactive fiction verticals',
    'New voice design tools in beta — needs PM to drive to GA',
    'Headcount grew 85% in the last year',
  ],
  red_flags: [],
  summary_updated_at: new Date().toISOString(),
  source: 'demo',
  logo_url: null,
  description: 'The most realistic AI voice synthesis platform. Voice cloning, TTS, and audio AI for creators and enterprises.',
  created_at: new Date().toISOString(),
}

const harvey: Company = {
  id: 'demo-harvey',
  name: 'Harvey',
  domain: 'harvey.ai',
  website_url: 'https://harvey.ai',
  funding_stage: 'Series C',
  last_round_date: '2024-02-20',
  headcount: 250,
  headcount_growth: '+140% YoY',
  total_funding: '$206M',
  investors: ['Sequoia Capital', 'Google', 'OpenAI Fund', 'Kleiner Perkins'],
  growth_signal: '4 of 5 Magic Circle law firms as customers',
  summary:
    'Harvey is an AI platform for professional services, starting with legal — used by 4 of the 5 Magic Circle law firms and hundreds of top-tier firms globally. They raised a $100M Series C at a $1.5B valuation and are expanding beyond contract review into litigation, regulatory, and tax workflows. The depth of enterprise adoption in a traditionally slow-moving industry is a strong signal.',
  why_fit:
    'The Series C and deep enterprise focus means established PMF with a clear product expansion roadmap — ideal for a PM who wants to own a full product surface with Fortune 500 customers and measurable impact, without early-stage chaos. The expansion into tax and regulatory verticals creates genuinely new PM opportunities.',
  hiring_signals: [
    'Expanding product team for tax and regulatory verticals',
    'International expansion underway — new markets need localized product',
    'New enterprise dashboard and admin tooling releasing Q2',
    'Building out partner ecosystem for legal data integrations',
  ],
  red_flags: [
    'Slower-moving enterprise legal sales cycle vs. consumer AI',
    'Domain expertise in legal helps — steep learning curve without it',
  ],
  summary_updated_at: new Date().toISOString(),
  source: 'demo',
  logo_url: null,
  description: 'AI built for the legal profession. Contract review, litigation support, regulatory compliance, and more.',
  created_at: new Date().toISOString(),
}

const glean: Company = {
  id: 'demo-glean',
  name: 'Glean',
  domain: 'glean.com',
  website_url: 'https://glean.com',
  funding_stage: 'Series D+',
  last_round_date: '2024-02-27',
  headcount: 450,
  headcount_growth: '+68% YoY',
  total_funding: '$360M',
  investors: ['Kleiner Perkins', 'Sequoia Capital', 'Lightspeed Venture Partners', 'General Catalyst'],
  growth_signal: 'Deployed at Databricks, Okta, Duolingo, and 500+ enterprises',
  summary:
    'Glean is the enterprise AI search and knowledge management platform, deployed at companies including Databricks, Okta, and Duolingo. After raising $200M in February 2024, they\'re expanding aggressively into agentic AI with custom knowledge bases and workflow automation. The platform connects 100+ enterprise apps and surfaces information in real time.',
  why_fit:
    'Glean\'s Series D+ stage means a more defined PM structure with clear product areas to own — search quality, integrations, or their new AI assistant and agentic features. Good fit if you want enterprise scale and customer proximity with reduced early-stage ambiguity.',
  hiring_signals: [
    '15+ open engineering and product roles on their careers page',
    'New agentic AI product suite announcing at upcoming conference',
    'Expanding to APAC — new market product work available',
    'Partner marketplace team being built out from scratch',
  ],
  red_flags: [
    'Larger team (450+) means more process and fewer "0 to 1" opportunities',
    'Direct competition from Microsoft Copilot is intensifying',
  ],
  summary_updated_at: new Date().toISOString(),
  source: 'demo',
  logo_url: null,
  description: 'AI-powered enterprise search. Find anything across all your company\'s apps and documents instantly.',
  created_at: new Date().toISOString(),
}

const vapi: Company = {
  id: 'demo-vapi',
  name: 'Vapi',
  domain: 'vapi.ai',
  website_url: 'https://vapi.ai',
  funding_stage: 'Series A',
  last_round_date: '2024-11-08',
  headcount: 35,
  headcount_growth: '+200% YoY',
  total_funding: '$20M',
  investors: ['Y Combinator', 'Andreessen Horowitz', 'SV Angel'],
  growth_signal: '7,000+ developers, 4x customer growth in 6 months',
  summary:
    'Vapi is the leading voice AI API infrastructure for developers, making it possible for any company to add real-time, low-latency AI voice to their product in under an hour. With 7,000+ developers and partnerships with major call center platforms, they\'re emerging as the Twilio for AI voice. The Series A round positions them for enterprise expansion.',
  why_fit:
    'For a PM who wants to define a product category from scratch — Vapi is early enough that you\'ll shape what "great voice AI developer experience" means, with strong developer traction and the backing to scale. High ambiguity, high ownership, fast iteration.',
  hiring_signals: [
    'First dedicated PM hire — defining the role from scratch',
    'Customer base grew 4x in last 6 months',
    'Enterprise plan waitlist has 200+ companies',
    'New real-time API with sub-200ms latency in private beta',
  ],
  red_flags: [
    'Very early stage — requires comfort with high ambiguity and self-direction',
    'Developer-focused product — technical PM background strongly preferred',
  ],
  summary_updated_at: new Date().toISOString(),
  source: 'demo',
  logo_url: null,
  description: 'The voice AI platform for developers. Build, test, and deploy AI voice agents in minutes.',
  created_at: new Date().toISOString(),
}

// ─── Search Results ──────────────────────────────────────────────────────────

export const DEMO_RESULTS: SearchResult[] = [
  {
    company: perplexity,
    relevance_score: 91,
    exa_score: 0.95,
    match_reasons: ['Series B stage', 'AI / ML industry', 'Hiring PMs', 'SF-based'],
    snippet: 'Perplexity AI is redefining search with an AI-native answer engine. 15M+ users and growing — now expanding into enterprise with Pro and API products.',
    url: 'https://perplexity.ai',
    published_date: '2025-01-15',
  },
  {
    company: elevenlabs,
    relevance_score: 84,
    exa_score: 0.88,
    match_reasons: ['Series B stage', 'AI / ML industry', 'Growing team'],
    snippet: 'ElevenLabs is the gold standard in voice AI — ultra-realistic voice synthesis and cloning used by 1M+ creators and major media enterprises.',
    url: 'https://elevenlabs.io',
    published_date: '2025-01-22',
  },
  {
    company: harvey,
    relevance_score: 79,
    exa_score: 0.82,
    match_reasons: ['Series C stage', 'Enterprise AI', 'Rapid team expansion'],
    snippet: 'Harvey is the AI platform for professional services. Deployed at 4 of 5 Magic Circle law firms, now expanding into regulatory and tax workflows.',
    url: 'https://harvey.ai',
    published_date: '2025-02-01',
  },
  {
    company: glean,
    relevance_score: 74,
    exa_score: 0.76,
    match_reasons: ['AI / ML industry', 'Enterprise SaaS', '500+ enterprise customers'],
    snippet: 'Glean connects all your company apps and surfaces knowledge instantly with AI. Deployed at Databricks, Okta, Duolingo, and 500+ enterprises.',
    url: 'https://glean.com',
    published_date: '2025-01-10',
  },
  {
    company: vapi,
    relevance_score: 68,
    exa_score: 0.71,
    match_reasons: ['Series A', 'AI / ML', 'First PM hire opportunity'],
    snippet: 'Vapi is the developer platform for voice AI — enabling any company to add real-time, sub-200ms AI voice. 7,000+ developers and growing.',
    url: 'https://vapi.ai',
    published_date: '2025-01-28',
  },
]

// ─── Intelligence (News per company) ────────────────────────────────────────

export const DEMO_NEWS: Record<string, NewsItem[]> = {
  'demo-perplexity': [
    {
      title: 'Perplexity AI launches enterprise search product to take on Microsoft Copilot',
      url: 'https://techcrunch.com/perplexity-enterprise',
      snippet: 'Perplexity is targeting enterprise knowledge workers with a new product that indexes company data alongside the web, positioning directly against Copilot.',
      published_date: '2025-01-18',
    },
    {
      title: 'Perplexity hits 15M monthly active users, doubling in 6 months',
      url: 'https://techcrunch.com/perplexity-mau',
      snippet: 'The AI answer engine continues its rapid growth trajectory, driven by product improvements to source quality and mobile app launches.',
      published_date: '2024-12-05',
    },
    {
      title: 'Perplexity API opens to developers — enabling custom AI search',
      url: 'https://perplexity.ai/blog/api',
      snippet: 'The new Perplexity API gives developers programmatic access to its search and answer capabilities, opening a new revenue line for the company.',
      published_date: '2024-11-20',
    },
  ],
  'demo-elevenlabs': [
    {
      title: 'ElevenLabs raises $80M Series B to expand enterprise voice AI',
      url: 'https://techcrunch.com/elevenlabs-series-b',
      snippet: 'The voice synthesis startup is using the funding to expand its enterprise offering, including a new Studio product for media production workflows.',
      published_date: '2024-01-22',
    },
    {
      title: 'ElevenLabs Studio brings AI dubbing to film and TV production',
      url: 'https://elevenlabs.io/blog/studio',
      snippet: 'The new enterprise product enables studios to dub content into 29 languages with actor voice preservation, targeting major streaming platforms.',
      published_date: '2025-01-15',
    },
  ],
  'demo-harvey': [
    {
      title: 'Harvey raises $100M Series C at $1.5B valuation',
      url: 'https://techcrunch.com/harvey-series-c',
      snippet: 'The legal AI startup continues its rapid ascent with backing from Sequoia, Google, and the OpenAI Fund as it expands beyond contract review.',
      published_date: '2024-02-20',
    },
    {
      title: 'Harvey expands into tax and regulatory compliance workflows',
      url: 'https://harvey.ai/blog/tax-regulatory',
      snippet: 'New product lines targeting the $50B tax and regulatory compliance market, building on Harvey\'s document understanding capabilities.',
      published_date: '2025-01-08',
    },
  ],
  'demo-glean': [
    {
      title: 'Glean raises $200M to build AI agents for enterprise knowledge work',
      url: 'https://techcrunch.com/glean-series-d',
      snippet: 'The enterprise AI search company is expanding into autonomous agents that can take actions — not just surface information — across company tools.',
      published_date: '2024-02-27',
    },
  ],
  'demo-vapi': [
    {
      title: 'Vapi closes Series A as voice AI infrastructure heats up',
      url: 'https://techcrunch.com/vapi-series-a',
      snippet: 'The developer-first voice AI platform is seeing explosive growth as companies race to add AI voice capabilities to their products.',
      published_date: '2024-11-08',
    },
  ],
}

// ─── People ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString()

export const DEMO_PEOPLE: Record<string, Person[]> = {
  'demo-perplexity': [
    {
      id: 'demo-dmitry',
      company_id: 'demo-perplexity',
      name: 'Dmitry Shevelenko',
      title: 'Chief Business Officer',
      seniority: 'C-Level',
      linkedin_url: 'https://linkedin.com/in/dmitrys',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 88,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-aravind',
      company_id: 'demo-perplexity',
      name: 'Aravind Srinivas',
      title: 'CEO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/aravind-srinivas-16051987',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 72,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-denis',
      company_id: 'demo-perplexity',
      name: 'Denis Yarats',
      title: 'CTO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/denisyarats',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 65,
      cached_at: NOW,
      created_at: NOW,
    },
  ],
  'demo-elevenlabs': [
    {
      id: 'demo-chris-ladd',
      company_id: 'demo-elevenlabs',
      name: 'Chris Ladd',
      title: 'Head of Product',
      seniority: 'Head',
      linkedin_url: 'https://linkedin.com/in/chrisladd',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 92,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-mati',
      company_id: 'demo-elevenlabs',
      name: 'Mati Staniszewski',
      title: 'CEO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/matistaniszewski',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 78,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-piotr',
      company_id: 'demo-elevenlabs',
      name: 'Piotr Dąbkowski',
      title: 'CTO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/piotrdabkowski',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 65,
      cached_at: NOW,
      created_at: NOW,
    },
  ],
  'demo-harvey': [
    {
      id: 'demo-alyssa',
      company_id: 'demo-harvey',
      name: 'Alyssa Simpson Rochwerger',
      title: 'VP of Product',
      seniority: 'VP',
      linkedin_url: 'https://linkedin.com/in/alyssasimpsonrochwerger',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 92,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-winston',
      company_id: 'demo-harvey',
      name: 'Winston Weinberg',
      title: 'CEO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/winstonweinberg',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 75,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-gabriel',
      company_id: 'demo-harvey',
      name: 'Gabriel Pereyra',
      title: 'CTO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/gabrielpereyra',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 62,
      cached_at: NOW,
      created_at: NOW,
    },
  ],
  'demo-glean': [
    {
      id: 'demo-arvind-jain',
      company_id: 'demo-glean',
      name: 'Arvind Jain',
      title: 'CEO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/arvindjain',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 72,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-tamar',
      company_id: 'demo-glean',
      name: 'Tamar Yehoshua',
      title: 'President',
      seniority: 'C-Level',
      linkedin_url: 'https://linkedin.com/in/tamaryehoshua',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 85,
      cached_at: NOW,
      created_at: NOW,
    },
  ],
  'demo-vapi': [
    {
      id: 'demo-nikhil-vapi',
      company_id: 'demo-vapi',
      name: 'Nikhil Gupta',
      title: 'CEO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/nikhilgupta-vapi',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 82,
      cached_at: NOW,
      created_at: NOW,
    },
    {
      id: 'demo-jordan-vapi',
      company_id: 'demo-vapi',
      name: 'Jordan Dearsley',
      title: 'CTO & Co-Founder',
      seniority: 'Founder',
      linkedin_url: 'https://linkedin.com/in/jordandearsley',
      email: null,
      photo_url: null,
      apollo_id: null,
      outreach_priority_score: 68,
      cached_at: NOW,
      created_at: NOW,
    },
  ],
}

// ─── Outreach Variants ───────────────────────────────────────────────────────

export const DEMO_OUTREACH: Record<string, { linkedin: string; email_subject: string; email_body: string }> = {
  // Perplexity
  'demo-dmitry': {
    linkedin: `Hi Dmitry — Perplexity's enterprise push is the most interesting product bet in AI search right now. I've spent 4 years shipping search and AI features at scale, and I'd love to explore PM opportunities as you build out the commercial product. Open to a quick chat?`,
    email_subject: `PM with search background → Perplexity enterprise`,
    email_body: `Hi Dmitry,

The transition from consumer answer engine to enterprise search is exactly the kind of hard product problem I find most energizing — you're building for two different buyers simultaneously while keeping the core product magic intact.

I'm a product manager with 4 years shipping search and AI features. At my last company, I led the search experience team from 0 to 2M daily queries — obsessing over result quality, latency, and source attribution (sound familiar?).

I'd love 20 minutes to learn how the product team is structured for the enterprise push, and where PM ownership sits as you scale past $100M ARR.

Happy to share specifics on what I've shipped — available any time this week.

Jordan`,
  },
  'demo-aravind': {
    linkedin: `Hi Aravind — the way you've positioned Perplexity as a trust layer on top of the web is a genuinely different product bet. I've been shipping AI search products for 4 years and would love to explore PM opportunities. Open to a quick chat?`,
    email_subject: `PM interested in the Perplexity product vision`,
    email_body: `Hi Aravind,

The "answers you can trust" positioning is what sets Perplexity apart from the wave of AI chat products — and it's a genuinely hard product problem to maintain as you scale to enterprise.

I'm a PM with 4 years in AI and search, most recently leading the search experience team at [Company] from scratch to 2M daily active queries. I care deeply about how AI communicates uncertainty and cites sources — which feels directly relevant to what you're building.

Would love to learn more about where product thinking lives in the org as you grow. Happy to share what I've shipped.

20 minutes? I'm in SF.

Jordan`,
  },
  'demo-denis': {
    linkedin: `Hi Denis — the latency and retrieval architecture decisions at Perplexity's scale are fascinating to follow. I've been working at the intersection of search and AI as a PM and would love to learn more about the team. Open to a quick chat?`,
    email_subject: `PM with search/AI background — interested in Perplexity`,
    email_body: `Hi Denis,

The engineering decisions behind Perplexity's retrieval and answer generation pipeline are genuinely impressive — especially maintaining sub-2s response times at 15M MAU scale.

I'm a product manager who spends a lot of time in the technical weeds. At my last company I partnered directly with ML engineers to define our ranking and retrieval roadmap, which taught me to think about search quality as a product problem, not just an engineering one.

I'd love to learn more about how product and engineering collaborate at Perplexity, and where you see the most leverage in the next 12 months.

Happy to chat any time — Jordan`,
  },

  // ElevenLabs
  'demo-chris-ladd': {
    linkedin: `Hi Chris — the new ElevenLabs Studio enterprise product is a great product bet. I've been building audio/AI features for creator platforms and would love to explore PM opportunities as you expand the product surface. Open to a chat?`,
    email_subject: `PM with audio product background — ElevenLabs`,
    email_body: `Hi Chris,

ElevenLabs has done something rare — made a technically complex AI capability feel simple enough for non-technical creators. That gap between raw capability and delightful UX is exactly where I spend most of my time as a PM.

I've spent the past 3 years building audio-first features for a creator platform with 5M+ users — shipping voice synthesis, real-time transcription, and an enterprise dubbing workflow now used by 3 major media companies.

I'd love to understand how the product team is structured as you expand into enterprise, gaming, and interactive media. Happy to share specific examples of my work and what I think is the hardest UX problem in voice AI right now.

Available any time — Jordan`,
  },
  'demo-mati': {
    linkedin: `Hi Mati — the voice cloning quality ElevenLabs ships is genuinely remarkable. I've been building audio and AI products for 3 years and would love to explore PM opportunities as you scale the platform. Open to a quick chat?`,
    email_subject: `PM with voice/audio background → ElevenLabs`,
    email_body: `Hi Mati,

The jump from consumer TTS to ElevenLabs Studio for enterprise is the right bet — and it's a fascinating product challenge to make something that works for both individual creators and professional media workflows.

I'm a PM with 3 years shipping audio-first features for creators at scale. Most recently I led the voice synthesis product at [Company], growing from beta to 500K monthly users with an NPS of 72. I care a lot about how AI voice communicates naturalness — not just raw quality.

I'd love to learn more about where the product team is focused in 2025. 20 minutes?

Jordan`,
  },
  'demo-piotr': {
    linkedin: `Hi Piotr — the engineering work on ElevenLabs' real-time synthesis latency is impressive. I work at the technical PM layer and would love to learn more about how the team thinks about the capability roadmap. Open to a chat?`,
    email_subject: `Technical PM interested in ElevenLabs`,
    email_body: `Hi Piotr,

The latency improvements in ElevenLabs' real-time API are a big deal — getting below 200ms opens up use cases that just weren't possible before, especially for interactive applications.

I'm a product manager who gets deep into the technical side. I've spent 3 years partnering with audio ML engineers to define capability roadmaps, and I care about how infrastructure decisions translate into user experiences.

Would love 20 minutes to learn about how you think about the capability roadmap and where PM thinking adds the most value at ElevenLabs.

Happy to share my background — Jordan`,
  },

  // Harvey
  'demo-alyssa': {
    linkedin: `Hi Alyssa — Harvey's expansion from contract review into litigation and tax workflows is exactly the kind of product complexity I'm drawn to. I've been shipping B2B AI features for 4 years and would love to chat about PM roles. Open to a call?`,
    email_subject: `PM interested in Harvey's vertical expansion`,
    email_body: `Hi Alyssa,

The move from contract review to full-stack legal AI is a fascinating PM challenge — you're essentially productizing an entire profession's workflow, one use case at a time, while maintaining the precision that legal work demands.

I've spent the last 4 years as a PM building B2B AI products, most recently shipping document intelligence features used by Fortune 500 legal and compliance teams. I care deeply about how AI explains its reasoning — especially for high-stakes decisions where users need to be able to audit the output.

I'd love to learn how the product team is organized across verticals and where PM ownership sits as Harvey expands. Happy to share specifics of what I've built.

20 minutes this week?

Jordan`,
  },
  'demo-winston': {
    linkedin: `Hi Winston — Harvey's adoption across Magic Circle firms in under 3 years is one of the most impressive enterprise AI stories. I've been building legal and compliance AI products and would love to learn more about PM opportunities. Open to a quick chat?`,
    email_subject: `PM with legal tech background — Harvey`,
    email_body: `Hi Winston,

Getting 4 of 5 Magic Circle firms to adopt a new AI workflow in under 3 years is a genuinely hard enterprise sales and product story — the trust bar in that market is exceptionally high.

I'm a product manager with 4 years shipping AI tools for legal and compliance teams. I've learned a lot about what it takes to get lawyers to trust AI output: explainability, citation quality, and clear scope of what the model does and doesn't do.

I'd love 20 minutes to learn about where the product team is focused as you expand into new verticals, and how PM thinking fits into Harvey's culture.

Jordan`,
  },
  'demo-gabriel': {
    linkedin: `Hi Gabriel — the underlying document understanding technology at Harvey seems to go well beyond standard RAG approaches. I've been working at the technical PM layer for legal AI products and would love to learn more about the team. Open to a chat?`,
    email_subject: `Technical PM interested in Harvey's AI infrastructure`,
    email_body: `Hi Gabriel,

The precision Harvey achieves on legal document analysis seems to go well beyond standard RAG approaches — especially on the document structure understanding that matters for contracts and case filings.

I'm a technical PM who has spent 4 years at the intersection of legal document workflows and AI. I've shipped products where hallucination rates and source attribution aren't just metrics — they're existential to adoption.

Would love to understand how product and engineering collaborate at Harvey, and where the hardest technical-product problems live right now.

Happy to connect — Jordan`,
  },
}

// ─── Emails (revealed on "Find Email" click) ────────────────────────────────

/** Plausible work emails for demo personas — shown after "Find Email" is clicked */
export const DEMO_EMAILS: Record<string, string> = {
  'demo-dmitry':      'dmitry@perplexity.ai',
  'demo-aravind':     'aravind@perplexity.ai',
  'demo-denis':       'denis@perplexity.ai',
  'demo-chris-ladd':  'chris@elevenlabs.io',
  'demo-mati':        'mati@elevenlabs.io',
  'demo-piotr':       'piotr@elevenlabs.io',
  'demo-alyssa':      'alyssa@harvey.ai',
  'demo-winston':     'winston@harvey.ai',
  'demo-gabriel':     'gabriel@harvey.ai',
  'demo-arvind-jain': 'arvind@glean.com',
  'demo-tamar':       'tamar@glean.com',
  'demo-nikhil-vapi': 'nikhil@vapi.ai',
  'demo-jordan-vapi': 'jordan@vapi.ai',
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export const DEMO_PIPELINE: PipelineEntry[] = [
  {
    id: 'pipeline-1',
    user_id: 'demo-user',
    company_id: 'demo-perplexity',
    person_id: null,
    status: 'saved',
    notes: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    company: perplexity,
    person: undefined,
  },
  {
    id: 'pipeline-2',
    user_id: 'demo-user',
    company_id: 'demo-elevenlabs',
    person_id: 'demo-chris-ladd',
    status: 'messaged',
    notes: null,
    created_at: daysAgo(6),
    updated_at: daysAgo(5),
    company: elevenlabs,
    person: DEMO_PEOPLE['demo-elevenlabs'][0],
  },
  {
    id: 'pipeline-3',
    user_id: 'demo-user',
    company_id: 'demo-harvey',
    person_id: 'demo-alyssa',
    status: 'replied',
    notes: null,
    created_at: daysAgo(12),
    updated_at: daysAgo(8),
    company: harvey,
    person: DEMO_PEOPLE['demo-harvey'][0],
  },
  {
    id: 'pipeline-4',
    user_id: 'demo-user',
    company_id: 'demo-glean',
    person_id: 'demo-tamar',
    status: 'interviewing',
    notes: null,
    created_at: daysAgo(20),
    updated_at: daysAgo(12),
    company: glean,
    person: DEMO_PEOPLE['demo-glean'][1],
  },
]
