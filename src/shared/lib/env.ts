// Validação de variáveis de ambiente em tempo de build/inicialização
// Falha com mensagem clara em vez de erros crípticos em runtime

const required = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const

const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length > 0) {
  throw new Error(
    `[Checkpoint Financeiro] Variáveis de ambiente obrigatórias não encontradas:\n` +
    missing.map((k) => `  • ${k}`).join('\n') +
    `\n\nCrie um arquivo .env na raiz do projeto com essas variáveis.\n` +
    `Consulte o .env.example para referência.`
  )
}

export const env = {
  supabaseUrl: required.VITE_SUPABASE_URL as string,
  supabaseAnonKey: required.VITE_SUPABASE_ANON_KEY as string,
}