import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, fromName } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY

    // ── Demo / no Resend key: stub success ───────────────────────────────────
    if (!resendKey) {
      // Simulate a brief network delay
      await new Promise(r => setTimeout(r, 800))
      return NextResponse.json({
        success: true,
        demo: true,
        message: `Email queued to ${to} (demo mode — not actually sent)`,
      })
    }

    // ── Real send via Resend ─────────────────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName ?? 'Jobseek.ai'} <outreach@jobseek.ai>`,
        to: [to],
        subject,
        text: body,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
