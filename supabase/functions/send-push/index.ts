// Supabase Edge Function — send-push
// Caminho no projeto: supabase/functions/send-push/index.ts
//
// Recebe um evento (disparado pelo trigger SQL ou chamado manualmente),
// busca a(s) push_subscription(s) do(s) destinatário(s) e envia a
// notificação usando o protocolo Web Push assinado com VAPID.
//
// Aceita tanto um único destinatário (recipientUserId) quanto uma lista
// (recipientUserIds) — útil para avisar todo um grupo de divisão de
// despesa de uma vez, ou um broadcast geral.
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
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@raxo.app'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey)

interface PushPayload {
  type: 'shared_expense' | 'friend_request' | 'budget_alert' | 'generic'
  // Use UM dos dois abaixo:
  recipientUserId?: string       // destinatário único (compatibilidade com o trigger existente)
  recipientUserIds?: string[]    // lista de destinatários — envia pra todos de uma vez
  sharedTransactionId?: string
  friendshipId?: string
  title?: string
  body?: string
  url?: string
}

Deno.serve(async (req) => {
  try {
    const payload: PushPayload = await req.json()

    // Modo debug — chame com { "debug": true } para confirmar
    // qual VAPID_PUBLIC_KEY está realmente configurada no secret,
    // sem expor a chave inteira (só os 20 primeiros caracteres,
    // suficiente para comparar com o valor esperado)
    if ((payload as any).debug === true) {
      return new Response(
        JSON.stringify({
          vapidPublicKeyPrefix: vapidPublicKey?.slice(0, 20) ?? 'AUSENTE',
          vapidPublicKeyLength: vapidPublicKey?.length ?? 0,
          vapidSubject: vapidSubject,
          vapidPrivateKeyLength: vapidPrivateKey?.length ?? 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Normaliza para uma lista única, aceitando os dois formatos de entrada
    const recipientIds = payload.recipientUserIds?.length
      ? payload.recipientUserIds
      : payload.recipientUserId
        ? [payload.recipientUserId]
        : []

    if (!recipientIds.length) {
      return new Response(
        JSON.stringify({ error: 'Informe recipientUserId ou recipientUserIds' }),
        { status: 400 }
      )
    }

    // Monta título/corpo conforme o tipo de evento (igual para todos os destinatários
    // no caso de shared_expense/friend_request/budget_alert — o conteúdo não varia
    // por pessoa, exceto se você quiser personalizar por destinatário no futuro)
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

    // Busca todas as subscriptions de TODOS os destinatários de uma vez
    // (cada pessoa pode ter mais de um dispositivo/navegador subscrito)
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', recipientIds)

    if (error) throw error
    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, recipients: recipientIds.length, reason: 'Nenhuma subscription encontrada' }),
        { status: 200 }
      )
    }

    const notificationPayload = JSON.stringify({ title, body, url, tag })

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        )
      )
    )

    // Loga o erro detalhado de cada falha — essencial para diagnosticar
    // problemas específicos de cada provedor (Apple, Google, Mozilla)
    const errors: { endpoint: string; statusCode?: number; message: string; body?: string }[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const reason = r.reason as any
        console.error('[send-push] falha ao enviar:', {
          endpoint: subscriptions[i].endpoint,
          statusCode: reason?.statusCode,
          message: reason?.message,
          body: reason?.body,
        })
        errors.push({
          endpoint: subscriptions[i].endpoint,
          statusCode: reason?.statusCode,
          message: reason?.message ?? String(reason),
          body: reason?.body,
        })
      }
    })

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
    // Quantos destinatários únicos foram efetivamente alcançados (não contando
    // múltiplos dispositivos da mesma pessoa como "destinatários" separados)
    const reachedUserIds = new Set(
      subscriptions.filter((_, i) => results[i].status === 'fulfilled').map((s) => s.user_id)
    )

    return new Response(
      JSON.stringify({
        sent: sentCount,
        totalSubscriptions: subscriptions.length,
        recipientsRequested: recipientIds.length,
        recipientsReached: reachedUserIds.size,
        errors: errors.length ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-push] erro:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})