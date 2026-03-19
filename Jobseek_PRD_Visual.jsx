import { useState } from "react";

const COLORS = {
  bg: "#0A0A0F",
  card: "#13131A",
  border: "#1E1E2E",
  accent: "#6C63FF",
  accentGlow: "rgba(108,99,255,0.15)",
  accentSoft: "#8B85FF",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  muted: "#6B7280",
  text: "#E5E7EB",
  textDim: "#9CA3AF",
};

const Tag = ({ children, color = COLORS.accent }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: `${color}22`,
      color: color,
      border: `1px solid ${color}44`,
      letterSpacing: "0.05em",
    }}
  >
    {children}
  </span>
);

const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      padding: "24px",
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <h2
    style={{
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: "0.12em",
      color: COLORS.muted,
      textTransform: "uppercase",
      marginBottom: 16,
      marginTop: 0,
    }}
  >
    {children}
  </h2>
);

// ── SECTIONS ────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 24px 40px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 500,
          height: 300,
          background: `radial-gradient(ellipse at center, ${COLORS.accentGlow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        <Tag>v1.0 MVP Spec</Tag>
        <Tag color={COLORS.amber}>Beta · Invite-Only</Tag>
        <Tag color={COLORS.green}>2–4 Weeks to Launch</Tag>
      </div>
      <h1
        style={{
          fontSize: 52,
          fontWeight: 800,
          margin: "0 0 8px",
          background: `linear-gradient(135deg, #fff 0%, ${COLORS.accentSoft} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-1px",
        }}
      >
        Jobseek.ai
      </h1>
      <p
        style={{
          fontSize: 20,
          color: COLORS.accentSoft,
          fontStyle: "italic",
          marginBottom: 12,
        }}
      >
        "Stop applying. Start reaching out."
      </p>
      <p
        style={{
          fontSize: 15,
          color: COLORS.textDim,
          maxWidth: 520,
          margin: "0 auto",
          lineHeight: 1.7,
        }}
      >
        AI-native outbound platform for job seekers. Treats job search like outbound sales — discover
        high-signal companies, identify decision makers, initiate personalized conversations before
        roles are even posted.
      </p>
    </div>
  );
}

function PositioningSection() {
  const rows = [
    ["Category", "Career Outbound Platform"],
    ["Core JTBD", "Start a hiring conversation with a decision maker"],
    ["Primary ICP", "Mid-to-senior PMs, Engineers, Designers, GTM operators"],
    ["Differentiation", "Clay-style intelligence — built for candidates, not sales teams"],
    ["North Star Metric", "Meaningful outreach initiated per user per week"],
  ];
  return (
    <Card>
      <SectionTitle>Positioning</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 14px",
              background: "#0D0D14",
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span
              style={{ color: COLORS.muted, fontSize: 12, fontWeight: 600, minWidth: 160 }}
            >
              {label}
            </span>
            <span style={{ color: COLORS.text, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WorkflowSection() {
  const [active, setActive] = useState(0);
  const stages = [
    {
      num: "01",
      title: "Intent-Based Discovery",
      replaces: "Google + job board browsing",
      icon: "🔍",
      color: "#6C63FF",
      detail:
        "User types a natural language query (e.g. 'Series B AI startups hiring PMs'). Claude extracts intent → Exa web search + Crunchbase enrichment → returns 10–20 ranked companies with relevance scores based on funding recency, growth signals, and hiring indicators.",
    },
    {
      num: "02",
      title: "Company Intelligence Panel",
      replaces: "20 mins of tab-switching research",
      icon: "🏢",
      color: "#0EA5E9",
      detail:
        "Clicking a company opens a right-side panel with: funding stage + investors, headcount growth trend (6–12mo), recent news & product launches, tech stack signals, AI-generated 3-sentence summary, and a personalized 'Why this might be a fit' — all powered by Claude.",
    },
    {
      num: "03",
      title: "Key People Identification",
      replaces: "LinkedIn stalking + org chart guessing",
      icon: "👤",
      color: "#10B981",
      detail:
        "Apollo.io enrichment + LinkedIn OAuth graph surfaces the right decision makers: Founders, VPs, Engineering/Product leads. Each person card shows name, title, seniority, and an outreach priority score (function match × seniority × hiring activity signal).",
    },
    {
      num: "04",
      title: "Outreach Generation",
      replaces: "Generic AI prompts with no context",
      icon: "✉️",
      color: "#F59E0B",
      detail:
        "User selects a person → Claude generates 2 variants: a 280-char LinkedIn connect note and a 150–200 word cold email. Inputs: candidate summary + company intel + person role + recent signals. User can regenerate or edit inline. Quality guardrail: every message must include at least one company-specific signal.",
    },
    {
      num: "05",
      title: "Pipeline Tracker",
      replaces: "Spreadsheet chaos",
      icon: "📋",
      color: "#EF4444",
      detail:
        "Lightweight CRM layer: save companies to shortlist, mark people as Messaged with timestamp, track status across 4 stages: Saved → Messaged → Replied → Interviewing. Simple kanban or list view. Deliberately constrained — no CRM complexity at MVP.",
    },
  ];
  return (
    <Card>
      <SectionTitle>5-Stage Outbound Workflow</SectionTitle>
      {/* Flow bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: 20,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {stages.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <button
              onClick={() => setActive(i)}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 10,
                border: `2px solid ${active === i ? s.color : COLORS.border}`,
                background: active === i ? `${s.color}18` : "#0D0D14",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: active === i ? s.color : COLORS.muted,
                  letterSpacing: "0.05em",
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: active === i ? COLORS.text : COLORS.textDim,
                  marginTop: 2,
                  lineHeight: 1.3,
                }}
              >
                {s.title}
              </div>
            </button>
            {i < stages.length - 1 && (
              <div
                style={{
                  width: 20,
                  textAlign: "center",
                  color: COLORS.border,
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Detail card */}
      <div
        style={{
          background: "#0D0D14",
          border: `1px solid ${stages[active].color}44`,
          borderLeft: `4px solid ${stages[active].color}`,
          borderRadius: 10,
          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: stages[active].color,
            fontWeight: 700,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Replaces → {stages[active].replaces}
        </div>
        <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          {stages[active].detail}
        </p>
      </div>
    </Card>
  );
}

function UILayoutSection() {
  const [hoveredPanel, setHoveredPanel] = useState(null);
  const panels = [
    {
      id: "sidebar",
      label: "Left Nav",
      width: "14%",
      items: ["🔍 Search", "📋 Pipeline", "👤 Profile", "⚙️ Settings"],
      color: COLORS.accent,
      desc: "Minimal sidebar — 4 primary nav items, content-first design",
    },
    {
      id: "main",
      label: "Main Panel",
      width: "42%",
      items: ["Natural language search bar", "Ranked company list (10–20)", "Relevance scores", "Funding signals"],
      color: "#0EA5E9",
      desc: "Discovery surface — NL query → ranked results list with intent-based scoring",
    },
    {
      id: "right",
      label: "Right Panel (Slide-over)",
      width: "44%",
      items: ["Company intelligence", "Funding + headcount", "Key people list", "Outreach generator", "Copy / Send CTA"],
      color: "#10B981",
      desc: "Slides in on company click — intelligence + people + outreach in one panel",
    },
  ];
  return (
    <Card>
      <SectionTitle>UI Layout — Core Screen</SectionTitle>
      <div
        style={{
          display: "flex",
          gap: 4,
          height: 220,
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {panels.map((p) => (
          <div
            key={p.id}
            onMouseEnter={() => setHoveredPanel(p.id)}
            onMouseLeave={() => setHoveredPanel(null)}
            style={{
              width: p.width,
              background: hoveredPanel === p.id ? `${p.color}12` : "#0D0D14",
              borderRight: `1px solid ${COLORS.border}`,
              padding: "14px 12px",
              transition: "background 0.2s",
              cursor: "default",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: p.color,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderBottom: `1px solid ${p.color}33`,
                paddingBottom: 8,
                marginBottom: 10,
              }}
            >
              {p.label}
            </div>
            {p.items.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: COLORS.textDim,
                  padding: "4px 0",
                  borderBottom: `1px solid ${COLORS.border}44`,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      {hoveredPanel && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#0D0D14",
            borderRadius: 8,
            fontSize: 12,
            color: COLORS.textDim,
            borderLeft: `3px solid ${panels.find((p) => p.id === hoveredPanel).color}`,
          }}
        >
          {panels.find((p) => p.id === hoveredPanel).desc}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {[
          "Onboarding (3 steps)",
          "Discovery / Search",
          "Company Panel",
          "Outreach Generator",
          "Pipeline Board",
          "Profile Settings",
        ].map((screen) => (
          <Tag key={screen} color={COLORS.muted}>
            {screen}
          </Tag>
        ))}
      </div>
    </Card>
  );
}

function FeaturesSection() {
  const [filter, setFilter] = useState("All");
  const features = [
    { name: "LinkedIn OAuth signup / login", surface: "Auth", priority: "MVP", effort: "S" },
    { name: "Onboarding: target role + industry inputs", surface: "Onboarding", priority: "MVP", effort: "S" },
    { name: "Resume / CV upload + parsing", surface: "Onboarding", priority: "MVP", effort: "M" },
    { name: "AI candidate summary generation", surface: "Onboarding", priority: "MVP", effort: "S" },
    { name: "Natural language company search", surface: "Discovery", priority: "MVP", effort: "M" },
    { name: "Company results list (ranked)", surface: "Discovery", priority: "MVP", effort: "S" },
    { name: "Company intelligence panel", surface: "Intelligence", priority: "MVP", effort: "M" },
    { name: "AI company fit summary (personalised)", surface: "Intelligence", priority: "MVP", effort: "S" },
    { name: "Key people identification (Apollo)", surface: "People", priority: "MVP", effort: "M" },
    { name: "Outreach priority scoring", surface: "People", priority: "MVP", effort: "S" },
    { name: "LinkedIn connect note generation", surface: "Outreach", priority: "MVP", effort: "S" },
    { name: "Email draft generation", surface: "Outreach", priority: "MVP", effort: "S" },
    { name: "Inline message editing + regeneration", surface: "Outreach", priority: "MVP", effort: "S" },
    { name: "Direct LinkedIn send (OAuth)", surface: "Outreach", priority: "MVP", effort: "M" },
    { name: "Direct email send (Gmail SMTP)", surface: "Outreach", priority: "MVP", effort: "M" },
    { name: "Shortlist / save company", surface: "Pipeline", priority: "MVP", effort: "S" },
    { name: "Pipeline status board (4 stages)", surface: "Pipeline", priority: "MVP", effort: "S" },
    { name: "Mutual connection graph", surface: "Intelligence", priority: "P1", effort: "L" },
    { name: "Outreach analytics (reply rate)", surface: "Analytics", priority: "P1", effort: "M" },
    { name: "Stripe billing + credit system", surface: "Monetization", priority: "P1", effort: "M" },
    { name: "Founder radar (pre-hiring signals)", surface: "Discovery", priority: "P2", effort: "L" },
    { name: "Reverse discovery (who should hire me)", surface: "Discovery", priority: "P2", effort: "L" },
  ];
  const priorities = ["All", "MVP", "P1", "P2"];
  const priorityColor = { MVP: COLORS.green, P1: COLORS.amber, P2: COLORS.muted, OUT: COLORS.red };
  const effortColor = { S: COLORS.green, M: COLORS.amber, L: COLORS.red };
  const filtered = filter === "All" ? features : features.filter((f) => f.priority === filter);

  return (
    <Card>
      <SectionTitle>Feature Spec</SectionTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {priorities.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1px solid ${filter === p ? priorityColor[p] || COLORS.accent : COLORS.border}`,
              background: filter === p ? `${priorityColor[p] || COLORS.accent}22` : "transparent",
              color: filter === p ? priorityColor[p] || COLORS.accent : COLORS.muted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {p} {p !== "All" && `(${features.filter((f) => f.priority === p).length})`}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "#0D0D14",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{f.name}</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              <Tag color={COLORS.muted}>{f.surface}</Tag>
              <Tag color={priorityColor[f.priority]}>{f.priority}</Tag>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: `${effortColor[f.effort]}22`,
                  color: effortColor[f.effort],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {f.effort}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: COLORS.muted }}>
        S = 1–2 days · M = 3–5 days · L = 1–2 weeks
      </div>
    </Card>
  );
}

function TimelineSection() {
  const weeks = [
    {
      week: "Week 1",
      focus: "Foundation + Auth",
      color: "#6C63FF",
      items: [
        "Project setup + Supabase schema",
        "LinkedIn OAuth",
        "Onboarding flow (3 steps)",
        "Resume parsing",
        "Candidate summary generation",
      ],
    },
    {
      week: "Week 2",
      focus: "Discovery + Intelligence",
      color: "#0EA5E9",
      items: [
        "NL search with Claude intent extraction",
        "Exa + Crunchbase integration",
        "Company results list",
        "Company intelligence panel",
      ],
    },
    {
      week: "Week 3",
      focus: "People + Outreach",
      color: "#10B981",
      items: [
        "Apollo enrichment",
        "People list + scoring",
        "Outreach generation (LinkedIn + email)",
        "Copy-to-clipboard + inline editing",
      ],
    },
    {
      week: "Week 4",
      focus: "Pipeline + Polish",
      color: "#F59E0B",
      items: [
        "Lightweight pipeline board",
        "Status updates",
        "UI polish + error states",
        "Invite flow + beta launch prep",
      ],
    },
  ];
  return (
    <Card>
      <SectionTitle>4-Week MVP Build Plan</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {weeks.map((w) => (
          <div
            key={w.week}
            style={{
              background: "#0D0D14",
              borderRadius: 12,
              padding: 16,
              border: `1px solid ${w.color}44`,
              borderTop: `3px solid ${w.color}`,
            }}
          >
            <div style={{ fontSize: 11, color: w.color, fontWeight: 700, marginBottom: 4 }}>
              {w.week}
            </div>
            <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginBottom: 10 }}>
              {w.focus}
            </div>
            {w.items.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: COLORS.textDim,
                  padding: "3px 0",
                  borderBottom: `1px solid ${COLORS.border}44`,
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: w.color, marginTop: 1 }}>·</span>
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: `${COLORS.accent}12`,
          borderRadius: 8,
          fontSize: 12,
          color: COLORS.accentSoft,
          fontStyle: "italic",
          borderLeft: `3px solid ${COLORS.accent}`,
        }}
      >
        Shipping rule: Each week must produce a testable, shareable build. No week ends in just backend work.
      </div>
    </Card>
  );
}

function PricingSection() {
  const tiers = [
    {
      name: "Starter",
      price: "Free",
      color: COLORS.muted,
      items: ["10 company searches/mo", "5 outreach drafts", "Basic intelligence"],
      note: "Beta: invite-only, no paywall",
    },
    {
      name: "Growth",
      price: "$29/mo",
      color: COLORS.accent,
      items: ["Unlimited search", "50 outreach drafts", "Full intelligence", "Pipeline tracking"],
      highlight: true,
    },
    {
      name: "Pro",
      price: "$79/mo",
      color: COLORS.amber,
      items: ["Everything in Growth", "Direct sending (LinkedIn + Gmail)", "Relationship graph", "Priority support"],
    },
  ];
  return (
    <Card>
      <SectionTitle>Monetization — v1 Post-Beta</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {tiers.map((t) => (
          <div
            key={t.name}
            style={{
              background: t.highlight ? `${t.color}12` : "#0D0D14",
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${t.highlight ? t.color : COLORS.border}`,
              position: "relative",
            }}
          >
            {t.highlight && (
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: t.color,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 20,
                  letterSpacing: "0.05em",
                }}
              >
                MOST POPULAR
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: t.color, marginBottom: 4 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>
              {t.price}
            </div>
            {t.items.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  color: COLORS.textDim,
                  padding: "5px 0",
                  borderBottom: `1px solid ${COLORS.border}44`,
                  display: "flex",
                  gap: 6,
                }}
              >
                <span style={{ color: t.color }}>✓</span> {item}
              </div>
            ))}
            {t.note && (
              <div style={{ marginTop: 10, fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>
                {t.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function MetricsSection() {
  const metrics = [
    { label: "Onboarding completion", target: ">70%", signal: "3-step flow not too long" },
    { label: "Search → Company panel view", target: ">80%", signal: "Discovery working" },
    { label: "Panel → Outreach generated", target: ">50%", signal: "Intel creates conviction" },
    { label: "Outreach → Copied/Sent", target: ">70%", signal: "Message quality high" },
    { label: "D7 Retention", target: ">40%", signal: "Core loop compelling" },
    { label: "User-reported reply rate", target: ">15%", signal: "vs. 5–8% industry baseline" },
  ];
  return (
    <Card>
      <SectionTitle>Success Metrics — Beta</SectionTitle>
      <div
        style={{
          padding: "16px 20px",
          background: `${COLORS.accent}12`,
          borderRadius: 10,
          marginBottom: 16,
          borderLeft: `4px solid ${COLORS.accent}`,
        }}
      >
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, marginBottom: 4 }}>
          NORTH STAR
        </div>
        <div style={{ fontSize: 16, color: COLORS.text, fontWeight: 700 }}>
          Meaningful outreach initiated per active user per week
        </div>
        <div style={{ fontSize: 13, color: COLORS.accentSoft, marginTop: 4 }}>
          Target: 3+ by end of beta month 1
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {metrics.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "#0D0D14",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{m.label}</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: COLORS.green,
                minWidth: 60,
                textAlign: "right",
              }}
            >
              {m.target}
            </span>
            <span style={{ fontSize: 11, color: COLORS.muted, minWidth: 200, textAlign: "right" }}>
              {m.signal}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TechStackSection() {
  const stack = [
    { layer: "Frontend", choice: "Next.js 14 (App Router)" },
    { layer: "Styling", choice: "Tailwind CSS + shadcn/ui" },
    { layer: "Database", choice: "Supabase (Postgres)" },
    { layer: "Auth", choice: "LinkedIn OAuth via NextAuth.js" },
    { layer: "AI Layer", choice: "Anthropic Claude API (claude-sonnet-4)" },
    { layer: "Company Data", choice: "Crunchbase Basic API" },
    { layer: "Web Intelligence", choice: "Exa API" },
    { layer: "People Data", choice: "Apollo.io API" },
    { layer: "Hosting", choice: "Vercel (free tier)" },
  ];
  const aiTasks = [
    { task: "Intent Extraction", desc: "Raw query → structured search params", temp: "0.3" },
    { task: "Company Fit Summary", desc: "Company data + User profile → 3-sentence summary", temp: "0.5" },
    { task: "LinkedIn Outreach", desc: "Candidate + Company + Person → 280-char note", temp: "0.7" },
    { task: "Email Outreach", desc: "Same inputs → 150–200 word cold email", temp: "0.7" },
  ];
  return (
    <Card>
      <SectionTitle>Tech Stack + Claude Integration</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, marginBottom: 10 }}>
            STACK
          </div>
          {stack.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                padding: "7px 0",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <span style={{ fontSize: 11, color: COLORS.muted, minWidth: 120 }}>{s.layer}</span>
              <span style={{ fontSize: 11, color: COLORS.text }}>{s.choice}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "#0D0D14",
              borderRadius: 8,
              fontSize: 11,
              color: COLORS.muted,
            }}
          >
            💰 API cost: ~$0.08/user/week · At 500 beta users = ~$40/week
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, marginBottom: 10 }}>
            CLAUDE API TASKS
          </div>
          {aiTasks.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: "#0D0D14",
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: COLORS.accentSoft, fontWeight: 600 }}>
                  {t.task}
                </span>
                <Tag color={COLORS.muted}>temp: {t.temp}</Tag>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function RisksSection() {
  const risks = [
    { risk: "LinkedIn API restrictions", impact: "High", mitigation: "Copy-to-clipboard as primary; direct send post API review" },
    { risk: "Apollo / Crunchbase data accuracy", impact: "Medium", mitigation: "Show confidence score; let users flag inaccuracies" },
    { risk: "AI outreach quality variance", impact: "High", mitigation: "Quality guardrail prompts + user always edits before send" },
    { risk: "Spam behaviour at scale", impact: "High", mitigation: "Daily outreach caps + personalization requirements in prompt" },
    { risk: "Beta user drop-off at onboarding", impact: "Medium", mitigation: "3-step max; optional resume upload; fast path to first search" },
    { risk: "API cost overrun", impact: "Low", mitigation: "~$0.08/user/week; cache company summaries aggressively" },
  ];
  const impactColor = { High: COLORS.red, Medium: COLORS.amber, Low: COLORS.green };
  return (
    <Card>
      <SectionTitle>Risks & Mitigations</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {risks.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 2fr",
              gap: 12,
              padding: "10px 14px",
              background: "#0D0D14",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: COLORS.text }}>{r.risk}</span>
            <Tag color={impactColor[r.impact]}>{r.impact}</Tag>
            <span style={{ fontSize: 11, color: COLORS.textDim }}>{r.mitigation}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const sections = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Workflow" },
  { id: "ui", label: "UI Layout" },
  { id: "features", label: "Features" },
  { id: "timeline", label: "Timeline" },
  { id: "pricing", label: "Pricing" },
  { id: "metrics", label: "Metrics" },
  { id: "tech", label: "Tech Stack" },
  { id: "risks", label: "Risks" },
];

export default function App() {
  const [activeSection, setActiveSection] = useState("overview");
  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: COLORS.bg,
        minHeight: "100vh",
        color: COLORS.text,
      }}
    >
      {/* Nav */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: `${COLORS.bg}EE`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "0 24px",
          display: "flex",
          gap: 0,
          overflowX: "auto",
        }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setActiveSection(s.id);
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              padding: "14px 16px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${activeSection === s.id ? COLORS.accent : "transparent"}`,
              color: activeSection === s.id ? COLORS.text : COLORS.muted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px" }}>
        <div id="overview">
          <HeroSection />
          <PositioningSection />
        </div>
        <div id="workflow" style={{ marginTop: 24 }}>
          <WorkflowSection />
        </div>
        <div id="ui" style={{ marginTop: 24 }}>
          <UILayoutSection />
        </div>
        <div id="features" style={{ marginTop: 24 }}>
          <FeaturesSection />
        </div>
        <div id="timeline" style={{ marginTop: 24 }}>
          <TimelineSection />
        </div>
        <div id="pricing" style={{ marginTop: 24 }}>
          <PricingSection />
        </div>
        <div id="metrics" style={{ marginTop: 24 }}>
          <MetricsSection />
        </div>
        <div id="tech" style={{ marginTop: 24 }}>
          <TechStackSection />
        </div>
        <div id="risks" style={{ marginTop: 24 }}>
          <RisksSection />
        </div>
        <div
          style={{
            textAlign: "center",
            marginTop: 40,
            padding: 20,
            fontSize: 11,
            color: COLORS.muted,
          }}
        >
          Jobseek.ai · Confidential · v1.0 March 2025
        </div>
      </div>
    </div>
  );
}
