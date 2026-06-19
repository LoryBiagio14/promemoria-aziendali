import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAY_MAP: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }
const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!

async function sendEmail(to: string, toName: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Promemoria Aziendali', email: 'mozzorecchimarco@gmail.com' },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = await req.json().catch(() => ({}))

  // --- Invio email evento normale ---
  if (body.type === 'event') {
    const { to_email, to_name, titolo, descrizione, data, ora } = body
    try {
      await sendEmail(
        to_email,
        to_name || to_email,
        `Promemoria evento: ${titolo}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;border-bottom:2px solid #d4a843;padding-bottom:12px">${titolo}</h2>
          <p style="color:#555;font-size:16px;margin-top:16px">${descrizione || ''}</p>
          <p style="color:#999;margin-top:24px;font-size:14px">Data: <strong>${data}</strong> — Ora: <strong>${ora || 'N/D'}</strong></p>
          <p style="color:#aaa;margin-top:8px;font-size:12px">Collaboratore: ${to_name}</p>
        </div>
        `
      )
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    } catch(e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
    }
  }

  // --- Invio email contatto ---
  if (body.type === 'contact') {
    const { from_name, from_email, message } = body
    try {
      await sendEmail(
        'mozzorecchimarco@gmail.com',
        'Promemoria Aziendali',
        `Nuovo messaggio da ${from_name}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a">Nuovo messaggio dal form contatti</h2>
          <p><strong>Nome:</strong> ${from_name}</p>
          <p><strong>Email:</strong> ${from_email}</p>
          <p><strong>Messaggio:</strong></p>
          <p style="color:#555">${message}</p>
        </div>
        `
      )
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    } catch(e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
    }
  }

  // --- Check reminder ricorrenti automatico ---
  const now = new Date()
  const italyTime = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now)
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome', weekday: 'short'
  }).format(now)
  const dayNum = DAY_MAP[dayName]

  const { data: reminders, error } = await supabase
    .from('recurring_reminders')
    .select('*')
    .eq('active', true)
    .eq('time', italyTime)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!reminders?.length) return new Response(JSON.stringify({ sent: 0, time: italyTime }), { status: 200 })

  let sent = 0
  for (const r of reminders) {
    const days = (r.days || '0,1,2,3,4,5,6').split(',').map(Number)
    if (!days.includes(dayNum)) continue
    try {
      await sendEmail(
        r.email,
        r.email,
        `Promemoria: ${r.title}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;border-bottom:2px solid #d4a843;padding-bottom:12px">${r.title}</h2>
          <p style="color:#555;font-size:16px;margin-top:16px">${r.message || r.title}</p>
          <p style="color:#999;margin-top:24px;font-size:14px">Orario: <strong>${r.time}</strong></p>
        </div>
        `
      )
      sent++
    } catch(e) { console.error('Errore invio:', r.title, e) }
  }

  return new Response(JSON.stringify({ sent, time: italyTime, day: dayNum }), { status: 200 })
})
