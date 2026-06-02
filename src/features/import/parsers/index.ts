import type { BankId, ImportFormat, ParseResult } from '../types'
import { parseOFX } from './ofxParser'
import { parseCSV } from './csvParser'

export function detectFormat(filename: string): ImportFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  if (ext === 'csv') return 'csv'
  return null
}

export function parseFile(
  content: string,
  format: ImportFormat,
  bankId: BankId
): ParseResult {
  if (format === 'ofx') return parseOFX(content)
  return parseCSV(content, bankId)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    // Tenta UTF-8 primeiro, fallback para latin1 (alguns bancos usam)
    reader.readAsText(file, 'UTF-8')
  })
}

export function readFileAsTextLatin(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsText(file, 'ISO-8859-1')
  })
}