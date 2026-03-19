export const metadata = {
  title: 'Privacy Policy — Jobseek.ai',
  description: 'Privacy policy for Jobseek.ai and the Jobseek Signal Intelligence Chrome extension.',
}

export default function PrivacyPage() {
  return (
    <main style={{ background: '#F7F7F5', minHeight: '100vh', padding: '64px 24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <a href="/" style={{ fontSize: '13px', color: '#84CC16', textDecoration: 'none', fontWeight: 600 }}>
            ← Jobseek.ai
          </a>
          <h1 style={{ marginTop: '24px', fontSize: '28px', fontWeight: 800, color: '#0F0F0F', letterSpacing: '-0.5px' }}>
            Privacy Policy
          </h1>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#5A5A65' }}>
            Last updated: March 2026
          </p>
        </div>

        <div style={{ fontSize: '15px', lineHeight: '1.7', color: '#3A3A42' }}>

          <Section title="Overview">
            Jobseek.ai (&ldquo;Jobseek&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides an AI-powered career outreach platform and a companion Chrome extension (&ldquo;Jobseek Signal Intelligence&rdquo;). This policy explains what data we collect, how we use it, and your rights.
          </Section>

          <Section title="What data we collect">
            <SubHeading>Web application (jobseek.ai)</SubHeading>
            <ul>
              <li>Email address — for authentication via magic link (Supabase Auth)</li>
              <li>Profile information you enter: name, target roles, industries, seniority level</li>
              <li>Outreach drafts you generate or save</li>
              <li>Company and people records added to your pipeline</li>
              <li>Search queries you run within the platform</li>
            </ul>

            <SubHeading>Chrome extension</SubHeading>
            <ul>
              <li>LinkedIn post text — read locally from your browser&apos;s DOM when you are browsing your LinkedIn feed. This data is sent to our API solely for signal classification.</li>
              <li>Post metadata — author name, post timestamp, engagement counts. Never your private LinkedIn messages or profile credentials.</li>
              <li>A locally-generated anonymous device token — stored in <code>chrome.storage.local</code> on your device to link extension signals to your Jobseek account. Never transmitted to third parties.</li>
            </ul>

            <SubHeading>What we do NOT collect</SubHeading>
            <ul>
              <li>LinkedIn login credentials or cookies</li>
              <li>Private messages or connection lists</li>
              <li>Browsing history outside of linkedin.com/feed</li>
              <li>Any data from sites other than LinkedIn</li>
            </ul>
          </Section>

          <Section title="How we use your data">
            <ul>
              <li><strong>Signal classification</strong> — LinkedIn post text is sent to our backend API and processed by Google Gemini Flash to identify hiring signals. Raw post text is not stored permanently; only the classified signal output is saved.</li>
              <li><strong>Outreach generation</strong> — your profile preferences (roles, industries, seniority) are used as context to generate personalised outreach drafts via Gemini Flash.</li>
              <li><strong>Company enrichment</strong> — company names discovered through signals are looked up via Exa (semantic search) and Apollo (people discovery) to surface relevant contacts.</li>
              <li><strong>Email delivery</strong> — if you send outreach through Jobseek, email is sent via Resend. We store sent email records linked to your account.</li>
            </ul>
          </Section>

          <Section title="Third-party services">
            <p>Jobseek uses the following third-party processors:</p>
            <ul>
              <li><strong>Supabase</strong> — authentication and database (EU/US data centres)</li>
              <li><strong>Google Gemini</strong> — AI classification and generation</li>
              <li><strong>Exa</strong> — company and web search</li>
              <li><strong>Apollo.io</strong> — professional contact discovery</li>
              <li><strong>Hunter.io</strong> — email finding</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Vercel</strong> — hosting and edge functions</li>
            </ul>
            <p>We do not sell your data to any third party. We do not use your data for advertising.</p>
          </Section>

          <Section title="Data retention">
            <ul>
              <li>Account data is retained while your account is active.</li>
              <li>Raw LinkedIn post text processed for classification is discarded after classification completes and is not stored in our database.</li>
              <li>You may request deletion of all account data at any time by emailing us.</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and all associated data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:privacy@jobseek.ai" style={{ color: '#84CC16' }}>privacy@jobseek.ai</a>.</p>
          </Section>

          <Section title="Chrome extension — permission justifications">
            <ul>
              <li><strong>activeTab / scripting</strong> — required to read LinkedIn feed post text from the active browser tab for signal detection.</li>
              <li><strong>storage</strong> — stores processed post IDs locally to prevent duplicate classification, and stores your anonymous device token.</li>
              <li><strong>alarms</strong> — schedules periodic batching of captured posts for efficient API use.</li>
              <li><strong>tabs</strong> — reads the active tab URL to scope content script execution to LinkedIn only.</li>
              <li><strong>host_permissions: linkedin.com</strong> — required to inject the content script and read feed DOM on LinkedIn pages.</li>
            </ul>
          </Section>

          <Section title="Security">
            All data in transit is encrypted via TLS. Database access is protected by Supabase Row-Level Security (RLS) policies — users can only access their own data. API routes are authenticated via Supabase JWT tokens.
          </Section>

          <Section title="Children">
            Jobseek is not directed at children under 16. We do not knowingly collect data from anyone under 16.
          </Section>

          <Section title="Changes to this policy">
            We may update this policy periodically. We will notify active users of material changes via email. Continued use after changes constitutes acceptance.
          </Section>

          <Section title="Contact">
            <p>
              Jobseek.ai<br />
              Email: <a href="mailto:privacy@jobseek.ai" style={{ color: '#84CC16' }}>privacy@jobseek.ai</a>
            </p>
          </Section>
        </div>

      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0F0F0F', marginBottom: '12px', marginTop: 0 }}>
        {title}
      </h2>
      <div style={{ color: '#3A3A42' }}>{children}</div>
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F0F0F', marginTop: '16px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </p>
  )
}

