// ─── Detecção de parcelas ─────────────────────────────────────
// Padrões comuns nos bancos brasileiros:
//   "AMAZON 02/06"         → parcela 2 de 6
//   "MERCADO PAGO (3/12)"  → parcela 3 de 12
//   "NETFLIX Parc 1/3"     → parcela 1 de 3
//   "SHOPEE-02/05"         → parcela 2 de 5

export function parseInstallments(description: string): {
  current: number | null
  total: number | null
  cleanedDesc: string
} {
  const patterns: [RegExp, string][] = [
    // Com espaço antes: "DESC 02/06"
    [/\s+(\d{1,2})\/(\d{1,2})\s*$/, ''],
    // Com parênteses: "DESC (2/6)" ou "DESC (02/06)"
    [/\s*\((\d{1,2})\/(\d{1,2})\)\s*/, ''],
    // Com hífen: "DESC-02/05"
    [/\s*-(\d{1,2})\/(\d{1,2})\s*$/, ''],
    // Com palavra Parc/Parcela: "DESC Parc 1/3"
    [/\s+[Pp]arc\.?\s*(\d{1,2})\/(\d{1,2})/, ''],
    // Com "N DE N": "DESC 2 DE 6"
    [/\s+(\d{1,2})\s+[Dd][Ee]\s+(\d{1,2})/, ''],
    // Colado ao texto no final — ex: "AMAZON MARKETPLACE01/05"
    // Detecta NN/NN ou N/NN colado (sem separador) ao final da string
    // Usa lookbehind para garantir que vem logo após letra ou dígito
    [/([A-Za-z\d])(\d{1,2})\/(\d{1,2})\s*$/, '$1'],
  ]

  for (const [pattern, replacement] of patterns) {
    const match = pattern.exec(description)
    if (match) {
      // Para o padrão colado, os grupos de captura de parcela estão em índices diferentes
      const isAttached = pattern.source.includes('[A-Za-z\\d]')
      const currentStr = isAttached ? match[2] : match[1]
      const totalStr   = isAttached ? match[3] : match[2]

      const current = parseInt(currentStr)
      const total   = parseInt(totalStr)

      if (current >= 1 && total >= current && total <= 48) {
        // Para padrão colado, preserva o caractere capturado no grupo 1
        const cleanedDesc = isAttached
          ? description.replace(pattern, replacement).trim()
          : description.replace(pattern, '').trim()
        return { current, total, cleanedDesc }
      }
    }
  }

  return { current: null, total: null, cleanedDesc: description }
}

// ─── Conversão de datas ───────────────────────────────────────

export function toYMD(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().replace(/^"|"$/g, '') // remove aspas residuais

  // OFX: 20240531 ou 20240531120000[-03:00]
  const ofxMatch = /^(\d{4})(\d{2})(\d{2})/.exec(s)
  if (ofxMatch) return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`

  // Nubank CSV: 2024-05-31
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Itaú/Bradesco CSV: 31/05/2024
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`

  // Inter CSV: 31/05/24
  const shortBrMatch = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s)
  if (shortBrMatch) {
    const year = parseInt(shortBrMatch[3]) + 2000
    return `${year}-${shortBrMatch[2]}-${shortBrMatch[1]}`
  }

  return null
}

// ─── Limpeza de descrição ─────────────────────────────────────

export function cleanDescription(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^\*+/, '')        // Remove asteriscos iniciais (Nubank às vezes usa)
    .replace(/\s*\*\s*/g, ' ')  // Remove asteriscos no meio
    .trim()
    // Capitaliza primeira letra de cada palavra
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 80)
}

// ─── Parse de valor monetário ─────────────────────────────────

export function parseAmount(raw: string): number {
  if (!raw) return 0
  const s = raw.trim().replace(/R\$\s*/gi, '').replace(/\s/g, '')

  // Detecta se usa vírgula como decimal (BR) ou ponto (EN)
  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')

  let cleaned: string
  if (hasComma && hasDot) {
    // Ex: "1.234,56" → ponto é milhar, vírgula é decimal
    cleaned = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    // Ex: "150,00" → vírgula é decimal
    cleaned = s.replace(',', '.')
  } else {
    // Ex: "150.00" ou "19.9" → ponto já é decimal
    cleaned = s
  }

  return Math.abs(parseFloat(cleaned)) || 0
}