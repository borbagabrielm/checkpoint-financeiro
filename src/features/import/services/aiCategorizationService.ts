/// <reference types="vite/client" />

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

interface TxToCateg { id: string; description: string }
interface CategResult { id: string; category: string; confidence: 'high' | 'medium' | 'low' }

export async function categorizeWithAI(
  transactions: TxToCateg[],
  availableCategories: string[],
  userMappings: CategorizationMapping
): Promise<CategResult[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY não configurada.')

  // Separa os que já têm mapeamento aprendido — evita chamar a API desnecessariamente
  const fromMemory: CategResult[] = []
  const needsAI: TxToCateg[] = []

  for (const tx of transactions) {
    const known = categorizeFromMemory(tx.description, userMappings)
    if (known) fromMemory.push({ id: tx.id, category: known, confidence: 'high' })
    else needsAI.push(tx)
  }

  if (!needsAI.length) return fromMemory

  // Lotes de 10 — menor que 15 para garantir resposta completa e menor custo
  const BATCH_SIZE = 10
  const allAIResults: CategResult[] = []

  for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
    const batch = needsAI.slice(i, i + BATCH_SIZE)
    const results = await categorizeBatch(batch, availableCategories, apiKey)
    allAIResults.push(...results)
  }

  return [...fromMemory, ...allAIResults]
}

async function categorizeBatch(
  batch: TxToCateg[],
  availableCategories: string[],
  apiKey: string
): Promise<CategResult[]> {
  // Prompt compacto — menos tokens de entrada = menor custo
  const categoriesList = availableCategories.join(', ')
  const txList = batch.map((t) => `${t.id}|${t.description}`).join('\n')

  const prompt = `Categorize as transações brasileiras abaixo. Use EXATAMENTE uma das categorias da lista.

Categorias: ${categoriesList}

Exemplos rápidos:
UBER/99/TAXI→🚗 Transporte, IFOOD/DELIVERY→🍕 Alimentação, NETFLIX/SPOTIFY→📺 Assinaturas,
SUPERMERCADO/CARREFOUR/ZAFFARI→🛒 Mercado, FARMACIA/HOSPITAL→💊 Saúde,
ALUGUEL/LUZ/INTERNET→🏠 Moradia, SALAO/BARBEARIA→💅 Beleza,
ESCOLA/CURSO→📚 Educação, HOTEL/PASSAGEM→✈️ Viagem

Transações (formato ID|Descrição):
${txList}

Responda APENAS JSON: [{"id":"ID","category":"categoria","confidence":"high|medium|low"}]`

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
      max_tokens: 512, // 10 itens × ~40 tokens cada = ~400, 512 é suficiente e mais barato
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
    return batch.map((t) => ({ id: t.id, category: '', confidence: 'low' as const }))
  }
}