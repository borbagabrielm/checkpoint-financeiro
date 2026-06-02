# Pocket Compass Finance v2

Controle financeiro pessoal com divisão de gastos e funcionalidades sociais.

## Stack

- **React 18** + TypeScript + Vite
- **TanStack Query v5** — cache e sincronismo de dados
- **React Hook Form + Zod** — formulários tipados e validados
- **Zustand** — estado global leve (tema)
- **shadcn/ui** (Radix UI) — componentes acessíveis
- **Tailwind CSS** — estilização
- **Recharts** — gráficos
- **Supabase** — auth, banco PostgreSQL, RLS, realtime

## Estrutura de pastas

```
src/
├── app/            # App.tsx com providers e router
├── pages/          # Páginas (só roteamento, sem lógica)
├── features/
│   ├── transactions/     # Form, List, hooks, service
│   ├── analytics/        # Charts, hooks, service
│   ├── social/           # Friends, hooks, service
│   └── shared-expenses/  # Approvals, hooks, service
└── shared/
    ├── components/
    │   ├── ui/           # Primitivos (Button, Input, Card...)
    │   └── layout/       # AppShell (sidebar + nav mobile)
    ├── hooks/            # useAuth, useTheme, useIsMobile
    ├── lib/              # supabase.ts, utils.ts, queryKeys.ts
    └── types/            # Tipos globais
```

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores do seu projeto Supabase.

### 3. Configurar banco de dados

Execute o arquivo `supabase-migration.sql` no SQL Editor do seu projeto Supabase.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

## Melhorias em relação à v1

| Área | v1 | v2 |
|------|----|----|
| Estado | useState + useEffect manual | TanStack Query (cache, otimistic updates) |
| Formulários | Estado manual com 200+ linhas | React Hook Form + Zod |
| Estrutura | Flat (api/, services/, utils/ misturados) | Feature-based modules |
| Debug logs | Dezenas de `console.log` em produção | Removidos |
| Layout | Dashboard + MobileDashboard duplicados | Um layout responsivo (AppShell) |
| Tema | next-themes + contexto manual | Zustand persist |
| Banco | Tabelas `profiles` e `user_profiles` duplicadas | `user_profiles` unificado |
| Novas features | — | Metas financeiras, exportação CSV (planejado) |

## Funcionalidades

- ✅ Cadastro / login (email + Google OAuth)
- ✅ CRUD de transações com parcelamento
- ✅ Filtro por mês e categoria
- ✅ Dashboard com stats e gráficos
- ✅ Analytics com evolução mensal e breakdown de categorias
- ✅ Sistema de amizades (busca, solicitação, aceite/recusa)
- ✅ Despesas compartilhadas com divisão por valor ou percentual
- ✅ Fluxo de aprovação (pending → approved/rejected)
- ✅ Notificações de aprovações pendentes
- ✅ Dark mode
- ✅ Layout responsivo (desktop sidebar + mobile bottom nav)
