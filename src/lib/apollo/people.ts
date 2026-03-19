/**
 * People discovery adapter.
 * Uses Hunter.io domain search (free, 25/month) to find real decision makers.
 * Apollo free tier has no working people search endpoints.
 */

import { searchPeopleByDomain } from '@/services/hunter'
import type { Person } from '@/types'

function parseSeniority(seniority: string | null, title: string | null): string {
  const s = (seniority ?? '').toLowerCase()
  const t = (title ?? '').toLowerCase()

  if (t.includes('founder') || t.includes('ceo') || t.includes('cto') || t.includes('cpo') || t.includes('chief')) return 'Founder/C-Level'
  if (s === 'executive' || t.includes('vp') || t.includes('vice president')) return 'VP'
  if (t.includes('director')) return 'Director'
  if (t.includes('head of')) return 'Head'
  if (s === 'senior' || t.includes('manager') || t.includes('lead')) return 'Manager'
  if (s === 'intermediate') return 'Senior'
  if (s === 'junior') return 'Junior'
  return 'Senior'
}

export async function getPeopleForCompany(
  domain: string,
  companyId: string,
  targetRoles: string[]
): Promise<Array<Omit<Person, 'id' | 'created_at' | 'cached_at'>>> {
  const entries = await searchPeopleByDomain(domain, targetRoles, 10)

  return entries.map(e => ({
    apollo_id: null, // Hunter doesn't provide Apollo IDs
    company_id: companyId,
    name: [e.first_name, e.last_name].filter(Boolean).join(' ') || 'Unknown',
    title: e.position,
    seniority: parseSeniority(e.seniority, e.position),
    linkedin_url: e.linkedin,
    email: e.confidence >= 80 ? e.value : null, // only pre-reveal high-confidence emails
    photo_url: null,
    outreach_priority_score: e.priority_score,
  }))
}
