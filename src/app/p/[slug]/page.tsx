import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PublicProfileView } from '@/career-intelligence/components/PublicProfileView'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, slug')
    .eq('slug', slug)
    .eq('is_profile_public', true)
    .single()

  if (!profile) return { title: 'Profile not found' }
  return {
    title: `${profile.name} — Jobseek Profile`,
    description: `View ${profile.name}'s professional profile on Jobseek.ai`,
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, slug, linkedin_url, twitter_url, github_url, website_url, location')
    .eq('slug', slug)
    .eq('is_profile_public', true)
    .single()

  if (!profile) notFound()

  const { data: model } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', profile.id)
    .single()

  return <PublicProfileView profile={profile} model={model} />
}
