# Jobseek.ai — Design System v2
**Light-First · Lime Accent · Premium Startup UI**

> This document is the single source of truth for all UI decisions in Jobseek.ai. All new components and screens must follow these tokens. Dark mode is a future layer — implement as `[data-theme="dark"]` overrides on the same CSS custom properties.

---

## 1. Philosophy

Jobseek sits between **Linear** (crisp, data-dense, dark sidebar) and **Claude/Notion** (warm light canvas, breathable whitespace). The UI is for a high-agency job seeker who makes fast decisions — it must feel like a premium intelligence tool, not a job board.

**Principles:**
- Light canvas, dark sidebar — same pattern as Linear, Vercel, Raycast
- Lime is the only accent — used for CTAs, active states, highlights, success
- No gradients on interactive elements — flat lime, not rainbow glow
- Typography carries weight — size + font-weight hierarchy over color
- Data density without clutter — cards breathe, tables have rhythm
- Micro-interactions on every interactive element — 0-cost delight

---

## 2. Color System

### 2.1 CSS Custom Properties (`:root`)

```css
:root {
  /* === SURFACES === */
  --color-bg:           #F7F7F5;   /* warm off-white canvas — like Claude */
  --color-surface:      #FFFFFF;   /* cards, modals, panels */
  --color-surface-2:    #F0F0EC;   /* inset sections, table headers, hover rows */
  --color-surface-3:    #E8E8E3;   /* borders, dividers, skeleton base */

  /* === SIDEBAR (always dark) === */
  --color-sidebar-bg:   #111117;   /* near-black, slight blue undertone */
  --color-sidebar-hover:#1C1C25;
  --color-sidebar-active-bg: rgba(163,230,53,0.12);  /* lime tint */
  --color-sidebar-border: #1E1E2A;

  /* === LIME ACCENT === */
  --color-lime:         #A3E635;   /* lime-400 — primary CTA, active states */
  --color-lime-hover:   #84CC16;   /* lime-500 — hover/pressed */
  --color-lime-subtle:  rgba(163,230,53,0.12);  /* bg tint for tags, pills */
  --color-lime-border:  rgba(163,230,53,0.3);   /* border for lime-tinted elements */
  --color-lime-text:    #3F6212;   /* lime-900 — text ON lime-subtle bg */

  /* === TEXT === */
  --color-text-primary:   #0F0F0F;  /* headings, body */
  --color-text-secondary: #5A5A65;  /* labels, metadata */
  --color-text-tertiary:  #9B9BA8;  /* placeholders, timestamps */
  --color-text-inverse:   #FFFFFF;  /* text on dark/lime backgrounds */
  --color-text-on-lime:   #1A2E05;  /* text directly on --color-lime button */

  /* === SEMANTIC === */
  --color-success:        #22C55E;  /* green-500 */
  --color-success-subtle: rgba(34,197,94,0.1);
  --color-warning:        #F59E0B;  /* amber-500 */
  --color-warning-subtle: rgba(245,158,11,0.1);
  --color-error:          #EF4444;  /* red-500 */
  --color-error-subtle:   rgba(239,68,68,0.1);
  --color-info:           #3B82F6;  /* blue-500 */
  --color-info-subtle:    rgba(59,130,246,0.1);

  /* === BORDERS === */
  --border-subtle:    1px solid #E8E8E3;
  --border-default:   1px solid #D4D4CC;
  --border-strong:    1px solid #B0B0A8;

  /* === SHADOWS === */
  --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:  0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04);
  --shadow-lime: 0 0 0 3px rgba(163,230,53,0.25);  /* focus ring */

  /* === RADIUS === */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;
  --radius-full: 9999px;

  /* === TRANSITIONS === */
  --transition-fast:   100ms ease;
  --transition-base:   160ms ease;
  --transition-slow:   240ms ease;
}
```

### 2.2 Sidebar — Always Dark

The sidebar never goes light. It is the permanent dark anchor that makes the light canvas feel intentional. Same pattern as Linear, Vercel dashboard, Raycast.

```css
/* Applied to .sidebar wrapper */
background: var(--color-sidebar-bg);
border-right: var(--color-sidebar-border) 1px solid;
```

### 2.3 Dark Mode (future layer — do not build now)

```css
[data-theme="dark"] {
  --color-bg:          #111117;
  --color-surface:     #17171F;
  --color-surface-2:   #1C1C26;
  --color-surface-3:   #252530;
  --color-text-primary:   #F0F0EE;
  --color-text-secondary: #8A8A98;
  --color-text-tertiary:  #55555F;
  /* lime stays the same — it pops on dark too */
}
```

---

## 3. Typography

### 3.1 Font Stack

**Primary: Geist Sans** — Vercel's typeface. Clean, modern, exceptional at small sizes. Included in Next.js via `next/font/local` or the `geist` npm package.

**Mono: Geist Mono** — for code, IDs, API keys, technical strings.

```ts
// app/layout.tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-geist-sans)' }}>
        {children}
      </body>
    </html>
  )
}
```

```css
:root {
  --font-sans: var(--font-geist-sans), 'Inter', system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), 'JetBrains Mono', monospace;
}
```

### 3.2 Type Scale

| Token          | Size  | Weight | Line-height | Usage                          |
|----------------|-------|--------|-------------|--------------------------------|
| `--text-xs`    | 11px  | 500    | 1.4         | Timestamps, badges, metadata   |
| `--text-sm`    | 13px  | 400/500| 1.5         | Body, labels, table cells      |
| `--text-base`  | 15px  | 400    | 1.6         | Primary reading text           |
| `--text-md`    | 17px  | 500    | 1.5         | Card titles, section headings  |
| `--text-lg`    | 20px  | 600    | 1.4         | Page titles, modal headers     |
| `--text-xl`    | 24px  | 700    | 1.3         | Dashboard H1                   |
| `--text-2xl`   | 32px  | 800    | 1.2         | Landing/onboarding hero text   |
| `--text-3xl`   | 40px  | 800    | 1.1         | Login screen logo              |

### 3.3 Usage Rules

- **Page title** (e.g. "Discover Companies") → `text-xl` / `font-bold` / `--color-text-primary`
- **Section label** (e.g. "ACTIVE SIGNALS") → `text-xs` / `font-semibold` / `uppercase` / `tracking-widest` / `--color-text-tertiary`
- **Card title** → `text-md` / `font-semibold` / `--color-text-primary`
- **Body / description** → `text-sm` / `font-normal` / `--color-text-secondary`
- **Metadata / timestamp** → `text-xs` / `--color-text-tertiary`
- **Lime highlight** → wrap in `<span>` with `color: var(--color-lime-hover)` — never full lime-400 on white (too bright)

---

## 4. Button System

### 4.1 Primary CTA — Lime

Used for: Generate Outreach, Start Search, Save to Pipeline, Complete Step.

```tsx
<button
  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all
             hover:brightness-105 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
  style={{
    background: 'var(--color-lime)',
    color: 'var(--color-text-on-lime)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  }}
>
  Generate Outreach ✦
</button>
```

**States:**
- Default: `background: #A3E635`, text `#1A2E05`
- Hover: `background: #84CC16` (lime-500)
- Active/pressed: `scale(0.97)` + `background: #65A30D` (lime-600)
- Disabled: `opacity: 0.45`
- Loading: swap label for spinner, keep lime bg

### 4.2 Secondary — Outlined

Used for: Cancel, Back, secondary actions.

```tsx
<button
  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all
             hover:bg-[var(--color-surface-2)] active:scale-[0.97]"
  style={{
    background: 'transparent',
    border: 'var(--border-default)',
    color: 'var(--color-text-primary)',
  }}
>
  Cancel
</button>
```

### 4.3 Ghost — Text Only

Used for: "View full profile", "See all", inline nav links.

```tsx
<button
  className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors
             hover:text-[var(--color-lime-hover)]"
  style={{ color: 'var(--color-text-secondary)' }}
>
  View all →
</button>
```

### 4.4 Destructive

```tsx
<button
  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all
             hover:bg-red-50 active:scale-[0.97]"
  style={{
    background: 'transparent',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#EF4444',
  }}
>
  Remove
</button>
```

### 4.5 Icon Button

```tsx
<button
  className="flex items-center justify-center rounded-lg p-2 transition-all
             hover:bg-[var(--color-surface-2)] active:scale-[0.93]"
  style={{ color: 'var(--color-text-tertiary)' }}
>
  <Copy size={15} />
</button>
```

---

## 5. Card System

### 5.1 Base Card

```tsx
<div
  className="rounded-xl p-5"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
  }}
>
  {/* content */}
</div>
```

### 5.2 Company Card (Discover page)

```tsx
<div
  className="group rounded-xl p-4 transition-all cursor-pointer
             hover:shadow-md hover:-translate-y-0.5"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-subtle)',
    boxShadow: 'var(--shadow-xs)',
  }}
>
  {/* Header row */}
  <div className="flex items-start justify-between gap-3 mb-3">
    <div className="flex items-center gap-3">
      {/* Company logo/favicon */}
      <div className="h-9 w-9 rounded-lg overflow-hidden flex-shrink-0"
        style={{ background: 'var(--color-surface-2)', border: 'var(--border-subtle)' }}>
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {company.name}
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {company.industry} · {company.size}
        </p>
      </div>
    </div>
    {/* Signal badge */}
    {company.signalCount > 0 && (
      <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--color-lime-subtle)',
          color: 'var(--color-lime-text)',
          border: '1px solid var(--color-lime-border)',
        }}>
        {company.signalCount} signal{company.signalCount > 1 ? 's' : ''}
      </span>
    )}
  </div>

  {/* Description */}
  <p className="mb-3 text-xs leading-relaxed line-clamp-2"
    style={{ color: 'var(--color-text-secondary)' }}>
    {company.description}
  </p>

  {/* Footer */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {company.tags?.slice(0, 2).map(tag => (
        <span key={tag} className="rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-tertiary)',
          }}>
          {tag}
        </span>
      ))}
    </div>
    <button className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ color: 'var(--color-lime-hover)' }}>
      View →
    </button>
  </div>
</div>
```

### 5.3 Signal Card

```tsx
<div
  className="rounded-xl p-4 transition-all"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-subtle)',
    borderLeft: `3px solid ${SIGNAL_COLORS[signal.type]}`,
    boxShadow: 'var(--shadow-xs)',
  }}
>
  {/* signal content */}
</div>
```

Signal type left-border colors:
```ts
const SIGNAL_COLORS = {
  JOB_CHANGE:            '#A3E635',  // lime
  HIRING_POST:           '#3B82F6',  // blue
  FUNDING_SIGNAL:        '#F59E0B',  // amber
  DECISION_MAKER_ACTIVE: '#8B5CF6',  // violet
  COMPANY_MILESTONE:     '#06B6D4',  // cyan
  WARM_PATH_OPENED:      '#22C55E',  // green
}
```

### 5.4 Stat / Metric Card

```tsx
<div
  className="rounded-xl p-5"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-subtle)',
    boxShadow: 'var(--shadow-xs)',
  }}
>
  <p className="mb-1 text-xs font-semibold uppercase tracking-widest"
    style={{ color: 'var(--color-text-tertiary)' }}>
    {label}
  </p>
  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
    {value}
  </p>
  {delta && (
    <p className="mt-1 text-xs" style={{ color: delta > 0 ? '#22C55E' : '#EF4444' }}>
      {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}% vs last week
    </p>
  )}
</div>
```

---

## 6. Input System

### 6.1 Text Input

```tsx
<input
  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-default)',
    color: 'var(--color-text-primary)',
  }}
  onFocus={e => {
    e.target.style.borderColor = 'var(--color-lime)'
    e.target.style.boxShadow = 'var(--shadow-lime)'
  }}
  onBlur={e => {
    e.target.style.removeProperty('border-color')
    e.target.style.boxShadow = 'none'
  }}
  placeholder="Search companies..."
/>
```

### 6.2 Search Bar (larger, page-level)

```tsx
<div className="relative">
  <Search
    size={15}
    className="absolute left-3.5 top-1/2 -translate-y-1/2"
    style={{ color: 'var(--color-text-tertiary)' }}
  />
  <input
    className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
    style={{
      background: 'var(--color-surface)',
      border: 'var(--border-default)',
      color: 'var(--color-text-primary)',
      boxShadow: 'var(--shadow-xs)',
    }}
    onFocus={e => {
      e.target.style.borderColor = '#A3E635'
      e.target.style.boxShadow = '0 0 0 3px rgba(163,230,53,0.2)'
    }}
    onBlur={e => {
      e.target.style.removeProperty('border-color')
      e.target.style.boxShadow = 'var(--shadow-xs)'
    }}
  />
</div>
```

### 6.3 Pill Multi-select (roles, industries)

```tsx
// Unselected pill
<button
  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-default)',
    color: 'var(--color-text-secondary)',
  }}
>
  {label}
</button>

// Selected pill
<button
  className="rounded-full px-3 py-1.5 text-xs font-semibold"
  style={{
    background: 'var(--color-lime-subtle)',
    border: '1px solid var(--color-lime-border)',
    color: 'var(--color-lime-text)',
  }}
>
  ✓ {label}
</button>
```

---

## 7. Badge / Tag System

```tsx
const badgeStyles = {
  JOB_CHANGE:            { background: 'rgba(163,230,53,0.12)', color: '#3F6212', border: '1px solid rgba(163,230,53,0.3)' },
  HIRING_POST:           { background: 'rgba(59,130,246,0.1)',  color: '#1D4ED8', border: '1px solid rgba(59,130,246,0.25)' },
  FUNDING_SIGNAL:        { background: 'rgba(245,158,11,0.1)',  color: '#B45309', border: '1px solid rgba(245,158,11,0.25)' },
  DECISION_MAKER_ACTIVE: { background: 'rgba(139,92,246,0.1)', color: '#6D28D9', border: '1px solid rgba(139,92,246,0.25)' },
  COMPANY_MILESTONE:     { background: 'rgba(6,182,212,0.1)',   color: '#0E7490', border: '1px solid rgba(6,182,212,0.25)' },
  WARM_PATH_OPENED:      { background: 'rgba(34,197,94,0.1)',   color: '#15803D', border: '1px solid rgba(34,197,94,0.25)' },
}
```

**Tier badges:**
```tsx
// Tier 1 — lime
<span style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)', border: '1px solid var(--color-lime-border)' }}
  className="rounded-full px-2 py-0.5 text-[10px] font-bold">T1</span>

// Tier 2 — muted
<span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)', border: 'var(--border-subtle)' }}
  className="rounded-full px-2 py-0.5 text-[10px] font-medium">T2</span>
```

---

## 8. Sidebar Redesign

The sidebar stays **dark** (`#111117`) permanently — it's the visual anchor. The content area is light. This contrast is the core aesthetic.

```tsx
// Sidebar.tsx — full redesign
return (
  <div
    className="fixed top-0 left-0 z-40 flex h-full w-[220px] flex-col py-5"
    style={{ background: '#111117', borderRight: '1px solid #1E1E2A' }}
  >
    {/* Logo */}
    <div className="mb-7 px-5">
      <h1 className="text-lg font-extrabold tracking-tight" style={{ color: '#FAFAF8' }}>
        Jobseek.ai
      </h1>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: '#A3E635', opacity: 0.8 }}>
        Career Outbound
      </p>
    </div>

    {/* Nav */}
    <nav className="flex-1 space-y-0.5 px-2.5">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all"
            style={{
              background:  active ? 'rgba(163,230,53,0.12)' : 'transparent',
              color:       active ? '#A3E635' : '#6B7280',
              borderLeft:  active ? '2px solid #A3E635' : '2px solid transparent',
            }}
          >
            <Icon size={15} />
            {label}
          </Link>
        )
      })}
    </nav>

    {/* User chip */}
    <div className="mx-2.5 mt-4 rounded-lg p-3"
      style={{ background: '#1A1A23', border: '1px solid #252530' }}>
      {profile && (
        <div className="mb-2.5 flex items-center gap-2.5">
          {/* Avatar initials */}
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: '#A3E635', color: '#1A2E05' }}>
            {(profile.name ?? profile.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold" style={{ color: '#E5E7EB' }}>
              {profile.name ?? 'User'}
            </p>
            {profile.email && (
              <p className="truncate text-[10px]" style={{ color: '#6B7280' }}>
                {profile.email}
              </p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={handleSignOut}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-all hover:bg-white/5"
        style={{ color: '#6B7280' }}
      >
        <LogOut size={11} />
        Sign out
      </button>
    </div>
  </div>
)
```

---

## 9. Page Layout Wrapper

```tsx
// Main content area — offset by sidebar
<main
  className="min-h-screen"
  style={{
    marginLeft: '220px',
    background: 'var(--color-bg)',
    padding: '32px 36px',
  }}
>
  {children}
</main>
```

**Page header pattern:**
```tsx
<div className="mb-8 flex items-center justify-between">
  <div>
    <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
      Discover Companies
    </h1>
    <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
      AI-matched companies hiring for your target roles
    </p>
  </div>
  {/* Optional right-side CTA */}
</div>
```

---

## 10. Onboarding Redesign

Split-panel layout: **dark brand left** + **light form right**. Same feel as Linear, Vercel project setup.

### 10.1 Layout Shell

```tsx
<div className="flex min-h-screen">
  {/* Left — dark brand panel */}
  <div
    className="hidden lg:flex w-[360px] flex-shrink-0 flex-col justify-between p-10"
    style={{ background: '#111117', borderRight: '1px solid #1E1E2A' }}
  >
    <div>
      <h1 className="text-2xl font-extrabold" style={{ color: '#FAFAF8' }}>Jobseek.ai</h1>
      <p className="mt-1 text-sm font-medium" style={{ color: '#A3E635' }}>Career Outbound</p>
    </div>

    {/* Step progress */}
    <div className="space-y-3">
      {STEPS.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: i < currentStep ? '#A3E635' : i === currentStep ? 'rgba(163,230,53,0.15)' : 'transparent',
              border: i === currentStep ? '1px solid #A3E635' : '1px solid #2A2A35',
              color: i < currentStep ? '#1A2E05' : i === currentStep ? '#A3E635' : '#4B5563',
            }}
          >
            {i < currentStep ? '✓' : i + 1}
          </div>
          <span className="text-sm font-medium"
            style={{ color: i === currentStep ? '#F0F0EE' : '#4B5563' }}>
            {step.label}
          </span>
        </div>
      ))}
    </div>

    <p className="text-xs" style={{ color: '#374151' }}>Setup takes ~2 minutes</p>
  </div>

  {/* Right — light form area */}
  <div
    className="flex flex-1 flex-col items-center justify-center p-8"
    style={{ background: 'var(--color-bg)' }}
  >
    <div className="w-full max-w-lg">
      {/* Step card renders here */}
    </div>
  </div>
</div>
```

### 10.2 Step Card

```tsx
<div
  className="rounded-2xl p-8"
  style={{
    background: 'var(--color-surface)',
    border: 'var(--border-subtle)',
    boxShadow: 'var(--shadow-md)',
  }}
>
  <div className="mb-6">
    <p className="mb-1 text-xs font-semibold uppercase tracking-widest"
      style={{ color: 'var(--color-lime-hover)' }}>
      Step {step} of {total}
    </p>
    <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
      {title}
    </h2>
    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
      {description}
    </p>
  </div>

  {children}

  <div className="mt-8 flex items-center justify-between">
    {step > 1 ? (
      <button onClick={onBack} className="...secondary outlined...">← Back</button>
    ) : <div />}
    <button onClick={onNext} className="...lime primary...">
      {isLast ? 'Finish setup →' : 'Continue →'}
    </button>
  </div>
</div>
```

### 10.3 Seniority Grid Selector

```tsx
<div className="grid grid-cols-2 gap-2.5">
  {SENIORITY_OPTIONS.map(opt => {
    const selected = value === opt.id
    return (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        className="rounded-xl p-3.5 text-left transition-all hover:shadow-sm active:scale-[0.98]"
        style={{
          background: selected ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
          border: selected ? '1px solid var(--color-lime-border)' : 'var(--border-subtle)',
          boxShadow: selected ? 'var(--shadow-lime)' : 'none',
        }}
      >
        <p className="text-sm font-semibold"
          style={{ color: selected ? 'var(--color-lime-text)' : 'var(--color-text-primary)' }}>
          {opt.label}
        </p>
        <p className="mt-0.5 text-xs"
          style={{ color: selected ? '#4D7C0F' : 'var(--color-text-tertiary)' }}>
          {opt.desc}
        </p>
      </button>
    )
  })}
</div>
```

---

## 11. Loading & Skeleton States

```css
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-surface-3) 25%,
    var(--color-surface-2) 50%,
    var(--color-surface-3) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

```tsx
// Card skeleton
<div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: 'var(--border-subtle)' }}>
  <div className="mb-3 flex items-center gap-3">
    <div className="h-9 w-9 rounded-lg skeleton-shimmer" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 w-36 rounded skeleton-shimmer" />
      <div className="h-2.5 w-24 rounded skeleton-shimmer" />
    </div>
  </div>
  <div className="space-y-2">
    <div className="h-2.5 w-full rounded skeleton-shimmer" />
    <div className="h-2.5 w-5/6 rounded skeleton-shimmer" />
  </div>
</div>
```

---

## 12. Animation System (Framer Motion)

```bash
npm install framer-motion
```

**Page enter:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
```

**Card stagger:**
```tsx
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18 } }
}
```

**Slide-in drawer (outreach panel):**
```tsx
<motion.div
  initial={{ x: '100%', opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: '100%', opacity: 0 }}
  transition={{ type: 'spring', damping: 26, stiffness: 280 }}
  className="fixed right-0 top-0 h-full w-[440px] z-50"
  style={{ background: 'var(--color-surface)', borderLeft: 'var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
/>
```

**Micro-interactions (every button):**
```tsx
className="... transition-all active:scale-[0.97] hover:brightness-105"
```

---

## 13. Login Page Redesign

```tsx
<div className="min-h-screen flex items-center justify-center px-4"
  style={{ background: 'var(--color-bg)' }}>

  {/* Subtle lime glow — very faint */}
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
    <div className="h-[600px] w-[600px] rounded-full opacity-[0.06] blur-3xl"
      style={{ background: 'radial-gradient(circle, #A3E635 0%, transparent 70%)' }} />
  </div>

  <div className="relative w-full max-w-sm">
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}>
        Jobseek.ai
      </h1>
      <p className="mt-1.5 text-sm font-medium italic"
        style={{ color: 'var(--color-lime-hover)' }}>
        &ldquo;Stop applying. Start reaching out.&rdquo;
      </p>
    </div>

    <div className="rounded-2xl p-7"
      style={{ background: 'var(--color-surface)', border: 'var(--border-default)', boxShadow: 'var(--shadow-lg)' }}>
      {/* form — same logic, light tokens */}
      <button className="w-full ...lime primary button...">
        Send magic link →
      </button>
    </div>

    <div className="mt-4">
      <a href="/demo/discover"
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
        style={{
          background: 'var(--color-lime-subtle)',
          border: '1px solid var(--color-lime-border)',
          color: 'var(--color-lime-text)',
        }}>
        ✦ Explore demo — no sign-up needed
      </a>
    </div>
  </div>
</div>
```

---

## 14. globals.css Block

Add to `src/app/globals.css`:

```css
:root {
  --color-bg:             #F7F7F5;
  --color-surface:        #FFFFFF;
  --color-surface-2:      #F0F0EC;
  --color-surface-3:      #E8E8E3;
  --color-sidebar-bg:     #111117;
  --color-sidebar-border: #1E1E2A;
  --color-lime:           #A3E635;
  --color-lime-hover:     #84CC16;
  --color-lime-subtle:    rgba(163,230,53,0.12);
  --color-lime-border:    rgba(163,230,53,0.3);
  --color-lime-text:      #3F6212;
  --color-text-primary:   #0F0F0F;
  --color-text-secondary: #5A5A65;
  --color-text-tertiary:  #9B9BA8;
  --color-text-on-lime:   #1A2E05;
  --border-subtle:        1px solid #E8E8E3;
  --border-default:       1px solid #D4D4CC;
  --shadow-xs:            0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:            0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:            0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg:            0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04);
  --shadow-lime:          0 0 0 3px rgba(163,230,53,0.25);
  --radius-lg:            14px;
  --transition-base:      160ms ease;
}

body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-geist-sans), 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

## 15. Implementation Batches for Claude Code

### Batch 1 — Foundation
1. `globals.css` → add all CSS custom properties
2. `app/layout.tsx` → install + wire `geist` fonts
3. `Sidebar.tsx` → full rewrite: dark nav, lime active, avatar chip
4. `npm install framer-motion`

### Batch 2 — Auth + Onboarding
1. `login/page.tsx` → light bg, lime CTA, dark logo text
2. `onboarding/page.tsx` → split-panel, step indicator, seniority grid

### Batch 3 — Core Pages
1. `discover/page.tsx` — light canvas, card grid, lime hover
2. `signals/page.tsx` — left-border color coding per type
3. `pipeline/page.tsx` — kanban on light bg
4. `dashboard/page.tsx` — stat cards
5. `profile/page.tsx` — settings form

### Batch 4 — Polish
1. Framer Motion stagger on lists
2. Slide-in outreach panel
3. Skeleton shimmer on all loading states
4. Empty states per section
5. Dark mode toggle scaffold (sets `data-theme="dark"` on `<html>`)

---

## 16. Quick Reference

| Need                  | Value                                         |
|-----------------------|-----------------------------------------------|
| Page background       | `var(--color-bg)` → `#F7F7F5`               |
| Card background       | `var(--color-surface)` → `#FFFFFF`          |
| Inset surface         | `var(--color-surface-2)` → `#F0F0EC`        |
| Primary border        | `var(--border-subtle)` → `1px solid #E8E8E3`|
| Primary text          | `var(--color-text-primary)` → `#0F0F0F`     |
| Secondary text        | `var(--color-text-secondary)` → `#5A5A65`   |
| Muted text            | `var(--color-text-tertiary)` → `#9B9BA8`    |
| Lime CTA              | `bg: #A3E635` / `color: #1A2E05`            |
| Lime hover            | `#84CC16`                                   |
| Lime tint bg          | `rgba(163,230,53,0.12)`                     |
| Lime focus ring       | `0 0 0 3px rgba(163,230,53,0.25)`           |
| Sidebar               | `#111117` bg — always dark                  |
| Active nav item       | lime tint + `2px solid #A3E635` left border |
| Font                  | Geist Sans (UI) · Geist Mono (code)         |
| Card radius           | `14px`                                      |
| Page padding          | `32px 36px`                                 |
| Transition            | `160ms ease`                                |
