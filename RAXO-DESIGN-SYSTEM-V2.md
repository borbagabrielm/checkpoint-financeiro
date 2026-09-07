# Raxo — Design System
### "Raxo Core + Raxo Aurora" · Consolidado em Setembro 2026

> Este documento reconcilia dois documentos anteriores — o "Design System v1.0" (paleta única,
> Set/2026) e o "Design System v2 — Core + Aurora" (Ago/2026) — numa única fonte de verdade,
> com as decisões de produto já resolvidas. Substitui os dois anteriores. Mantém a seção "estado
> real da implementação" do v2, que continua precisa.

---

## 0. O que mudou nesta reconciliação

Os dois documentos anteriores tinham pontos conflitantes. Decisões tomadas:

| Ponto | Decisão |
|---|---|
| v1.0 substitui Aurora, ou convive com ela? | **Convivem.** v1.0 formaliza a paleta/regras do **Core** (produto, dia a dia). Aurora continua existindo como camada separada (onboarding, empty states) — nada do que já foi implementado foi desfeito. |
| Cor de receita: verde ou lime? | **Continua verde** (`#22A800`). Lime puro como texto em fundo claro mede **~1,1:1 de contraste** (ilegível) — uma variante escura o suficiente pra ser legível (~6:1) já não lê como "lime", lê como verde-oliva. Não vale trocar uma cor legível por uma inventada que reproduz o mesmo problema que tentava resolver. |
| Core é "dark nativo" (afirmação do v2)? | **Não.** O produto é **light-first** — todas as telas (Dashboard, Analytics, Planejamento, Configurações etc.) usam fundo claro por padrão, com dark mode via toggle. Trata-se como uma imprecisão do v2 que nunca foi implementada, não como uma mudança a fazer agora. |

---

## 1. Dois modos, uma identidade

| | **Raxo Core** | **Raxo Aurora** |
|---|---|---|
| **Onde vive** | Dashboard, Transações, Analytics, Planejamento, Recorrentes, Aprovações, Configurações — o produto do dia a dia | Onboarding, empty states, (futuro: site institucional, e-mails) |
| **Base** | **Light-first** (`Off-white #F5F5F0`), dark mode disponível via toggle | Light nativo (`Off-white #F5F5F0` / branco) — sem toggle, sempre claro |
| **Personalidade** | Direta, funcional, densidade de dados | Convidativa, primeira impressão, baixa densidade |
| **Forma de destaque** | Cards com acento de cor no topo, badges semânticos | Cards claros com sombra suave, blocos Ink sólidos, acento lime único |

**Regra de decisão:** se a pessoa está *usando* o Raxo no dia a dia → Core. Se está *conhecendo,
entrando ou sendo recebida* → Aurora. Logo, símbolo `%`, paleta semântica e voz são **idênticos**
nos dois modos — só a expressão visual muda.

---

## 2. Cor

### 2.1 Núcleo da marca

| Token | Hex | Uso |
|---|---|---|
| `blue` (Electric Blue) | `#3B3BFF` | Primária · ações, links, foco, saldo positivo |
| `lime` (Lime) | `#AAFF47` | Fill/background · botões primários, badges, progresso, destaque. **Nunca como texto em fundo claro** (contraste ~1,1:1 — ver §2.4) |
| `green` (Income) | `#22A800` | Texto de receita/valores positivos em light mode |
| `red` (Danger) | `#FF4747` | Erros, despesas, dívidas, saldo negativo |
| `ink` (Ink) | `#0A0A0A` | Texto principal, blocos sólidos de destaque, dark surfaces |
| `off-white` | `#F5F5F0` | Fundo padrão (light mode, Core e Aurora) |
| `white` | `#FFFFFF` | Cards, texto em fundos escuros |
| `surface` | `#111111` | Cards em dark mode |

### 2.2 Tokens semânticos (tints)

| Token | Hex | Uso |
|---|---|---|
| `blue-tint` | `#EDEDFF` | Fundo de cards informativos |
| `lime-tint` | `#F3FFDE` | Fundo de estado "pago/sucesso" |
| `red-tint` | `#FFECEC` | Fundo de estado "atrasado/erro" |
| `ink-700` | `#33332F` | Texto secundário |
| `ink-500` | `#6B6B66` | Texto de apoio |
| `ink-400` | `#9C9C96` | Texto desabilitado, placeholders |
| `border` | `#E4E4DD` | Bordas e divisores |

`lime-ink` (usado em badges sobre fundo lime, ex. "Pago") = `ink` (`#0A0A0A`) — mesmo token, nome
de uso diferente. Não é uma cor nova.

### 2.3 Regra Aurora: hierarquia por *quantidade*, não por *nova cor*
Vale só dentro de telas Aurora (onboarding, empty states):
- **Base:** Off-white/branco (85–90% da superfície)
- **Contraste:** Ink em blocos sólidos (não cinza-médio)
- **Acento único:** Lime carrega quase toda a função interativa
- **Blue e Red** aparecem com raridade — reservados ao gradiente de onda e erros pontuais

### 2.4 Contraste mínimo (WCAG) — validado nesta reconciliação

| Combinação | Contraste | Uso permitido |
|---|---|---|
| Ink sobre Off-white | ~18:1 | Texto de corpo, títulos |
| White sobre Electric Blue | ~6,4:1 | Texto de botão, badges |
| Ink sobre Lime | ~16:1 | Texto/ícone sobre fundo lime (`lime-ink`) |
| White sobre Danger Red | ~3,4:1 | **Apenas** texto grande (18px+) ou ícone — reconfirmar com ferramenta antes de usar em texto pequeno |
| **Lime sobre Off-white/branco** | **~1,1–1,2:1** | **Proibido como texto.** Só como fill/background |
| Green (`#22A800`) sobre Off-white | ~5,1:1 | Texto de receita — ok pra corpo de texto |

### 2.5 Gradiente de onda (Wave Gradient) — só Aurora/decorativo
```css
--gradient-wave: linear-gradient(90deg, #AAFF47 0%, #6FE0A8 35%, #4FB8D9 65%, #3B3BFF 100%);
```
Uso: elementos decorativos/hero (onda orgânica, blobs), **nunca em gráficos de dado real** — um
gráfico de saldo/receita precisa de codificação de cor por significado (positivo/negativo), não
um degradê estético; usar gradiente aqui violaria a própria régua de dataviz do produto.

### 2.6 Texturas de superfície
| Textura | Uso | Token |
|---|---|---|
| Hachura diagonal | Estado vazio de progress bars, cantos decorativos | `--hatch` / `.hatch-texture` |
| Dot-grid | Fundo de cards escuros, profundidade sem sombra | `--dot-grid` / `.dot-grid-texture` |
| Onda orgânica | Hero de marketing (futuro) | `--gradient-wave` / `.bg-gradient-wave` |

---

## 3. Tipografia

| Papel | Fonte | Peso | Uso |
|---|---|---|---|
| Display/Headlines Aurora | Plus Jakarta Sans | 700/800 | Headlines em onboarding, empty states — **exclusiva de Aurora, nunca entra no Core** |
| UI/Corpo (Core + Aurora) | Inter | 900/700/500/400 | Toda a interface de produto, corpo de texto em ambos os modos |

Escala de tamanho (aplica-se a ambos os modos, salvo Aurora Hero/Stat que são maiores):

| Estilo | Tamanho | Peso | Uso |
|---|---|---|---|
| Display | 48px | 900 | Números grandes de saldo, headlines de tela vazia |
| Aurora Hero | 56–72px | 800 (Plus Jakarta) | Headline de marketing/onboarding |
| H1 | 32px | 800 | Título de tela |
| H2 | 24px | 700 | Subtítulo de seção |
| H3 | 18px | 700 | Título de card/lista |
| Body L | 16px | 400 | Corpo de texto principal |
| Body | 14px | 400 | Corpo de texto secundário, listas |
| Small | 12px | 500 | Metadados, timestamps |

Regra: 900/800 (Black/ExtraBold) só em display e H1 — nunca em parágrafos. Line-height 1.5–1.6 no
corpo.

---

## 4. Grid, espaçamento e raio

Base **4px** pra todo espaçamento (padding, gap, margin): `4·8·12·16·24·32·48·64`.

### Raio — reconciliação com o que já existe no código
O código usa uma var única (`--radius: 12px` em `src/index.css`) com `lg=var(--radius)`,
`md=var(--radius)-2px`, `sm=var(--radius)-4px` — ou seja, hoje só 3 níveis próximos (8/10/12px),
sem um nível pra tiles pequenos nem pra cards grandes. Formalizando pra resolver a ambiguidade do
v1.0 (que listava "Inputs" em dois níveis diferentes):

| Token | Valor | Uso | Mapeado hoje em |
|---|---|---|---|
| `radius-xs` | 6px | Tiles/chips pequenos | — (novo, sem equivalente ainda) |
| `radius-sm` | 8px (`--radius` - 4px) | — | classe Tailwind `rounded-sm` |
| `radius-md` | 10px (`--radius` - 2px) | **Inputs** | classe Tailwind `rounded-md` |
| `radius-lg` | 12px (`--radius`) | Cards padrão | classe Tailwind `rounded-lg` |
| `radius-card-aurora` | 20–24px | Cards Aurora (mais arredondados que Core) | `.aurora-card-light`/`.aurora-card-dark` |
| `radius-pill` | 999px | Botões, tags, badges, abas | `rounded-full` |

Regra prática: quanto maior o componente, maior o raio. Inputs = `radius-md`. Cards Core =
`radius-lg`. Cards Aurora = mais arredondados (`radius-card-aurora`), reforçando a diferença de
personalidade entre os dois modos. Botões/tags = sempre pill.

---

## 5. Iconografia

Lucide Icons. Stroke 1.75px padrão (1.5px em ≥32px), nunca preenchido. Cor herda `currentColor` —
nunca colorir ícone isolado sem função semântica. Lime = confirmação/sucesso · Vermelho =
erro/atraso · Azul = ação neutra.

---

## 6. Linguagem de forma (herdada do v2 Aurora, válida nos dois modos onde fizer sentido)

- **Pill-first:** botões, badges, abas, progress bars — já é o padrão em botões no Core; Aurora
  estende a badges/tabs/progress bars também
- **Progress bar com hachura:** preenchido = cor sólida; restante = hachura diagonal (não cinza
  chapado) — hoje só em Aurora (`.aurora-progress-track`), candidato a entrar em barras de
  orçamento do Core (`Settings.tsx`, aba Orçamentos)
- **Diamante (◆):** acento geométrico secundário — handle de nível/progresso, token pronto
  (`.aurora-diamond`), ainda sem tela consumidora
- **Botão com ícone circular trailing:** círculo Ink com ícone Lime (ou o inverso) colado à
  direita do texto — hoje só em Aurora (Onboarding), candidato a virar `variant="aurora"` no
  `Button` do Core pra ações de destaque

---

## 7. Componentes

### Botões (Core)
| Variante | Estilo | Uso |
|---|---|---|
| Primary | Pill, fundo lime, texto ink | Ação principal — uma por tela |
| Secondary | Pill, fundo blue, texto white | Ação de apoio |
| Ghost | Pill, borda, sem fundo | Ações terciárias, cancelar |
| Danger | Pill, fundo red-tint, texto red | Ações destrutivas, sempre com confirmação |

### Tags & badges
Pill pequeno, padding `6px 12px`, 12px/600.

| Estado | Fundo | Texto |
|---|---|---|
| Pago/sucesso | `lime-tint` | `ink` (= `lime-ink`) |
| Pendente/info | `blue-tint` | `blue` (tom escuro) |
| Atrasado/erro | `red-tint` | `red` |
| Neutro | `ink` | `white` |

### Cards nomeados (referência de nomenclatura, adaptar aos componentes reais do produto)
`card_balance` (saldo/delta) · `card_invite` (convite, dark+CTA) · `card_level`/`card_quotas`
(progresso) · `card_categories` (donut) · `card_trend` (tendência) · `card_group` (avatares).

---

## 8. Aplicação — Aurora (estado real da implementação)

*(Mantido do documento v2 original — continua preciso)*

### 8.1 Tokens já no código
`src/index.css` (`:root`): `--hatch`, `--dot-grid`, `--dot-grid-size`, `--gradient-wave`,
`--font-aurora`. Classe `.aurora-light-scope` força tema claro num subtree independente do Core
estar em dark — usada pelo Onboarding.

Classes disponíveis: `.hatch-texture`, `.dot-grid-texture`, `.aurora-progress-track` +
`.aurora-progress-fill`, `.aurora-diamond`, `.aurora-card-light`, `.aurora-card-dark`,
`.aurora-btn-trailing-icon`. Tailwind: `font-aurora`, `bg-gradient-wave`, `bg-hatch`, animação
`wave-drift`.

### 8.2 Componentes novos
`RaxoPercentIcon` (`src/shared/components/ui/RaxoIcon.tsx`) — ícone `%` compartilhado.
`EmptyState` (`src/shared/components/ui/EmptyState.tsx`) — card claro Aurora reutilizável.

### 8.3 Onde já foi aplicado
`Onboarding.tsx` (card claro nativo, headlines `font-aurora`, botões com ícone circular
trailing). Empty states: `TransactionList`, `Goals`, `SearchPage` (×2), `Social`,
`FriendProfile`, `Approvals`, `NotificationPanel`.

### 8.4 O que não foi alterado
Dashboard, Transações, Analytics, Planejamento, Recorrentes, Aprovações, Configurações, Perfil —
Core continua light-first/funcional, sem a camada Aurora.

---

## 9. Backlog — candidatos pra próxima rodada de aplicação no Core

- `variant="aurora"` (ou nome equivalente) no `Button` do Core, pra ações de destaque usarem o
  ícone circular trailing sem repetir classes manualmente
- Barra de orçamento (`Settings.tsx`) com hachura na parte não preenchida, em vez de cinza chapado
- Avaliar `radius-xs`/tiles pequenos em badges/chips do Core hoje sem token definido
- Onda orgânica/gradiente — só se surgir uma superfície de marketing/hero fora do produto de dados
  (nunca em gráfico real, ver §2.5)
- Diamante — candidato a marcador em metas (`Goals.tsx`) ou nível de orçamento

---

## 10. Voz & tom, Do's/Don'ts, arquivos de marca

Sem mudanças — ver documento v1.0 original (seções 10–12) para a referência completa de
princípios de escrita e arquivos de logo/ícone.
