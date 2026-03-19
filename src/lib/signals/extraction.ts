// Pure functions for extracting company names, roles, and metadata from signal data.
// Extracted from the companies route for testability.

export function normalizeCompanyName(raw: string): string {
  return raw
    .trim()
    .replace(/[.,]$/, '')
    .replace(/\s+(Inc|LLC|Ltd|Corp|Co|GmbH|SA|AG|PLC)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function looksLikePersonName(name: string): boolean {
  if (!name) return false
  const trimmed = name.trim()
  if (/\b(Inc|LLC|Ltd|Corp|Labs|Technologies|Solutions|Ventures|Capital|Health|AI|Tech|Group|Global|Digital|Systems|Studios|Media|Platform|Platforms|Software|Services|Network|Networks|Finance|Financial|Consulting|Analytics|Robotics|Therapeutics|Pharma|Bio|Energy|Motors|Foods|Brands)\b/i.test(trimmed)) return false
  if (!trimmed.includes(' ')) return false
  const words = trimmed.split(/\s+/)
  if (words.length === 2) {
    const [first, second] = words
    if (/^[A-Z][a-z]+$/.test(first) && /^[A-Z]\.?$/.test(second)) return true
    if (/^[A-Z][a-z]+$/.test(first) && /^[A-Z][a-z]+$/.test(second)) return true
  }
  if (words.length === 3 && words.every(w => /^[A-Z][a-z]*\.?$/.test(w))) return true
  return false
}

export function looksLikeJobTitle(name: string): boolean {
  if (!name) return false
  return /\b(manager|engineer|developer|designer|analyst|director|lead|senior|junior|intern|specialist|coordinator|consultant|architect|scientist|product|head of|vp of)\b/i.test(name)
}

export function extractCompanyFromTitle(title: string | null): string | null {
  if (!title) return null
  const separators = [' · ', ' | ', ' - ', ' @ ']
  for (const sep of separators) {
    const idx = title.lastIndexOf(sep)
    if (idx !== -1) {
      const candidate = title.slice(idx + sep.length).trim()
      if (candidate.length > 1 && candidate.length < 80) {
        if (/\b(manager|engineer|developer|designer|analyst|director|lead|senior|junior|intern|specialist|coordinator|consultant|architect|scientist|pm|swe|sde|vp|cto|ceo|cfo)\b/i.test(candidate) && candidate.length < 20) continue
        if (looksLikePersonName(candidate)) continue
        return normalizeCompanyName(candidate)
      }
    }
  }
  const atMatch = title.match(/\bat\s+(.{2,60})$/i)
  if (atMatch) {
    const candidate = atMatch[1].trim()
    if (!looksLikePersonName(candidate)) return normalizeCompanyName(candidate)
  }
  return null
}

export function extractCompanyFromReasoning(reasoning: string | null): string | null {
  if (!reasoning) return null
  const patterns = [
    /(?:hiring (?:for|at)|for|at|joining|joined|starting at|new role at|position at|working at|posted (?:by|about)|announced by)\s+([A-Z][A-Za-z0-9\s.&-]{1,40}?)(?:\s+as\s|\s*[,.]|\s+which|\s+indicating|\s+with|\s+is|\s+that|\s+in\s|\s+for\s)/,
    /(?:for|at|hiring at|hiring for)\s+([A-Z][A-Za-z0-9\s.&-]{1,40})$/,
    /['"]([A-Z][A-Za-z0-9\s.&-]{1,30})['"]/,
    /^([A-Z][A-Za-z0-9\s.&-]{1,30})\s+(?:is hiring|is actively hiring|posted|announced)/,
  ]
  for (const pattern of patterns) {
    const match = reasoning.match(pattern)
    if (match) {
      const candidate = match[1].trim()
      if (candidate.length > 1 && candidate.length < 60 && !looksLikePersonName(candidate)) {
        return normalizeCompanyName(candidate)
      }
    }
  }
  return null
}

export function extractCompanyFromPreview(preview: string | null): string | null {
  if (!preview) return null
  const jobMatch = preview.match(/^Job:\s+(.+?)\s+at\s+([^.]+)\./i)
  if (jobMatch) {
    const jobTitle = jobMatch[1].trim()
    const candidate = jobMatch[2].trim()
    if (candidate.length > 60) return null
    if (candidate.toLowerCase() === jobTitle.toLowerCase()) return null
    if (/\b(manager|engineer|developer|designer|analyst|director|lead|senior|junior|intern|specialist|coordinator|consultant|architect|scientist)\b/i.test(candidate)) return null
    if (!looksLikePersonName(candidate)) return normalizeCompanyName(candidate)
  }
  return null
}

export function extractRoleFromTitle(title: string | null): string | null {
  if (!title) return null
  const separators = [' · ', ' | ', ' - ', ' @ ']
  let role = title
  for (const sep of separators) {
    const idx = title.indexOf(sep)
    if (idx !== -1) {
      role = title.slice(0, idx).trim()
      break
    }
  }
  const atMatch = role.match(/^(.+?)\s+at\s+/i)
  if (atMatch) role = atMatch[1].trim()
  if (role && role.length > 1 && role.length < 100) return role
  return null
}

export function extractRoleFromReasoning(reasoning: string | null, preview: string | null): string | null {
  if (reasoning) {
    const patterns = [
      /hiring (?:a |an |for (?:a |an )?)?([A-Z][A-Za-z /&-]{3,60}?)(?:\s+role|\s+position|\s*[,.]|\s+at\s|\s+in\s)/i,
      /looking for (?:a |an )?([A-Z][A-Za-z /&-]{3,60}?)(?:\s*[,.]|\s+at\s|\s+in\s)/i,
      /role(?:s)? (?:like |such as |including )?([A-Z][A-Za-z /&-]{3,60}?)(?:\s*[,.]|\s+at\s)/i,
      /(?:opening|position|vacancy) (?:for (?:a |an )?)?([A-Z][A-Za-z /&-]{3,60}?)(?:\s*[,.]|\s+at\s)/i,
    ]
    for (const p of patterns) {
      const m = reasoning.match(p)
      if (m && m[1].trim().length > 3) return m[1].trim()
    }
  }
  if (preview) {
    const jobMatch = preview.match(/^Job:\s+(.+?)(?:\s+at\s|\.)/i)
    if (jobMatch && jobMatch[1].trim().length > 3) return jobMatch[1].trim()
  }
  return null
}

export function parseSeniority(title: string): string {
  const t = title.toLowerCase()
  if (/\b(ceo|cto|cfo|coo|cpo|founder|co-founder|chief)\b/.test(t)) return 'c-level'
  if (/\b(vp|vice president)\b/.test(t)) return 'vp'
  if (/\bdirector\b/.test(t)) return 'director'
  if (/\b(head of|head)\b/.test(t)) return 'head'
  if (/\b(manager|lead|principal|staff)\b/.test(t)) return 'lead'
  if (/\bsenior\b/.test(t)) return 'senior'
  if (/\bjunior\b/.test(t)) return 'junior'
  return 'mid'
}

export function parseDepartment(title: string): string | null {
  const t = title.toLowerCase()
  if (/\b(engineer|developer|software|swe|backend|frontend|fullstack|devops|sre|infra|platform|data engineer)\b/.test(t)) return 'engineering'
  if (/\b(product manager|product lead|product director|pm\b)/.test(t)) return 'product'
  if (/\b(design|ux|ui|creative)\b/.test(t)) return 'design'
  if (/\b(marketing|growth|brand|content|seo|sem)\b/.test(t)) return 'marketing'
  if (/\b(sales|account exec|business development|bd|revenue)\b/.test(t)) return 'sales'
  if (/\b(operations|ops|supply chain|logistics)\b/.test(t)) return 'operations'
  if (/\b(data scientist|ml|machine learning|ai|research)\b/.test(t)) return 'data-science'
  if (/\b(hr|people|talent|recruiting)\b/.test(t)) return 'people'
  return null
}
