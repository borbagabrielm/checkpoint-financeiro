# Raxo — Contexto do Projeto para Claude Code

## O que é o Raxo

App de controle financeiro pessoal com foco em divisão de despesas entre
amigos. Nome anterior: "Checkpoint Financeiro" (ainda aparece em alguns
lugares no código como legacy, como o nome do pacote e o domínio).

**Repositório:** https://github.com/borbagabrielm/checkpoint-financeiro
**Deploy:** https://www.checkpointfinanceiro.com.br (Vercel)
**Supabase project ref:** fqyeazncsydnhpcssypr

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS
- **Estado/cache:** TanStack Query v5
- **Roteamento:** React Router v6
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Edge Functions)
- **Notificações:** Sonner (toasts) + Web Push (push notifications)
- **Formulários:** React Hook Form + Zod
- **Datas:** date-fns
- **IDs:** nanoid
- **Virtualização:** @tanstack/react-virtual
- **Planilhas:** xlsx (SheetJS)

---

## Estrutura de pastas

```
src/
  app/                        # App.tsx, rotas
  features/
    transactions/             # CRUD de transações
      components/             # TransactionList, TransactionForm, BasicFields
      hooks/                  # useTransactions
      services/               # transactionService.ts
    import/                   # Importação OFX/CSV/XLSX
      components/             # ImportPage, ImportReview
      hooks/                  # useImport
      parsers/                # ofxParser, csvParser, xlsxParser, utils, index
      services/               # aiCategorizationService, importSessionService
      types.ts                # BankId, ImportFormat, Bank, BANKS[]
    analytics/                # Gráficos e relatórios
      components/             # Charts.tsx
    recurring/                # Transações recorrentes
      hooks/                  # useRecurringRunner (lock no Supabase)
    social/                   # Sistema de amizades
      hooks/                  # useFriends
      services/               # socialService
  pages/                      # Dashboard, Analytics, Goals, Social,
                              # FriendProfile, Approvals, Profile,
                              # Settings, SearchPage, ImportPage, InvitePage
  shared/
    components/
      layout/                 # AppShell (sidebar + mobile nav)
      ui/                     # Button, Card, Dialog, AvatarCropModal,
                              # ErrorBoundary, Onboarding, SplashScreen,
                              # NotificationPanel, PushNotificationToggle
    hooks/                    # useAuth, useTheme, usePWA, usePushSubscription,
                              # useAvatarUpload, useNotifications,
                              # useUserPreferences, useOnlineStatus
    lib/                      # supabase.ts, queryKeys.ts, utils.ts
    types/                    # index.ts (Transaction, UserProfile, etc.)
public/
  sw.js                       # Service Worker (push notifications + cache)
  manifest.json               # PWA manifest
  favicon.svg                 # Ícone % do Raxo (fundo azul #3B3BFF)
  icon-192.png                # PWA icon
  icon-512.png                # PWA icon
supabase/
  functions/
    send-push/                # Edge Function de Web Push
      index.ts
```

---

## Identidade Visual Raxo

### Paleta de cores — REGRAS ESTRITAS

| Cor | Hex | Uso |
|---|---|---|
| Lime | `#AAFF47` | Fill/background, botões primários, destaque. NUNCA como texto em fundo claro |
| Azul elétrico | `#3B3BFF` | Cor primária, texto em fundo claro, headers de cards sociais |
| Verde income | `#22A800` | Texto de receita em light mode |
| Vermelho danger | `#FF4747` | Erros, despesas |

**CSS variables:**
- `--income`: `100 100% 20%` (light) / `88 100% 64%` (dark)
- `--income-fill`: sempre `88 100% 64%` — só como background
- `--logo-accent`: `236 100% 61%` (light) / `88 100% 64%` (dark)
- `--primary`: azul elétrico (`#3B3BFF`)
- `--expense`: vermelho danger

### Logo SVG

O ícone % do Raxo é usado em empty states, ErrorBoundary, Onboarding,
SplashScreen e como textura de fundo em headers. Sempre usar este SVG:

```tsx
<svg viewBox="492 221 90 88" width={SIZE} height={SIZE} xmlns="http://www.w3.org/2000/svg">
  <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12"
    fill="hsl(var(--logo-accent))"/>
  <circle cx="515.62" cy="244.36" r="14.47" fill="hsl(var(--logo-accent))"/>
  <circle cx="568.01" cy="293.67" r="14.47" fill="hsl(var(--logo-accent))"/>
</svg>
```

Watermark de fundo (header azul): mesmo SVG com `opacity-[0.08]` e fill `#fff`.

### Botões de ação primária

```tsx
className="bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold"
```

### Saldo no Dashboard

Positivo: `text-[#3B3BFF]` (nunca `text-primary` — pode ser sobrescrito)
Negativo: `text-[hsl(var(--expense))]`

---

## Banco de dados Supabase

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `user_profiles` | Perfil público (display_name, username, avatar_url, bio) |
| `user_preferences` | Categorias, métodos de pagamento, currency, income_categories |
| `transactions` | Transações financeiras com RLS por user_id |
| `shared_transactions` | Divisão de despesas entre amigos (status: pending_approval / approved / rejected) |
| `friendships` | Amizades (status: pending / accepted) |
| `financial_goals` | Metas financeiras |
| `budgets` | Orçamentos por categoria |
| `recurring_transactions` | Recorrentes com campo last_created_at para lock anti-duplicata |
| `import_sessions` | Histórico de importações |
| `push_subscriptions` | Web Push subscriptions por dispositivo |

### RLS
Todas as tabelas têm RLS habilitado. Sempre usar `auth.uid()` nas policies.

### Coluna importante
`user_preferences.income_categories text[]` — separação entre categorias
de despesa (`categories`) e receita (`income_categories`).

---

## Web Push Notifications

**Chaves VAPID:**
- Public: `BF6HO69mtOvu92Mmk97JGn3dhPjVej2UwSH0D7z9aNa2HuP62ZQCyC0mk6jF4VeK9_aBViZ4EcfoovzIt0c7FLo`
- Private: nos secrets da Edge Function do Supabase (nunca commitar)
- Subject: `mailto:borbagabrielm@gmail.com`

**Variável de ambiente obrigatória no Vite:**
```
VITE_VAPID_PUBLIC_KEY=BF6HO69mtOvu92Mmk97JGn3dhPjVej2UwSH0D7z9aNa2HuP62ZQCyC0mk6jF4VeK9_aBViZ4EcfoovzIt0c7FLo
```

**Fluxo automático:**
INSERT em `shared_transactions` → trigger `trg_notify_shared_expense_push`
→ `net.http_post` → Edge Function `send-push` → Apple/Google Push → dispositivo

**Limitação iOS:** só funciona com PWA instalado na tela inicial (Add to
Home Screen), iOS 16.4+. Cada dispositivo/navegador tem subscription
própria — um user_id pode ter múltiplas linhas em `push_subscriptions`.

**Bug comum:** `VapidPkHashMismatch` = subscription criada com chave
pública diferente da atual. Fix: chamar `sub.unsubscribe()` no navegador
+ `DELETE FROM push_subscriptions WHERE endpoint = '...'` + reativar toggle.

---

## Importação de extratos

### Bancos e formatos suportados

| Banco | OFX | CSV | XLSX |
|---|---|---|---|
| Nubank | ✅ | ✅ | ❌ |
| Itaú | ✅ | ❌ | ✅ |
| Bradesco | ✅ | ✅ | ❌ |
| Santander | ✅ | ❌ | ❌ |
| Inter | ✅ | ✅ | ❌ |

### Formato XLSX do Itaú (novo formato oficial)

- 14 linhas de cabeçalho para pular
- Col 1: Data (objeto Date do JS via SheetJS raw:true)
- Col 2: Lançamento (descrição)
- Col 3: Parcelamento ("Parcela 2 de 10")
- Col 4: Valor (sempre positivo — negativos são estornos, ignorar)
- Pular parcelas com current > 1 (importa só a 1ª e cria as demais)

### Guard anti-duplicata na importação

Antes de cada insert, verifica se já existe transação com mesmo
`user_id + description + date + amount` no banco. Duplicatas são
contadas separadamente no feedback final.

---

## Transações Recorrentes

O `useRecurringRunner` usa `last_created_at` no Supabase como lock
otimista — atualiza o campo ANTES de inserir para evitar race condition
com múltiplas abas abertas. Se o insert falhar, reverte o lock.

---

## Padrões de código

### QueryKeys
Sempre usar `queryKeys.*` de `@/shared/lib/queryKeys` para invalidação
consistente do cache. Não hardcodar strings de query key.

### Formatação de moeda
Sempre usar `formatCurrency()` de `@/shared/lib/utils`. Nunca usar
`toFixed(2)` direto para exibição.

### Categorias
- `preferences.categories` → categorias de DESPESA
- `preferences.income_categories` → categorias de RECEITA
- Nunca misturar nos selects do formulário (BasicFields já separa por tipo)

### Cores de transação
- Receita: `amount-income` (classe CSS, usa `--income`)
- Despesa: `amount-expense` (classe CSS, usa `--expense`)
- Nunca usar `text-green-*` ou `text-red-*` hardcoded

### Empty states
Sempre usar o ícone % do Raxo com `opacity-[0.12]` e `fill="hsl(var(--logo-accent))"`.
Não usar ícones genéricos do Lucide como placeholder de empty state.

### Erros no ErrorBoundary
`ErrorBoundary` usa o ícone % em vermelho (`fill="hsl(var(--expense))"`).
Não usar ícone `Compass` (nome antigo do app).

---

## Funcionalidades pendentes (backlog)

- Comparação de período no Analytics (vs mês anterior)
- Metas conectadas a categorias automaticamente
- Exportar transações (CSV/PDF)
- QR code no convite de amizade
- Divisão em grupo (mais de 2 pessoas)
- Ranking de amigos
- Heatmap de gastos por dia
- Dashboard com widgets reordenáveis
- Templates de transação recorrente
- Atalho de teclado para nova transação (tecla "N")
- Duplicar transação existente
- Filtros salvos no TransactionList
- Backup automático via pg_cron
- Testes automatizados (import, split, recorrentes)
- Modo offline com fila de sincronização
- Reenviar convite de amizade expirado

---

## Histórico de bugs conhecidos e soluções

### Duplicação de transações na importação
Causa: duplo-insert por race condition ou importação repetida.
Solução SQL (critério seguro — janela de 10 segundos):
```sql
DELETE FROM transactions WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, description, date, amount
      ORDER BY created_at ASC
    ) AS rn
    FROM transactions WHERE id IN (
      SELECT id FROM transactions t1 WHERE EXISTS (
        SELECT 1 FROM transactions t2
        WHERE t2.user_id = t1.user_id AND t2.description = t1.description
          AND t2.date = t1.date AND t2.amount = t1.amount
          AND t2.id <> t1.id
          AND ABS(EXTRACT(EPOCH FROM (t2.created_at - t1.created_at))) < 10
      )
    )
  ) ranked WHERE rn > 1
);
```

### Avatar deformado no upload
Causa: upload direto sem passar pelo AvatarCropModal.
Solução: `handleFileSelected` → `AvatarCropModal` → `handleCropConfirm(blob)`.
O `useAvatarUpload` aceita `File | Blob` — quando vem do crop, já é JPEG 400×400.

### Categorias de receita aparecendo em despesas
Causa: `preferences.categories` misturava os dois tipos.
Solução: `BasicFields` filtra `DEFAULT_INCOME_CATEGORIES` das categorias
de despesa quando `type === 'expense'`.

### Saldo não aparece em azul no Dashboard
Causa: `text-primary` pode ser sobrescrito por herança CSS.
Solução: usar `text-[#3B3BFF]` diretamente.
