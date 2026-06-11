/// <reference types="vite/client" />

// ─── Tipos ────────────────────────────────────────────────────
export interface CategorizationMapping {
  [keyword: string]: string
}

const mappingKey = (userId: string) => `ai_category_mappings_${userId}`

export function loadUserMappings(userId: string): CategorizationMapping {
  try {
    const raw = localStorage.getItem(mappingKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveUserMappings(userId: string, mappings: CategorizationMapping) {
  localStorage.setItem(mappingKey(userId), JSON.stringify(mappings))
}

export function learnFromCorrection(userId: string, description: string, category: string) {
  const mappings = loadUserMappings(userId)
  const keyword = description.trim().split(/\s+/).slice(0, 3).join(' ').toUpperCase()
  mappings[keyword] = category
  saveUserMappings(userId, mappings)
}

export function categorizeFromMemory(description: string, mappings: CategorizationMapping): string | null {
  const desc = description.toUpperCase()
  const sorted = Object.entries(mappings).sort((a, b) => b[0].length - a[0].length)
  for (const [keyword, category] of sorted) {
    if (desc.includes(keyword)) return category
  }
  return null
}

// ─── Tipos internos ───────────────────────────────────────────
interface TxToCateg { id: string; description: string }
interface CategResult { id: string; category: string; confidence: 'high' | 'medium' | 'low' }

// ─── Categorização via API do Claude — com lotes de 15 ────────
export async function categorizeWithAI(
  transactions: TxToCateg[],
  availableCategories: string[],
  userMappings: CategorizationMapping
): Promise<CategResult[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY não configurada.')

  // Separa os que já têm mapeamento aprendido
  const fromMemory: CategResult[] = []
  const needsAI: TxToCateg[] = []

  for (const tx of transactions) {
    const known = categorizeFromMemory(tx.description, userMappings)
    if (known) fromMemory.push({ id: tx.id, category: known, confidence: 'high' })
    else needsAI.push(tx)
  }

  if (!needsAI.length) return fromMemory

  // Processa em lotes de 15 para não estourar o limite de tokens
  const BATCH_SIZE = 15
  const allAIResults: CategResult[] = []

  for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
    const batch = needsAI.slice(i, i + BATCH_SIZE)
    const results = await categorizeBatch(batch, availableCategories, apiKey)
    allAIResults.push(...results)
  }

  return [...fromMemory, ...allAIResults]
}

// ─── Processa um lote de até 15 transações ────────────────────
async function categorizeBatch(
  batch: TxToCateg[],
  availableCategories: string[],
  apiKey: string
): Promise<CategResult[]> {
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
${batch.map((t) => `${t.id} | ${t.description}`).join('\n')}

Responda APENAS com JSON válido, sem texto adicional, no formato:
[{"id":"ID","category":"categoria exata da lista","confidence":"high|medium|low"}]

Regras críticas:
- Use EXATAMENTE o texto da categoria como está na lista acima (incluindo emoji)
- NÃO invente categorias que não estão na lista
- Se não souber, use "⚠️ Outros"`

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
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '[]'

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned) as CategResult[]
  } catch {
    // Se falhar o parse, retorna sem categoria para o usuário categorizar manualmente
    return batch.map((t) => ({ id: t.id, category: '', confidence: 'low' as const }))
  }
}