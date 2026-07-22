import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/bootstrap-admin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { token, email, password } = await request.json()
        if (token !== 'kl2j-bootstrap-2026') {
          return new Response('Forbidden', { status: 403 })
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // Try to find existing user
        let userId: string | null = null
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
        if (existing) {
          userId = existing.id
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          })
        } else {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          })
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
          userId = data.user!.id
        }

        const { error: rErr } = await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id: userId!, role: 'super_admin' }, { onConflict: 'user_id,role' })
        if (rErr) return new Response(JSON.stringify({ error: rErr.message }), { status: 500 })

        return new Response(JSON.stringify({ ok: true, userId }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
