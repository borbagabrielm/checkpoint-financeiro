// Supabase Edge Function — send-push
// Caminho no projeto: supabase/functions/send-push/index.ts
//
// Recebe um evento (disparado pelo trigger SQL ou chamado manualmente),
// busca a(s) push_subscription(s) do destinatário e envia a notificação
// usando o protocolo Web Push assinado com VAPID.
//
// Deploy: supabase functions deploy send-push
// Secrets necessários (supabase secrets set NOME=valor):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (já existem por padrão)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:borbagabrielm@gmail.com'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey)

interface PushPayload {
  type: 'shared_expense' | 'friend_request' | 'budget_alert' | 'generic'
  recipientUserId: string
  sharedTransactionId?: string
  friendshipId?: string
  title?: string
  body?: string
  url?: string
}

Deno.serve(async (req) => {
  try {
    const payload: PushPayload = await req.json()
    const { recipientUserId } = payload

    if (!recipientUserId) {
      return new Response(JSON.stringify({ error: 'recipientUserId obrigatório' }), { status: 400 })
    }

    // Monta título/corpo conforme o tipo de evento
    let title = payload.title ?? 'Raxo'
    let body = payload.body ?? ''
    let url = payload.url ?? '/'
    let tag: string | undefined

    if (payload.type === 'shared_expense' && payload.sharedTransactionId) {
      const { data: shared } = await supabase
        .from('shared_transactions')
        .select('split_amount, transaction:transactions(description, amount), sender:transactions(user_id)')
        .eq('id', payload.sharedTransactionId)
        .maybeSingle()

      if (shared) {
        const tx = (shared as any).transaction
        const senderId = (shared as any).sender?.user_id
        let senderName = 'Alguém'
        if (senderId) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name, username')
            .eq('user_id', senderId)
            .maybeSingle()
          senderName = profile?.display_name ?? profile?.username ?? 'Alguém'
        }
        title = `${senderName} dividiu uma despesa`
        body = `${tx?.description ?? 'Despesa'} · sua parte: R$ ${Number(shared.split_amount).toFixed(2)}`
        url = '/approvals'
        tag = 'shared-expense'
      }
    } else if (payload.type === 'friend_request') {
      title = 'Nova solicitação de amizade'
      body = 'Alguém quer se conectar com você no Raxo'
      url = '/social'
      tag = 'friend-request'
    } else if (payload.type === 'budget_alert') {
      title = 'Alerta de orçamento'
      body = payload.body ?? 'Você está perto do limite em uma categoria'
      url = '/settings'
      tag = 'budget-alert'
    }

    // Busca todas as subscriptions do destinatário (pode ter vários dispositivos)
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientUserId)

    if (error) throw error
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'Nenhuma subscription encontrada' }), { status: 200 })
    }

    const notificationPayload = JSON.stringify({ title, body, url, tag })

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        )
      )
    )

    // Remove subscriptions inválidas (410 Gone / 404) — dispositivo desinstalou ou expirou
    const toRemove: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = (r.reason as any)?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          toRemove.push(subscriptions[i].endpoint)
        }
      }
    })
    if (toRemove.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', toRemove)
    }

    const sentCount = results.filter((r) => r.status === 'fulfilled').length

    return new Response(JSON.stringify({ sent: sentCount, total: subscriptions.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-push] erro:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})