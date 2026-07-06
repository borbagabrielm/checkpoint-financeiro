import type { BankId, ImportFormat, ParseResult } from '../types'
import { parseOFX } from './ofxParser'
import { parseCSV } from './csvParser'
import { parseXLSX } from './xlsxParser'

export function detectFormat(filename: string): ImportFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  return null
}

export function parseFile(
  content: string,
  format: ImportFormat,
  bankId: BankId
): ParseResult {
  if (format === 'ofx') return parseOFX(content)
  if (format === 'csv') return parseCSV(content, bankId)
  // xlsx é tratado separadamente com parseFileBuffer — nunca chega aqui via string
  return { transactions: [], warnings: ['Formato não suportado.'] }
}

// Versão para formatos binários (XLSX) que precisam de ArrayBuffer em vez de string
export function parseFileBuffer(
  buffer: ArrayBuffer,
  format: ImportFormat,
  bankId: BankId
): ParseResult {
  if (format === 'xlsx') return parseXLSX(buffer, bankId)
  return { transactions: [], warnings: ['parseFileBuffer só suporta XLSX.'] }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
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

export function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsArrayBuffer(file)
  })
}