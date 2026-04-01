import { ExternalLink, MapPin, Linkedin, Twitter, Github } from 'lucide-react'
import type { WorkExperience, Project } from '@/career-intelligence/types'

interface ProfileData {
  name: string | null
  slug: string
  linkedin_url?: string | null
  twitter_url?: string | null
  github_url?: string | null
  website_url?: string | null
  location?: string | null
}

interface ModelData {
  headline?: string | null
  positioning?: string | null
  bio_long?: string | null
  work_experiences?: WorkExperience[]
  projects?: Project[]
}

interface PublicProfileViewProps {
  profile: ProfileData
  model: ModelData | null
}

export function PublicProfileView({ profile, model }: PublicProfileViewProps) {
  const workExperiences = (model?.work_experiences ?? []) as WorkExperience[]
  const projects = (model?.projects ?? []) as Project[]

  return (
    <div style={{ background: '#F7F7F5', minHeight: '100vh' }}>
      {/* Nav */}
      <div style={{ background: '#111117', borderBottom: '1px solid #1E1E2A', padding: '16px 32px' }}>
        <a href="/" style={{ fontSize: '14px', fontWeight: 800, color: '#FAFAF8', textDecoration: 'none' }}>
          Jobseek.ai
        </a>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        {/* Hero */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#A3E635', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 800, color: '#1A2E05', marginBottom: '20px'
          }}>
            {(profile.name ?? 'U')[0].toUpperCase()}
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F0F0F', margin: '0 0 6px' }}>
            {profile.name}
          </h1>

          {model?.headline && (
            <p style={{ fontSize: '16px', color: '#5A5A65', margin: '0 0 12px' }}>
              {model.headline}
            </p>
          )}

          {profile.location && (
            <p style={{ fontSize: '13px', color: '#9B9BA8', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 16px' }}>
              <MapPin size={12} /> {profile.location}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {profile.linkedin_url && (
              <SocialLink href={profile.linkedin_url} icon={<Linkedin size={13} />} label="LinkedIn" />
            )}
            {profile.twitter_url && (
              <SocialLink href={profile.twitter_url} icon={<Twitter size={13} />} label="Twitter" />
            )}
            {profile.github_url && (
              <SocialLink href={profile.github_url} icon={<Github size={13} />} label="GitHub" />
            )}
            {profile.website_url && (
              <SocialLink href={profile.website_url} icon={<ExternalLink size={13} />} label="Website" />
            )}
          </div>
        </div>

        {/* Positioning */}
        {model?.positioning && (
          <Section title="My Edge">
            <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#3A3A42' }}>
              {model.positioning}
            </p>
          </Section>
        )}

        {/* Bio */}
        {model?.bio_long && (
          <Section title="About">
            <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#3A3A42' }}>
              {model.bio_long}
            </p>
          </Section>
        )}

        {/* Experience */}
        {workExperiences.length > 0 && (
          <Section title="Experience">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {workExperiences.map((exp, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '15px', color: '#0F0F0F', margin: 0 }}>{exp.title}</p>
                      <p style={{ fontSize: '13px', color: '#5A5A65', margin: '2px 0 0' }}>{exp.company}</p>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9B9BA8', whiteSpace: 'nowrap' }}>
                      {exp.start_date} — {exp.end_date}
                    </p>
                  </div>
                  {exp.highlights?.length > 0 && (
                    <ul style={{ margin: '10px 0 0 16px', padding: 0 }}>
                      {exp.highlights.map((h, j) => (
                        <li key={j} style={{ fontSize: '13px', color: '#3A3A42', lineHeight: '1.6', marginBottom: '4px' }}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <Section title="Projects">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {projects.map((p, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: '12px', padding: '18px',
                  border: '1px solid #E8E8E3', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#0F0F0F', margin: '0 0 6px' }}>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#0F0F0F', textDecoration: 'none' }}>
                        {p.title} ↗
                      </a>
                    ) : p.title}
                  </p>
                  <p style={{ fontSize: '13px', color: '#5A5A65', lineHeight: '1.5', margin: '0 0 10px' }}>
                    {p.description}
                  </p>
                  {p.metrics && (
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#3F6212', background: 'rgba(163,230,53,0.12)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                      {p.metrics}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer CTA */}
        <div style={{ marginTop: '64px', paddingTop: '24px', borderTop: '1px solid #E8E8E3', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9B9BA8' }}>
            Built with <a href="/" style={{ color: '#84CC16', textDecoration: 'none' }}>Jobseek.ai</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#9B9BA8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '12px', fontWeight: 600, color: '#5A5A65',
        textDecoration: 'none', padding: '5px 10px',
        background: '#fff', border: '1px solid #E8E8E3', borderRadius: '6px'
      }}
    >
      {icon} {label}
    </a>
  )
}
