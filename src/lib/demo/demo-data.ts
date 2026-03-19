/**
 * JOBSEEK.AI — DEMO MODE DATA
 *
 * Used when NEXT_PUBLIC_DEMO_MODE=true (or ?demo=true in URL).
 * Returns instant data without any API/DB calls — ideal for investor demos,
 * user testing, and onboarding flows.
 *
 * Data is based on real companies and real people as of 2024.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (inline to avoid import issues in demo mode)
// ─────────────────────────────────────────────────────────────────────────────

export interface DemoCompany {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  fundingStage: string;
  lastRoundDate: string;
  totalFunding: string;
  headcount: number;
  headcountGrowth: string;
  investors: string[];
  growthSignal: string;
  summary: string;
  whyFit: string;
  hiringSignals: string[];
  fitScore: number; // 0–100
  source: string;
}

export interface DemoPerson {
  id: string;
  companyId: string;
  name: string;
  title: string;
  seniority: "C-Suite" | "VP/Director" | "Manager" | "IC";
  linkedinUrl: string;
  email: string;
  outreachPriorityScore: number;
  photoInitials: string; // fallback for missing photos
  photoColor: string; // tailwind bg color for avatar
}

export interface DemoOutreachDraft {
  id: string;
  personId: string;
  companyId: string;
  type: "linkedin" | "email";
  subject?: string;
  body: string;
  sentFlag: boolean;
}

export interface DemoPipelineEntry {
  companyId: string;
  personId?: string;
  status: "saved" | "messaged" | "replied" | "interviewing";
  notes: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO USER
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_USER = {
  id: "a0000000-0000-0000-0000-000000000001",
  name: "Alex Chen",
  headline: "Senior Product Manager · AI/SaaS · Ex-Stripe · Ex-Notion",
  location: "San Francisco, CA",
  targetRoles: ["Product Manager", "Senior PM", "Lead PM", "Head of Product"],
  targetIndustries: ["AI/ML", "Developer Tools", "SaaS", "Productivity"],
  candidateSummary:
    "Senior PM with Stripe + Notion pedigree. Shipped AI features to 2M+ users at Notion, drove 18% checkout conversion lift at Stripe. Strong 0→1 track record with a data-first, ship-fast philosophy. Looking for a high-autonomy PM role at an AI-native company where product and engineering are tightly coupled.",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPANIES
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    id: "c0000001-0000-0000-0000-000000000001",
    name: "Glean",
    domain: "glean.com",
    logoUrl: "https://logo.clearbit.com/glean.com",
    fundingStage: "Series E",
    lastRoundDate: "Sep 2024",
    totalFunding: "$460M raised",
    headcount: 820,
    headcountGrowth: "+32% in 12mo",
    investors: ["Altimeter Capital", "Sequoia", "Kleiner Perkins", "General Catalyst"],
    growthSignal: "Tripled ARR, crossed $100M. Glean Agents on track for 1B actions in 2025.",
    summary:
      "Glean is the enterprise AI search platform — Google for work. Connects to 100+ enterprise tools and lets employees find answers, automate tasks, and build AI agents on top of company knowledge. Series E at $4.6B valuation, led by Altimeter.",
    whyFit:
      "You'd be building AI product on top of live enterprise data with ex-Google engineers. Their Agents roadmap is the real 0→1 work — and your Notion AI experience maps directly to what they need.",
    hiringSignals: [
      "Hiring for Agents product team in SF",
      "Expanding go-to-market post Series E",
      "Named Gartner Cool Vendor 2024",
      "New embedded solutions for Zendesk + Salesforce",
    ],
    fitScore: 91,
    source: "Crunchbase + Glean press release",
  },
  {
    id: "c0000002-0000-0000-0000-000000000002",
    name: "Vercel",
    domain: "vercel.com",
    logoUrl: "https://logo.clearbit.com/vercel.com",
    fundingStage: "Series D",
    lastRoundDate: "May 2024",
    totalFunding: "$563M raised",
    headcount: 650,
    headcountGrowth: "+28% in 12mo",
    investors: ["Greenoaks Capital", "GV", "CRV", "Bessemer", "Tiger Global"],
    growthSignal: "$250M Series D at $3.25B. v0.dev public launch. 1M+ developer projects on platform.",
    summary:
      "Vercel is the frontend cloud platform behind Next.js. Over 1M developers deploy on Vercel. In 2024 they launched v0.dev — an AI tool that generates production-ready Next.js UI from a text prompt. Pivoting from infrastructure to AI-native developer tooling.",
    whyFit:
      "Vercel is at the exact inflection point where infrastructure becomes product. v0.dev is the most interesting AI developer tool right now — they need PMs who think about developer UX and consumer-grade AI simultaneously. Your Notion 0→1 background is a direct match.",
    hiringSignals: [
      "v0.dev public launch driving massive inbound",
      "Tom Occhino (ex-Meta CPO) joined as CPO",
      "Hiring PMs for AI SDK and developer experience",
      "Series D signals aggressive product expansion",
    ],
    fitScore: 88,
    source: "Crunchbase + Vercel blog",
  },
  {
    id: "c0000006-0000-0000-0000-000000000006",
    name: "Perplexity AI",
    domain: "perplexity.ai",
    logoUrl: "https://logo.clearbit.com/perplexity.ai",
    fundingStage: "Series B",
    lastRoundDate: "Apr 2024",
    totalFunding: "$165M raised",
    headcount: 100,
    headcountGrowth: "+150% in 12mo",
    investors: ["Jeff Bezos", "Nvidia", "Databricks", "NEA", "IVP"],
    growthSignal: "30M+ queries/day, 20% MoM growth. Crossed 10M DAU. Launched Perplexity Pages.",
    summary:
      "Perplexity AI is the AI answer engine — a direct challenger to Google Search. Instead of links, you get cited answers. 30M+ queries per day, 20% MoM growth, $1B Series B valuation. Backed by Bezos, Nvidia, Databricks. Team of ~100, growing aggressively.",
    whyFit:
      "Rarest of opportunities — 0→1 product at breakneck growth on the most contested market in tech. They need PMs who can ship fast AND think deeply about information quality. Your user-obsessed DNA from Notion maps perfectly to their product culture.",
    hiringSignals: [
      "Hiring PM for Pro and Enterprise tiers",
      "Perplexity Pages launch shows content play expanding",
      "Series B close unlocks aggressive product hiring",
      "Moving from consumer to B2B API tier",
    ],
    fitScore: 85,
    source: "Crunchbase + TechCrunch",
  },
  {
    id: "c0000007-0000-0000-0000-000000000007",
    name: "Runway",
    domain: "runwayml.com",
    logoUrl: "https://logo.clearbit.com/runwayml.com",
    fundingStage: "Series C",
    lastRoundDate: "Jun 2023",
    totalFunding: "$237M raised",
    headcount: 140,
    headcountGrowth: "+40% in 12mo",
    investors: ["Google", "Salesforce Ventures", "Nvidia", "Andreessen Horowitz", "Felicis Ventures"],
    growthSignal: "Gen-3 Alpha launched as industry-leading video model. API opened Sep 2024. Hollywood studio partnerships signed.",
    summary:
      "Runway is the AI video generation platform used by filmmakers, designers, and studios. Gen-3 Alpha is the industry-leading video model. Backed by Google, Nvidia, and a16z. ~140 employees, NYC-based, creative culture at its core.",
    whyFit:
      "The intersection of AI and creativity is the most under-built product surface right now. Runway is the only company with actual Hollywood traction. If you want to define what AI-native creative tools look like — this is the only place to do it.",
    hiringSignals: [
      "Gen-3 Alpha API opening new enterprise use cases",
      "Studio partnerships creating B2B product surface",
      "Hiring creative PM for professional filmmaker workflows",
      "NYC office expansion underway",
    ],
    fitScore: 82,
    source: "Crunchbase + Runway news",
  },
  {
    id: "c0000004-0000-0000-0000-000000000004",
    name: "Retool",
    domain: "retool.com",
    logoUrl: "https://logo.clearbit.com/retool.com",
    fundingStage: "Series C",
    lastRoundDate: "Jul 2022",
    totalFunding: "$95M raised",
    headcount: 460,
    headcountGrowth: "+18% in 12mo",
    investors: ["Sequoia Capital", "Bedrock Capital", "Y Combinator", "Elad Gil"],
    growthSignal: "$138M ARR as of 2024. Launched Retool AI. 500+ enterprise customers at Retool Summit.",
    summary:
      "Retool is the internal tools builder — drag-and-drop + code to build dashboards and admin panels 10x faster. $138M ARR, $3.2B valuation, ~460 employees. In 2024 they launched Retool AI to bring LLMs into internal workflows.",
    whyFit:
      "Retool AI is where the 0→1 PM work lives. They're applying LLMs to a workflow that exists in every company, with proven enterprise distribution. Lower risk, high leverage. Your Stripe background means you understand enterprise buyer behavior.",
    hiringSignals: [
      "Abhishek Gupta joined as Head of Product Jul 2025",
      "Retool AI product hiring PMs",
      "Summit 2025 shows strong enterprise momentum",
      "Engineering PM roles open in SF",
    ],
    fitScore: 78,
    source: "Crunchbase + Retool blog",
  },
  {
    id: "c0000003-0000-0000-0000-000000000003",
    name: "Linear",
    domain: "linear.app",
    logoUrl: "https://logo.clearbit.com/linear.app",
    fundingStage: "Series B",
    lastRoundDate: "Nov 2022",
    totalFunding: "$52M raised",
    headcount: 85,
    headcountGrowth: "+70% in 18mo",
    investors: ["Sequoia Capital", "Tiger Global Management"],
    growthSignal: "Profitable. 66% of Forbes top 50 AI companies use Linear. Launched Linear AI. 10k+ paying teams.",
    summary:
      "Linear is the project management tool for software teams that care about craft. Obsessively fast, minimal, opinionated. Profitable at $1.25B valuation with a team of ~85. No bloat, no dashboards — just the work.",
    whyFit:
      "Dream PM role for someone with your product sensibility. Small team, massive user base, craft-obsessed culture. You'd own entire product surfaces with extreme autonomy. Your Notion AI experience makes you a rare fit for Linear AI.",
    hiringSignals: [
      "Hiring first PM focused on AI features",
      "Building Linear AI product line",
      "Expanding enterprise tier",
      "Recently hired GTM lead — growth phase starting",
    ],
    fitScore: 76,
    source: "LinkedIn + Crunchbase",
  },
  {
    id: "c0000005-0000-0000-0000-000000000005",
    name: "Hex",
    domain: "hex.tech",
    logoUrl: "https://logo.clearbit.com/hex.tech",
    fundingStage: "Series B",
    lastRoundDate: "Mar 2022",
    totalFunding: "$172M raised",
    headcount: 167,
    headcountGrowth: "+22% in 12mo",
    investors: ["Andreessen Horowitz", "Amplify Partners", "Redpoint", "Databricks", "Snowflake"],
    growthSignal: "Launched Magic AI. $19.8M ARR (Oct 2024). Databricks + Snowflake as strategic investors and distribution partners.",
    summary:
      "Hex is a collaborative data workspace — think Jupyter Notebooks meets Notion, with AI built in. Data teams use Hex to analyze data, build visualizations, and ship data apps. Backed by a16z with Databricks and Snowflake as strategic partners.",
    whyFit:
      "If you can think in data workflows, this PM role is unusually high-leverage. They're at the intersection of data infrastructure and AI tooling. Your ability to instrument and measure from Stripe and Notion is exactly the PM DNA they hire for.",
    hiringSignals: [
      "Magic AI launch driving enterprise upgrades",
      "Databricks + Snowflake partnership = built-in distribution",
      "New enterprise tier with SSO and audit logs",
      "Hiring PM for AI-assisted analysis features",
    ],
    fitScore: 72,
    source: "Crunchbase + Hex blog",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_PEOPLE: DemoPerson[] = [
  // GLEAN
  {
    id: "p0000001-0000-0000-0000-000000000001",
    companyId: "c0000001-0000-0000-0000-000000000001",
    name: "Arvind Jain",
    title: "Co-Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/arvind-jain-glean",
    email: "arvind@glean.com",
    outreachPriorityScore: 85,
    photoInitials: "AJ",
    photoColor: 'var(--color-lime)',
  },
  {
    id: "p0000003-0000-0000-0000-000000000003",
    companyId: "c0000001-0000-0000-0000-000000000001",
    name: "Piyush Prahladka",
    title: "Co-Founder & Head of Product",
    seniority: "VP/Director",
    linkedinUrl: "https://linkedin.com/in/piyushprahladka",
    email: "piyush@glean.com",
    outreachPriorityScore: 91,
    photoInitials: "PP",
    photoColor: "#0EA5E9",
  },
  {
    id: "p0000002-0000-0000-0000-000000000002",
    companyId: "c0000001-0000-0000-0000-000000000001",
    name: "T.R. Vishwanath",
    title: "Co-Founder & VP Infrastructure",
    seniority: "VP/Director",
    linkedinUrl: "https://linkedin.com/in/tr-vishwanath",
    email: "tr@glean.com",
    outreachPriorityScore: 72,
    photoInitials: "TV",
    photoColor: "#10B981",
  },
  // VERCEL
  {
    id: "p0000005-0000-0000-0000-000000000005",
    companyId: "c0000002-0000-0000-0000-000000000002",
    name: "Tom Occhino",
    title: "Chief Product Officer",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/tomocchino",
    email: "tom@vercel.com",
    outreachPriorityScore: 95,
    photoInitials: "TO",
    photoColor: 'var(--color-warning)',
  },
  {
    id: "p0000004-0000-0000-0000-000000000004",
    companyId: "c0000002-0000-0000-0000-000000000002",
    name: "Guillermo Rauch",
    title: "Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/rauchg",
    email: "rauchg@vercel.com",
    outreachPriorityScore: 80,
    photoInitials: "GR",
    photoColor: 'var(--color-error)',
  },
  {
    id: "p0000006-0000-0000-0000-000000000006",
    companyId: "c0000002-0000-0000-0000-000000000002",
    name: "Malte Ubl",
    title: "Chief Technology Officer",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/malteubl",
    email: "malte@vercel.com",
    outreachPriorityScore: 70,
    photoInitials: "MU",
    photoColor: "#8B5CF6",
  },
  // PERPLEXITY
  {
    id: "p0000015-0000-0000-0000-000000000015",
    companyId: "c0000006-0000-0000-0000-000000000006",
    name: "Aravind Srinivas",
    title: "Co-Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/aravind-srinivas-16051987",
    email: "aravind@perplexity.ai",
    outreachPriorityScore: 87,
    photoInitials: "AS",
    photoColor: 'var(--color-lime)',
  },
  {
    id: "p0000017-0000-0000-0000-000000000017",
    companyId: "c0000006-0000-0000-0000-000000000006",
    name: "Johnny Ho",
    title: "Co-Founder & Head of Growth",
    seniority: "VP/Director",
    linkedinUrl: "https://linkedin.com/in/johnnywho",
    email: "johnny@perplexity.ai",
    outreachPriorityScore: 78,
    photoInitials: "JH",
    photoColor: "#0EA5E9",
  },
  {
    id: "p0000016-0000-0000-0000-000000000016",
    companyId: "c0000006-0000-0000-0000-000000000006",
    name: "Denis Yarats",
    title: "Co-Founder & CTO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/denisyarats",
    email: "denis@perplexity.ai",
    outreachPriorityScore: 71,
    photoInitials: "DY",
    photoColor: "#10B981",
  },
  // RUNWAY
  {
    id: "p0000018-0000-0000-0000-000000000018",
    companyId: "c0000007-0000-0000-0000-000000000007",
    name: "Cristóbal Valenzuela",
    title: "Co-Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/cvalenzuelab",
    email: "cristobal@runwayml.com",
    outreachPriorityScore: 86,
    photoInitials: "CV",
    photoColor: 'var(--color-warning)',
  },
  {
    id: "p0000019-0000-0000-0000-000000000019",
    companyId: "c0000007-0000-0000-0000-000000000007",
    name: "Alejandro Matamala",
    title: "Co-Founder & Chief Design Officer",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/alejandro-matamala",
    email: "alejandro@runwayml.com",
    outreachPriorityScore: 79,
    photoInitials: "AM",
    photoColor: 'var(--color-error)',
  },
  // RETOOL
  {
    id: "p0000010-0000-0000-0000-000000000010",
    companyId: "c0000004-0000-0000-0000-000000000004",
    name: "Abhishek Gupta",
    title: "Head of Product",
    seniority: "VP/Director",
    linkedinUrl: "https://linkedin.com/in/abhishekg1",
    email: "abhishek@retool.com",
    outreachPriorityScore: 96,
    photoInitials: "AG",
    photoColor: 'var(--color-lime)',
  },
  {
    id: "p0000009-0000-0000-0000-000000000009",
    companyId: "c0000004-0000-0000-0000-000000000004",
    name: "David Hsu",
    title: "Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/dvdhsu",
    email: "david@retool.com",
    outreachPriorityScore: 82,
    photoInitials: "DH",
    photoColor: "#0EA5E9",
  },
  // LINEAR
  {
    id: "p0000007-0000-0000-0000-000000000007",
    companyId: "c0000003-0000-0000-0000-000000000003",
    name: "Karri Saarinen",
    title: "Co-Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/karrisaarinen",
    email: "karri@linear.app",
    outreachPriorityScore: 90,
    photoInitials: "KS",
    photoColor: "#8B5CF6",
  },
  {
    id: "p0000008-0000-0000-0000-000000000008",
    companyId: "c0000003-0000-0000-0000-000000000003",
    name: "Tuomas Artman",
    title: "Co-Founder & CTO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/tuomasartman",
    email: "tuomas@linear.app",
    outreachPriorityScore: 68,
    photoInitials: "TA",
    photoColor: 'var(--color-warning)',
  },
  // HEX
  {
    id: "p0000012-0000-0000-0000-000000000012",
    companyId: "c0000005-0000-0000-0000-000000000005",
    name: "Barry McCardel",
    title: "Co-Founder & CEO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/barrymccardel",
    email: "barry@hex.tech",
    outreachPriorityScore: 88,
    photoInitials: "BM",
    photoColor: "#10B981",
  },
  {
    id: "p0000013-0000-0000-0000-000000000013",
    companyId: "c0000005-0000-0000-0000-000000000005",
    name: "Caitlin Colgrove",
    title: "Co-Founder & CTO",
    seniority: "C-Suite",
    linkedinUrl: "https://linkedin.com/in/caitlincolgrove",
    email: "caitlin@hex.tech",
    outreachPriorityScore: 70,
    photoInitials: "CC",
    photoColor: 'var(--color-lime)',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// OUTREACH DRAFTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_OUTREACH: DemoOutreachDraft[] = [
  // GLEAN — LinkedIn
  {
    id: "o0000001-0000-0000-0000-000000000001",
    personId: "p0000003-0000-0000-0000-000000000003",
    companyId: "c0000001-0000-0000-0000-000000000001",
    type: "linkedin",
    body: "Piyush — loved reading about Glean Agents. The challenge of making agentic workflows reliable on enterprise data is exactly what I worked on at Notion (shipped AI features to 2M+ users). Would love to explore if there's a fit on your product team.",
    sentFlag: false,
  },
  // GLEAN — Email
  {
    id: "o0000002-0000-0000-0000-000000000002",
    personId: "p0000003-0000-0000-0000-000000000003",
    companyId: "c0000001-0000-0000-0000-000000000001",
    type: "email",
    subject: "PM interest — Notion AI → Glean Agents",
    body: `Hi Piyush,

Glean Agents caught my attention — the problem of making AI reliable on messy, siloed enterprise data is genuinely hard, and Glean is the only company I've seen with the integration depth to solve it properly.

I'm a Senior PM coming out of Notion, where I led the AI features launch (2M+ user rollout, including the AI editor and context-aware suggestions). Before that, I was at Stripe on payments infrastructure. I care deeply about the same things your team does — reliability, trust, and making complex systems feel simple.

I'd love a 20-minute call to learn more about what you're building on the Agents side and share what I've learned shipping AI to enterprise users.

Best,
Alex Chen`,
    sentFlag: false,
  },
  // VERCEL — LinkedIn
  {
    id: "o0000003-0000-0000-0000-000000000003",
    personId: "p0000005-0000-0000-0000-000000000005",
    companyId: "c0000002-0000-0000-0000-000000000002",
    type: "linkedin",
    body: "Tom — v0.dev is the most impressive AI developer tool I've seen this year. The UX of generating real Next.js from a prompt is exactly where AI-native tools should be headed. Coming from Notion AI, I'd love to explore product roles on that surface.",
    sentFlag: false,
  },
  // VERCEL — Email
  {
    id: "o0000004-0000-0000-0000-000000000004",
    personId: "p0000005-0000-0000-0000-000000000005",
    companyId: "c0000002-0000-0000-0000-000000000002",
    type: "email",
    subject: "PM interest — AI product at Vercel (v0.dev)",
    body: `Hi Tom,

The v0.dev launch was a genuine step-change — generating production-ready Next.js from a text prompt is exactly the kind of AI UX breakthrough that actually changes how developers work, not just impresses on demos.

I'm a Senior PM from Notion (led AI features to 2M+ users) and Stripe (payments infra). I've spent the last 2 years thinking hard about how to make AI outputs feel trustworthy and editable rather than magic-and-brittle. That tension feels central to what you're building.

I'd love 20 minutes to talk about product direction for v0.dev and the AI SDK. Happy to share specifics from my work at Notion if useful.

Best,
Alex Chen`,
    sentFlag: false,
  },
  // PERPLEXITY — LinkedIn (sent)
  {
    id: "o0000005-0000-0000-0000-000000000005",
    personId: "p0000015-0000-0000-0000-000000000015",
    companyId: "c0000006-0000-0000-0000-000000000006",
    type: "linkedin",
    body: "Aravind — the Perplexity Pages launch was a smart expansion. You're building a content layer on top of a search engine — a very different product challenge. I led AI features at Notion and would love to explore if there's a fit as you scale the product team.",
    sentFlag: true,
  },
  // RUNWAY — LinkedIn
  {
    id: "o0000008-0000-0000-0000-000000000008",
    personId: "p0000018-0000-0000-0000-000000000018",
    companyId: "c0000007-0000-0000-0000-000000000007",
    type: "linkedin",
    body: "Cristóbal — Gen-3 Alpha is a genuine leap. The fact that Hollywood studios are now integrating Runway into production pipelines means you're building actual creative infrastructure, not a toy. I'd love to talk about product roles as you expand the professional filmmaker surface.",
    sentFlag: false,
  },
  // RUNWAY — Email
  {
    id: "o0000009-0000-0000-0000-000000000009",
    personId: "p0000018-0000-0000-0000-000000000018",
    companyId: "c0000007-0000-0000-0000-000000000007",
    type: "email",
    subject: "PM interest — creative tools product at Runway",
    body: `Hi Cristóbal,

The Gen-3 Alpha API launch opened up something new — you're no longer just a consumer creative tool. You're now infrastructure for professional film production. That's a completely different product problem: reliability over spectacle, workflow integration over virality.

I'm a Senior PM from Notion and Stripe. I've spent a lot of time thinking about how to build tools that professionals trust for real work, not just for demos. That transition from consumer to professional tooling is exactly what Runway is navigating.

I'd love 20 minutes to hear how you're thinking about the product roadmap for studio and professional use cases.

Best,
Alex Chen`,
    sentFlag: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_PIPELINE: DemoPipelineEntry[] = [
  {
    companyId: "c0000007-0000-0000-0000-000000000007",
    personId: "p0000018-0000-0000-0000-000000000018",
    status: "interviewing",
    notes:
      "Cristóbal responded within 48h. Intro call with him + Alejandro scheduled. They're looking for a PM to own the professional/studio tier product surface.",
    updatedAt: "2024-10-28",
  },
  {
    companyId: "c0000001-0000-0000-0000-000000000001",
    personId: "p0000003-0000-0000-0000-000000000003",
    status: "replied",
    notes:
      "Piyush replied: \"Love your background — Notion AI is very relevant to what we're building. Let's find time next week.\" Scheduling now.",
    updatedAt: "2024-10-25",
  },
  {
    companyId: "c0000006-0000-0000-0000-000000000006",
    personId: "p0000015-0000-0000-0000-000000000015",
    status: "messaged",
    notes: "Sent LinkedIn + email to Aravind. Followed up with Johnny Ho on growth angle.",
    updatedAt: "2024-10-22",
  },
  {
    companyId: "c0000002-0000-0000-0000-000000000002",
    personId: "p0000005-0000-0000-0000-000000000005",
    status: "messaged",
    notes: "Emailed Tom Occhino re: v0.dev PM role. Also connected with Guillermo on X.",
    updatedAt: "2024-10-21",
  },
  {
    companyId: "c0000003-0000-0000-0000-000000000003",
    status: "saved",
    notes:
      "Dream job. Waiting for the right moment to reach out to Karri — want a specific angle on Linear AI first.",
    updatedAt: "2024-10-18",
  },
  {
    companyId: "c0000004-0000-0000-0000-000000000004",
    status: "saved",
    notes:
      "Strong fit with Retool AI direction. Will reach out to Abhishek Gupta (Head of Product) this week.",
    updatedAt: "2024-10-17",
  },
  {
    companyId: "c0000005-0000-0000-0000-000000000005",
    status: "saved",
    notes: "Interesting data+AI angle. Need to dig deeper into their roadmap before reaching out.",
    updatedAt: "2024-10-15",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getPeopleForCompany(companyId: string): DemoPerson[] {
  return DEMO_PEOPLE.filter((p) => p.companyId === companyId).sort(
    (a, b) => b.outreachPriorityScore - a.outreachPriorityScore
  );
}

export function getOutreachForPerson(
  personId: string,
  type?: "linkedin" | "email"
): DemoOutreachDraft[] {
  return DEMO_OUTREACH.filter(
    (o) => o.personId === personId && (type ? o.type === type : true)
  );
}

export function getPipelineEntry(companyId: string): DemoPipelineEntry | undefined {
  return DEMO_PIPELINE.find((p) => p.companyId === companyId);
}

export function getPipelineByStatus(
  status: DemoPipelineEntry["status"]
): (DemoPipelineEntry & { company: DemoCompany })[] {
  return DEMO_PIPELINE.filter((p) => p.status === status).map((p) => ({
    ...p,
    company: DEMO_COMPANIES.find((c) => c.id === p.companyId)!,
  }));
}

/** Returns true if the app is running in demo mode */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    new URLSearchParams(window.location.search).get("demo") === "true"
  );
}
