/// <reference types="vite/client" />

// ─── Tipos ────────────────────────────────────────────────────
export interface CategorizationMapping {
  [keyword: string]: string // ex: "AMAZON" → "🛒 Mercado"
}

// ─── Chave de localStorage por usuário ───────────────────────
const mappingKey = (userId: string) => `ai_category_mappings_${userId}`

export function loadUserMappings(userId: string): CategorizationMapping {
  try {
    const raw = localStorage.getItem(mappingKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveUserMappings(userId: string, mappings: CategorizationMapping) {
  localStorage.setItem(mappingKey(userId), JSON.stringify(mappings))
}

// Aprende com uma correção: extrai keyword da descrição e salva
export function learnFromCorrection(
  userId: string,
  description: string,
  category: string
) {
  const mappings = loadUserMappings(userId)
  // Usa as primeiras palavras significativas como keyword
  const keyword = description.trim().split(/\s+/).slice(0, 3).join(' ').toUpperCase()
  mappings[keyword] = category
  saveUserMappings(userId, mappings)
}

// Tenta categorizar usando os mapeamentos aprendidos
export function categorizeFromMemory(
  description: string,
  mappings: CategorizationMapping
): string | null {
  const desc = description.toUpperCase()
  // Procura do mais específico (mais palavras) para o mais genérico
  const sorted = Object.entries(mappings).sort((a, b) => b[0].length - a[0].length)
  for (const [keyword, category] of sorted) {
    if (desc.includes(keyword)) return category
  }
  return null
}

// ─── Categorização via API do Claude ─────────────────────────
interface TxToCateg {
  id: string
  description: string
}

interface CategResult {
  id: string
  category: string
  confidence: 'high' | 'medium' | 'low'
}

export async function categorizeWithAI(
  transactions: TxToCateg[],
  availableCategories: string[],
  userMappings: CategorizationMapping
): Promise<CategResult[]> {
  // Separa os que já têm mapeamento aprendido
  const fromMemory: CategResult[] = []
  const needsAI: TxToCateg[] = []

  for (const tx of transactions) {
    const known = categorizeFromMemory(tx.description, userMappings)
    if (known) {
      fromMemory.push({ id: tx.id, category: known, confidence: 'high' })
    } else {
      needsAI.push(tx)
    }
  }

  if (!needsAI.length) return fromMemory

  const prompt = `Você é um assistente de finanças pessoais brasileiro especialista em categorizar transações de cartão de crédito e débito.

Categorias disponíveis (use EXATAMENTE este texto, incluindo emoji):
${availableCategories.join('\n')}

Exemplos de mapeamentos corretos:
- UBER, 99, CABIFY, TAXI, POSTO, COMBUSTIVEL, ESTACIONAMENTO → 🚗 Transporte
- IFOOD, RAPPI, DELIVERY, RESTAURANTE, LANCHONETE, PIZZARIA, BURGER, MC DONALDS, SUBWAY, SUSHI → 🍕 Alimentação
- SUPERMERCADO, CARREFOUR, EXTRA, ATACADAO, ZAFFARI, HORTIFRUTI, PADARIA, MERCADO → 🛒 Mercado
- NETFLIX, SPOTIFY, AMAZON PRIME, DISNEY, YOUTUBE, HBO, APPLE, GOOGLE ONE → 📺 Assinaturas
- FARMACIA, DROGARIA, HOSPITAL, CLINICA, PLANO DE SAUDE, UNIMED, LABORATORIO → 💊 Saúde
- ALUGUEL, CONDOMINIO, AGUA, LUZ, GAS, INTERNET, CLARO, VIVO, TIM, OI → 🏠 Moradia
- SHOPPING, RENNER, ZARA, C&A, HERING, RIACHUELO, LOJAS → 👚 Roupas
- SALAO, BARBEARIA, MANICURE, SPA, PERFUMARIA → 💅 Beleza
- ESCOLA, CURSO, FACULDADE, LIVRO, PAPELARIA → 📚 Educação
- HOTEL, AIRBNB, PASSAGEM, AEROPORTO, AGENCIA → ✈️ Viagem
- PET SHOP, VETERINARIO, RACAO → 🐾 Pets
- BAR, BALADA, CINEMA, TEATRO, SHOW, PARQUE → 🏖️ Lazer

Transações para categorizar (formato: ID | Descrição):
${needsAI.map((t) => `${t.id} | ${t.description}`).join('\n')}

Responda APENAS com JSON válido, sem texto adicional, no formato:
[{"id":"ID","category":"categoria exata da lista","confidence":"high|medium|low"}]

Regras críticas:
- Use EXATAMENTE o texto da categoria como está na lista acima (incluindo emoji)
- confidence "high" = certeza total, "medium" = provável, "low" = chute
- NÃO invente categorias que não estão na lista
- Se realmente não souber, use "⚠️ Outros"`

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY não configurada. Adicione no .env ou nas variáveis do Vercel.')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '[]'

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const aiResults: CategResult[] = JSON.parse(cleaned)
    return [...fromMemory, ...aiResults]
  } catch {
    // Se falhar o parse, retorna sem categoria
    return [...fromMemory, ...needsAI.map((t) => ({
      id: t.id, category: '', confidence: 'low' as const,
    }))]
  }
}