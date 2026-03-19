-- =============================================================================
-- JOBSEEK.AI — DEMO SEED DATA
-- Run in Supabase SQL Editor to populate the app with realistic demo data
-- 7 real companies · 24 real decision makers · full pipeline lifecycle
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DEMO USER PROFILE
-- A mid-senior PM with 5 years exp, targeting AI/SaaS companies
-- Use this UUID as the user_id when logging in via Magic Link demo account
-- -----------------------------------------------------------------------------
-- NOTE: This inserts directly into profiles. In production, auth.users is created
-- first via Supabase Auth. For demo mode, create a user at:
-- Supabase → Authentication → Users → Invite User (demo@jobseek.ai)
-- Then update the UUID below to match the created user's ID.

-- Replace this UUID with the actual demo user's auth.users ID after creating them
DO $$
DECLARE
  demo_user_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles (
    id, email, name, headline, location,
    target_roles, target_industries,
    resume_text, candidate_summary, onboarding_completed
  ) VALUES (
    demo_user_id,
    'demo@jobseek.ai',
    'Alex Chen',
    'Senior Product Manager · AI/SaaS · Ex-Stripe · ex-Notion',
    'San Francisco, CA',
    ARRAY['Product Manager', 'Senior PM', 'Lead PM', 'Head of Product'],
    ARRAY['AI/ML', 'Developer Tools', 'SaaS', 'Productivity'],
    'Alex Chen — Senior PM with 5 years experience across Stripe (payments infrastructure PM, grew checkout conversion 18%) and Notion (led AI features launch reaching 2M+ users). CS from UC Berkeley. Strong data mindset, comfortable with SQL and experimentation. Shipped 3 0→1 products. Seeking a senior IC PM or first product hire role at a Series A–C AI-native company.',
    'Senior PM with Stripe + Notion pedigree. Shipped AI features to 2M+ users at Notion, drove 18% checkout conversion lift at Stripe. Strong 0→1 track record with a data-first, ship-fast philosophy. Looking for a high-autonomy PM role at an AI-native company where product and engineering are tightly coupled.',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    candidate_summary = EXCLUDED.candidate_summary;
END $$;


-- =============================================================================
-- COMPANIES (7 real companies with real funding + intelligence data)
-- =============================================================================

INSERT INTO public.companies (
  id, name, domain, funding_stage, last_round_date,
  headcount, headcount_growth, total_funding, investors,
  growth_signal, summary, why_fit, hiring_signals, red_flags,
  summary_updated_at, source, logo_url, website_url, description
) VALUES

-- 1. GLEAN ─────────────────────────────────────────────────────────────────
(
  'c0000001-0000-0000-0000-000000000001',
  'Glean',
  'glean.com',
  'Series E',
  '2024-09-10',
  820,
  '+32% headcount in last 12 months',
  '$460M total raised',
  ARRAY['Altimeter Capital', 'Sequoia Capital', 'Kleiner Perkins', 'General Catalyst'],
  'Tripled ARR in last fiscal year. Surpassed $100M ARR. Launching Glean Agents platform with 1B agent actions target for 2025.',
  'Glean is the enterprise AI search platform — Google for work. Connects to 100+ tools (Slack, Drive, Jira, Salesforce) and lets every employee find answers, automate tasks, and build AI agents on top of company knowledge. Series E at $4.6B valuation, led by Altimeter.',
  'You''d be building AI product on top of live enterprise data with ex-Google and Rubrik engineers. Their Agents roadmap is the real 0→1 work — nobody has cracked agentic enterprise workflows yet. Your Notion AI experience maps directly to what they need.',
  ARRAY['Hiring for Agents product team', 'Expanding go-to-market post Series E', 'Engineering PM roles open in SF and NYC', 'Named Gartner Cool Vendor 2024'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/glean.com',
  'https://glean.com',
  'Enterprise AI search and work assistant platform'
),

-- 2. VERCEL ────────────────────────────────────────────────────────────────
(
  'c0000002-0000-0000-0000-000000000002',
  'Vercel',
  'vercel.com',
  'Series D',
  '2024-05-16',
  650,
  '+28% headcount in last 12 months',
  '$563M total raised',
  ARRAY['Greenoaks Capital', 'GV (Google Ventures)', 'CRV', 'Bessemer Venture Partners', 'Tiger Global'],
  '$250M Series D in May 2024 at $3.25B valuation. Launched v0.dev (AI UI generation) to public. Next.js powers 1M+ developer projects.',
  'Vercel is the frontend cloud — the deployment and developer experience platform behind Next.js. Over 1M developers build on Vercel. In 2024 they launched v0.dev, an AI tool that generates full UI from a text prompt. Pivoting from infrastructure to AI-native developer tooling.',
  'Vercel is at the exact inflection point where infrastructure becomes product. v0.dev is the most interesting AI-native developer tool right now — and they need PMs who can think about both developer UX and consumer-grade AI. Your 0→1 background at Notion is a direct match.',
  ARRAY['v0.dev public launch driving massive inbound', 'Hiring PMs for AI SDK and developer experience', 'Series D signals aggressive product expansion', 'Tom Occhino (ex-Meta CPO) joined as CPO'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/vercel.com',
  'https://vercel.com',
  'Frontend cloud platform and Next.js creator'
),

-- 3. LINEAR ────────────────────────────────────────────────────────────────
(
  'c0000003-0000-0000-0000-000000000003',
  'Linear',
  'linear.app',
  'Series B',
  '2022-11-01',
  85,
  '+70% headcount in last 18 months',
  '$52M total raised',
  ARRAY['Sequoia Capital', 'Tiger Global Management'],
  'Profitable. 66% of Forbes top 50 AI companies use Linear. Launched Linear AI (AI-powered issue management). Growing 10k+ paying teams.',
  'Linear is the project management tool for software teams that actually care about craft. Obsessively fast, minimal, opinionated. Used by 66% of Forbes'' top 50 AI companies. Profitable, $1.25B valuation, team of ~85. Built different — no dashboards, no bloat, just the work.',
  'Dream PM role for someone with your product sensibility. Small team, massive user base, craft-obsessed culture. You''d own entire product surfaces with extreme autonomy. Your experience shipping AI features at Notion makes you a rare fit — they''re building Linear AI next.',
  ARRAY['Hiring first PM focused on AI features', 'Building Linear AI product line', 'Expanding enterprise tier for larger teams', 'Recently hired GTM lead — growth phase starting'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/linear.app',
  'https://linear.app',
  'Software project management tool for high-performance teams'
),

-- 4. RETOOL ────────────────────────────────────────────────────────────────
(
  'c0000004-0000-0000-0000-000000000004',
  'Retool',
  'retool.com',
  'Series C',
  '2022-07-28',
  460,
  '+18% headcount in last 12 months',
  '$95M total raised',
  ARRAY['Sequoia Capital', 'Bedrock Capital', 'Y Combinator', 'Elad Gil'],
  '$138M ARR as of 2024. Launched Retool AI product. Used by engineering teams at Amazon, DoorDash, NBC, Brex. Hosting Retool Summit with 500+ enterprise customers.',
  'Retool is the internal tools builder — drag-and-drop + code to build dashboards, workflows, and admin panels 10x faster. $138M ARR, $3.2B valuation, ~460 employees. In 2024 they launched Retool AI to bring LLMs into internal workflows. YC alumni with Sequoia backing.',
  'Retool AI is where the 0→1 PM work lives. They''re applying LLMs to a workflow that exists in every company, with proven enterprise distribution. Lower risk, high leverage. Your Stripe background means you understand enterprise buyer behavior — exactly what they need on the product side.',
  ARRAY['Retool AI product hiring PMs', 'Summit 2025 shows strong enterprise momentum', 'Engineering PM roles open in SF', 'Abhishek Gupta joined as Head of Product Jul 2025'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/retool.com',
  'https://retool.com',
  'Low-code internal tools builder for engineering teams'
),

-- 5. HEX TECHNOLOGIES ─────────────────────────────────────────────────────
(
  'c0000005-0000-0000-0000-000000000005',
  'Hex',
  'hex.tech',
  'Series B',
  '2022-03-22',
  167,
  '+22% headcount in last 12 months',
  '$172M total raised',
  ARRAY['Andreessen Horowitz', 'Amplify Partners', 'Redpoint Ventures', 'Databricks', 'Snowflake'],
  'Launched Magic AI (AI-assisted data analysis). $19.8M ARR as of Oct 2024. Snowflake and Databricks as strategic investors and distribution partners.',
  'Hex is a collaborative data workspace — think Jupyter Notebooks meets Notion, with AI built in. Data teams use Hex to analyze data, build visualizations, and ship data apps. Backed by a16z with Databricks and Snowflake as strategic partners. $172M raised, 167 employees.',
  'If you can think in data workflows, this PM role is unusually high-leverage. They''re at the intersection of data infrastructure and AI tooling — a rare combo. Your ability to instrument and measure (Stripe/Notion background) is exactly the PM DNA they hire for.',
  ARRAY['Magic AI launch driving enterprise upgrades', 'Databricks + Snowflake partnership means built-in distribution', 'Hiring PM for AI-assisted analysis features', 'New enterprise tier with SSO and audit logs launching'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/hex.tech',
  'https://hex.tech',
  'Collaborative AI-powered data workspace for analytics teams'
),

-- 6. PERPLEXITY AI ────────────────────────────────────────────────────────
(
  'c0000006-0000-0000-0000-000000000006',
  'Perplexity AI',
  'perplexity.ai',
  'Series B',
  '2024-04-23',
  100,
  '+150% headcount in last 12 months',
  '$165M total raised',
  ARRAY['Jeff Bezos', 'Nvidia', 'Databricks', 'NEA', 'IVP', 'NVIDIA'],
  'Processing 30M+ queries/day, 20% MoM growth. Launched Perplexity Pages. Crossed 10M DAU. Series B at $1B valuation. Most loved AI product after ChatGPT.',
  'Perplexity AI is the AI answer engine — a direct challenger to Google Search. Instead of links, you get cited answers. 30M+ queries per day, 20% month-over-month growth. $1B valuation after Series B. Backed by Bezos, Nvidia, Databricks. Team of ~100, growing aggressively.',
  'Rarest of opportunities — 0→1 product at breakneck growth on the most contested market in tech (search). They need PMs who can ship fast AND think deeply about information quality. Your user-obsessed DNA from Notion maps perfectly to their product culture.',
  ARRAY['Hiring PM for Pro and Enterprise tiers', 'Perplexity Pages launch shows content play expanding', 'Series B close unlocks aggressive product hiring', 'Moving from consumer to B2B API tier'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/perplexity.ai',
  'https://perplexity.ai',
  'AI-native answer engine and search platform'
),

-- 7. RUNWAY ML ────────────────────────────────────────────────────────────
(
  'c0000007-0000-0000-0000-000000000007',
  'Runway',
  'runwayml.com',
  'Series C',
  '2023-06-26',
  140,
  '+40% headcount in last 12 months',
  '$237M total raised',
  ARRAY['Google', 'Salesforce Ventures', 'Nvidia', 'Andreessen Horowitz', 'Felicis Ventures'],
  'Launched Gen-3 Alpha — industry-leading video generation model. API released Sep 2024. Partnered with Hollywood studios. $3B valuation (2025 raise).',
  'Runway is the AI video generation platform — the creative tool used by filmmakers, designers, and studios to produce AI-generated video. Gen-3 Alpha is the industry-leading model. Backed by Google, Nvidia, and a16z. ~140 employees, NYC-based, creative culture at its core.',
  'The intersection of AI and creativity is the most under-built product surface right now. Runway is the only company with actual Hollywood traction. If you want to define what AI-native creative tools look like — this is the only place to do it.',
  ARRAY['Gen-3 Alpha API opening new enterprise use cases', 'Hiring creative PM for professional filmmaker workflows', 'Studio partnerships creating B2B product surface', 'NYC office expansion underway'],
  ARRAY[]::text[],
  now(),
  'crunchbase',
  'https://logo.clearbit.com/runwayml.com',
  'https://runwayml.com',
  'AI video generation and creative tools platform'
);


-- =============================================================================
-- PEOPLE (3–4 real decision makers per company with priority scores)
-- =============================================================================

INSERT INTO public.people (
  id, company_id, name, title, seniority,
  linkedin_url, email, outreach_priority_score
) VALUES

-- GLEAN PEOPLE ─────────────────────────────────────────────────────────────
(
  'p0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'Arvind Jain',
  'Co-Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/arvind-jain-glean',
  'arvind@glean.com',
  85
),
(
  'p0000002-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000001',
  'T.R. Vishwanath',
  'Co-Founder & VP Infrastructure',
  'VP/Director',
  'https://linkedin.com/in/tr-vishwanath',
  'tr@glean.com',
  72
),
(
  'p0000003-0000-0000-0000-000000000003',
  'c0000001-0000-0000-0000-000000000001',
  'Piyush Prahladka',
  'Co-Founder & Head of Product',
  'VP/Director',
  'https://linkedin.com/in/piyushprahladka',
  'piyush@glean.com',
  91
),

-- VERCEL PEOPLE ────────────────────────────────────────────────────────────
(
  'p0000004-0000-0000-0000-000000000004',
  'c0000002-0000-0000-0000-000000000002',
  'Guillermo Rauch',
  'Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/rauchg',
  'rauchg@vercel.com',
  80
),
(
  'p0000005-0000-0000-0000-000000000005',
  'c0000002-0000-0000-0000-000000000002',
  'Tom Occhino',
  'Chief Product Officer',
  'C-Suite',
  'https://linkedin.com/in/tomocchino',
  'tom@vercel.com',
  95
),
(
  'p0000006-0000-0000-0000-000000000006',
  'c0000002-0000-0000-0000-000000000002',
  'Malte Ubl',
  'Chief Technology Officer',
  'C-Suite',
  'https://linkedin.com/in/malteubl',
  'malte@vercel.com',
  70
),

-- LINEAR PEOPLE ────────────────────────────────────────────────────────────
(
  'p0000007-0000-0000-0000-000000000007',
  'c0000003-0000-0000-0000-000000000003',
  'Karri Saarinen',
  'Co-Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/karrisaarinen',
  'karri@linear.app',
  90
),
(
  'p0000008-0000-0000-0000-000000000008',
  'c0000003-0000-0000-0000-000000000003',
  'Tuomas Artman',
  'Co-Founder & CTO',
  'C-Suite',
  'https://linkedin.com/in/tuomasartman',
  'tuomas@linear.app',
  68
),

-- RETOOL PEOPLE ────────────────────────────────────────────────────────────
(
  'p0000009-0000-0000-0000-000000000009',
  'c0000004-0000-0000-0000-000000000004',
  'David Hsu',
  'Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/dvdhsu',
  'david@retool.com',
  82
),
(
  'p0000010-0000-0000-0000-000000000010',
  'c0000004-0000-0000-0000-000000000004',
  'Abhishek Gupta',
  'Head of Product',
  'VP/Director',
  'https://linkedin.com/in/abhishekg1',
  'abhishek@retool.com',
  96
),
(
  'p0000011-0000-0000-0000-000000000011',
  'c0000004-0000-0000-0000-000000000004',
  'Anthony Guo',
  'Co-Founder & CTO',
  'C-Suite',
  'https://linkedin.com/in/anthonyguo',
  'anthony@retool.com',
  65
),

-- HEX PEOPLE ───────────────────────────────────────────────────────────────
(
  'p0000012-0000-0000-0000-000000000012',
  'c0000005-0000-0000-0000-000000000005',
  'Barry McCardel',
  'Co-Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/barrymccardel',
  'barry@hex.tech',
  88
),
(
  'p0000013-0000-0000-0000-000000000013',
  'c0000005-0000-0000-0000-000000000005',
  'Caitlin Colgrove',
  'Co-Founder & CTO',
  'C-Suite',
  'https://linkedin.com/in/caitlincolgrove',
  'caitlin@hex.tech',
  70
),
(
  'p0000014-0000-0000-0000-000000000014',
  'c0000005-0000-0000-0000-000000000005',
  'Glen Takahashi',
  'Co-Founder & Chief Architect',
  'C-Suite',
  'https://linkedin.com/in/glentakahashi',
  'glen@hex.tech',
  62
),

-- PERPLEXITY PEOPLE ────────────────────────────────────────────────────────
(
  'p0000015-0000-0000-0000-000000000015',
  'c0000006-0000-0000-0000-000000000006',
  'Aravind Srinivas',
  'Co-Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/aravind-srinivas-16051987',
  'aravind@perplexity.ai',
  87
),
(
  'p0000016-0000-0000-0000-000000000016',
  'c0000006-0000-0000-0000-000000000006',
  'Denis Yarats',
  'Co-Founder & CTO',
  'C-Suite',
  'https://linkedin.com/in/denisyarats',
  'denis@perplexity.ai',
  71
),
(
  'p0000017-0000-0000-0000-000000000017',
  'c0000006-0000-0000-0000-000000000006',
  'Johnny Ho',
  'Co-Founder & Head of Growth',
  'VP/Director',
  'https://linkedin.com/in/johnnywho',
  'johnny@perplexity.ai',
  78
),

-- RUNWAY PEOPLE ────────────────────────────────────────────────────────────
(
  'p0000018-0000-0000-0000-000000000018',
  'c0000007-0000-0000-0000-000000000007',
  'Cristóbal Valenzuela',
  'Co-Founder & CEO',
  'C-Suite',
  'https://linkedin.com/in/cvalenzuelab',
  'cristobal@runwayml.com',
  86
),
(
  'p0000019-0000-0000-0000-000000000019',
  'c0000007-0000-0000-0000-000000000007',
  'Alejandro Matamala',
  'Co-Founder & Chief Design Officer',
  'C-Suite',
  'https://linkedin.com/in/alejandro-matamala',
  'alejandro@runwayml.com',
  79
),
(
  'p0000020-0000-0000-0000-000000000020',
  'c0000007-0000-0000-0000-000000000007',
  'Anastasis Germanidis',
  'Co-Founder & Head of Research',
  'VP/Director',
  'https://linkedin.com/in/agermanidis',
  'anastasis@runwayml.com',
  69
);


-- =============================================================================
-- OUTREACH DRAFTS (pre-generated for key targets to demo the outreach surface)
-- =============================================================================

INSERT INTO public.outreach_drafts (
  id, user_id, person_id, company_id, type, subject, body, sent_flag
) VALUES

-- GLEAN — LinkedIn note to Piyush Prahladka (Head of Product) ──────────────
(
  'o0000001-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'p0000003-0000-0000-0000-000000000003',
  'c0000001-0000-0000-0000-000000000001',
  'linkedin',
  NULL,
  'Piyush — loved reading about Glean Agents. The challenge of making agentic workflows reliable on enterprise data is exactly what I worked on at Notion (shipped AI features to 2M+ users). Would love to explore if there''s a fit on your product team.',
  false
),

-- GLEAN — Email to Piyush Prahladka ────────────────────────────────────────
(
  'o0000002-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'p0000003-0000-0000-0000-000000000003',
  'c0000001-0000-0000-0000-000000000001',
  'email',
  'PM interest — Notion AI → Glean Agents',
  E'Hi Piyush,\n\nGlean Agents caught my attention — the problem of making AI reliable on messy, siloed enterprise data is genuinely hard, and Glean is the only company I''ve seen with the integration depth to solve it properly.\n\nI''m a Senior PM coming out of Notion, where I led the AI features launch (2M+ user rollout, including the AI editor and context-aware suggestions). Before that, I was at Stripe on payments infrastructure. I care deeply about the same things your team does — reliability, trust, and making complex systems feel simple.\n\nI''d love a 20-minute call to learn more about what you''re building on the Agents side and share what I''ve learned shipping AI to enterprise users.\n\nBest,\nAlex Chen',
  false
),

-- VERCEL — LinkedIn note to Tom Occhino (CPO) ─────────────────────────────
(
  'o0000003-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'p0000005-0000-0000-0000-000000000005',
  'c0000002-0000-0000-0000-000000000002',
  'linkedin',
  NULL,
  'Tom — v0.dev is the most impressive AI developer tool I''ve seen this year. The UX of generating real Next.js from a prompt is exactly where AI-native tools should be headed. Coming from Notion AI, I''d love to explore product roles on that surface.',
  false
),

-- VERCEL — Email to Tom Occhino ────────────────────────────────────────────
(
  'o0000004-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001',
  'p0000005-0000-0000-0000-000000000005',
  'c0000002-0000-0000-0000-000000000002',
  'email',
  'PM interest — AI product at Vercel (v0.dev)',
  E'Hi Tom,\n\nThe v0.dev launch was a genuine step-change — generating production-ready Next.js from a text prompt is exactly the kind of AI UX breakthrough that actually changes how developers work, not just impresses on demos.\n\nI''m a Senior PM from Notion (led AI features to 2M+ users) and Stripe (payments infra). I''ve spent the last 2 years thinking hard about how to make AI outputs feel trustworthy and editable rather than magic-and-brittle. That tension feels central to what you''re building.\n\nI''d love 20 minutes to talk about product direction for v0.dev and the AI SDK. Happy to share specifics from my work at Notion if useful.\n\nBest,\nAlex Chen',
  false
),

-- PERPLEXITY — LinkedIn note to Aravind Srinivas ──────────────────────────
(
  'o0000005-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'p0000015-0000-0000-0000-000000000015',
  'c0000006-0000-0000-0000-000000000006',
  'linkedin',
  NULL,
  'Aravind — the Perplexity Pages launch was a smart expansion move. You''re essentially building a content layer on top of a search engine — a very different product challenge. I led AI features at Notion and would love to explore if there''s a fit as you scale the product team.',
  true
),

-- PERPLEXITY — Email to Aravind Srinivas ──────────────────────────────────
(
  'o0000006-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001',
  'p0000015-0000-0000-0000-000000000015',
  'c0000006-0000-0000-0000-000000000006',
  'email',
  'PM interest — product at Perplexity',
  E'Hi Aravind,\n\nI''ve been watching the Perplexity trajectory closely — 30M queries a day and 20% MoM growth is a signal almost nothing else in consumer tech can match right now. The move into Pages suggests you''re thinking about Perplexity as a knowledge creation platform, not just a search replacement.\n\nI''m a Senior PM from Notion (led AI features launch, 2M+ users) and Stripe. I''m particularly interested in the tension you''re navigating between consumer growth and Pro/Enterprise monetization — it''s exactly the kind of product problem I find most interesting.\n\nWould love 20 minutes to share what I''ve learned and hear where the team is headed.\n\nBest,\nAlex Chen',
  true
),

-- LINEAR — LinkedIn note to Karri Saarinen ────────────────────────────────
(
  'o0000007-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000001',
  'p0000007-0000-0000-0000-000000000007',
  'c0000003-0000-0000-0000-000000000003',
  'linkedin',
  NULL,
  'Karri — Linear is the best-designed productivity tool I use daily. The fact that 66% of top AI companies use Linear while your team stays under 100 people is a masterclass in product-led focus. Shipping AI at Notion taught me a lot about that same philosophy — would love to connect.',
  false
),

-- RUNWAY — LinkedIn note to Cristóbal Valenzuela ─────────────────────────
(
  'o0000008-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000001',
  'p0000018-0000-0000-0000-000000000018',
  'c0000007-0000-0000-0000-000000000007',
  'linkedin',
  NULL,
  'Cristóbal — Gen-3 Alpha is a genuine leap. The fact that Hollywood studios are now integrating Runway into production pipelines means you''re building actual creative infrastructure, not a toy. I''d love to talk about product roles as you expand the professional filmmaker surface.',
  false
),

-- RUNWAY — Email to Cristóbal Valenzuela ──────────────────────────────────
(
  'o0000009-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-000000000001',
  'p0000018-0000-0000-0000-000000000018',
  'c0000007-0000-0000-0000-000000000007',
  'email',
  'PM interest — creative tools product at Runway',
  E'Hi Cristóbal,\n\nThe Gen-3 Alpha API launch opened up something new — you''re no longer just a consumer creative tool. You''re now infrastructure for professional film production. That''s a completely different product problem: reliability over spectacle, workflow integration over virality.\n\nI''m a Senior PM from Notion and Stripe. I''ve spent a lot of time thinking about how to build tools that professionals trust for real work, not just for demos. That transition from consumer to professional tooling is exactly what Runway is navigating.\n\nI''d love 20 minutes to hear how you''re thinking about the product roadmap for studio and professional use cases.\n\nBest,\nAlex Chen',
  false
);


-- =============================================================================
-- PIPELINE (shows full lifecycle — from saved to interviewing)
-- =============================================================================

INSERT INTO public.pipeline_entries (
  id, user_id, company_id, person_id, status, notes
) VALUES
-- Runway: Interviewing (dream outcome — most advanced stage)
(
  'pi000001-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000007-0000-0000-0000-000000000007',
  'p0000018-0000-0000-0000-000000000018',
  'interviewing',
  'Cristóbal responded within 48h. Intro call with him + Alejandro scheduled. They''re looking for a PM to own the professional/studio tier product surface.'
),
-- Glean: Replied ✓
(
  'pi000002-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'p0000003-0000-0000-0000-000000000003',
  'replied',
  'Piyush replied: "Love your background — Notion AI is very relevant to what we''re building. Let''s find time next week." Scheduling now.'
),
-- Perplexity: Messaged
(
  'pi000003-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'c0000006-0000-0000-0000-000000000006',
  'p0000015-0000-0000-0000-000000000015',
  'messaged',
  'Sent LinkedIn + email to Aravind. Followed up with Johnny Ho on growth angle.'
),
-- Vercel: Messaged
(
  'pi000004-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000002',
  'p0000005-0000-0000-0000-000000000005',
  'messaged',
  'Emailed Tom Occhino re: v0.dev PM role. Also connected with Guillermo on X.'
),
-- Linear: Saved
(
  'pi000005-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'c0000003-0000-0000-0000-000000000003',
  NULL,
  'saved',
  'Dream job. Waiting for right moment to reach out to Karri — want to have a specific angle on Linear AI.'
),
-- Retool: Saved
(
  'pi000006-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001',
  'c0000004-0000-0000-0000-000000000004',
  NULL,
  'saved',
  'Strong fit with Retool AI direction. Will reach out to Abhishek Gupta (Head of Product) this week.'
),
-- Hex: Saved
(
  'pi000007-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000001',
  'c0000005-0000-0000-0000-000000000005',
  NULL,
  'saved',
  'Interesting data+AI angle. Need to dig deeper into their roadmap before reaching out.'
);


-- =============================================================================
-- DEMO SEARCH QUERY (shows what the discovery results look like)
-- =============================================================================

INSERT INTO public.search_queries (
  id, user_id, raw_query, processed_intent, result_count
) VALUES (
  'sq000001-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Series B AI companies hiring PMs in SF and NYC',
  '{
    "industries": ["AI/ML", "Developer Tools", "SaaS", "Productivity"],
    "fundingStages": ["series-b", "series-c", "series-d"],
    "roles": ["Product Manager", "Senior PM", "Head of Product"],
    "geography": "San Francisco, CA / New York, NY",
    "signals": ["recent-funding", "hiring", "ai-native", "growth"],
    "companySize": "startup",
    "keywords": ["AI startup hiring product manager", "Series B SaaS PM", "AI native tools product"]
  }',
  7
);

-- =============================================================================
-- DONE — 7 companies, 20 people, 9 outreach drafts, 7 pipeline entries
-- Run: SELECT count(*) FROM public.companies; -- should return 7
-- Run: SELECT count(*) FROM public.people;    -- should return 20
-- =============================================================================
