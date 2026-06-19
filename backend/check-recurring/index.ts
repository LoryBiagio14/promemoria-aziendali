import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAY_MAP: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()

  const italyTime = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now)

  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short'
  }).format(now)

  const dayNum = DAY_MAP[dayName]

  const { data: reminders, error } = await supabase
    .from('recurring_reminders')
    .select('*')
    .eq('active', true)
    .eq('time', italyTime)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!reminders?.length) return new Response(JSON.stringify({ sent: 0, time: italyTime }), { status: 200 })

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
  let sent = 0

  for (const r of reminders) {
    const days = (r.days || '0,1,2,3,4,5,6').split(',').map(Number)
    if (!days.includes(dayNum)) continue

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Promemoria Aziendali <onboarding@resend.dev>',
        to: r.email,
        subject: `Promemoria: ${r.title}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
            <h2 style="color:#1a1a1a;border-bottom:2px solid #d4a843;padding-bottom:12px">${r.title}</h2>
            <p style="color:#555;font-size:16px;margin-top:16px">${r.message || r.title}</p>
            <p style="color:#999;margin-top:24px;font-size:14px">Orario: <strong>${r.time}</strong></p>
          </div>
        `
      })
    })

    if (res.ok) sent++
    else {
      const err = await res.text()
      console.error('Resend error:', err)
    }
  }

  return new Response(JSON.stringify({ sent, time: italyTime, day: dayNum }), { status: 200 })
})
