/// <reference types="vite/client" />

const required = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
} as const

const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length > 0) {
  throw new Error(
    `[Raxo] Variáveis de ambiente obrigatórias não encontradas:\n` +
    missing.map((k) => `  • ${k}`).join('\n') +
    `\n\nCrie um arquivo .env na raiz do projeto com essas variáveis.`
  )
}

export const env = {
  supabaseUrl: required.VITE_SUPABASE_URL as string,
  supabaseAnonKey: required.VITE_SUPABASE_ANON_KEY as string,
}