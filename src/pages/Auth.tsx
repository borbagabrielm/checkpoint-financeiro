import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label } from '@/shared/components/ui/form-elements'
import { useAuth } from '@/shared/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Nome obrigatório'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
})

type LoginForm = z.infer<typeof loginSchema>
type SignupForm = z.infer<typeof signupSchema>

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema) })

  const onLogin = async (data: LoginForm) => {
    const { error } = await signIn(data.email, data.password)
    if (error) { toast.error('Email ou senha incorretos'); return }
    navigate('/')
  }

  const onSignup = async (data: SignupForm) => {
    const { error } = await signUp(data.email, data.password, data.fullName)
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este email já está cadastrado. Tente fazer login.')
        setMode('login')
      } else {
        toast.error(error.message)
      }
      return
    }
    // Se confirmação de email está desabilitada no Supabase, já está logado
    // Se não, avisar para verificar o email
    toast.success('Conta criada com sucesso! Se necessário, verifique seu email para confirmar.')
    setMode('login')
  }

  const onGoogle = async () => {
    const { error } = await signInWithGoogle()
    if (error) toast.error('Erro ao entrar com Google')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          {/* Logo Raxo */}
          <svg viewBox="322 194 380 120" height="48" xmlns="http://www.w3.org/2000/svg">
            <path d="M381.1,306.23h32.17l-22.16-40.68c5.65-2.72,10.11-6.56,13.34-11.57,3.46-5.36,5.19-11.95,5.19-19.76s-1.69-14.38-5.06-19.92c-3.37-5.54-8.1-9.78-14.17-12.73-6.07-2.95-13.16-4.42-21.25-4.42h-47.09v109.09h29.62v-36.01h10.25l19.15,36.01ZM351.7,220.78h10.44c3.48,0,6.45.47,8.92,1.41,2.47.94,4.37,2.4,5.7,4.37,1.33,1.97,2,4.52,2,7.64s-.67,5.59-2,7.51-3.23,3.31-5.7,4.18c-2.47.87-5.44,1.3-8.92,1.3h-10.44v-26.42Z" className="fill-foreground"/>
            <path d="M416.19,284.59c0-15.2,10.74-24.62,30.57-26.11l23.14-1.82v-1.32c0-8.1-4.96-12.39-14.05-12.39-10.74,0-16.53,4.13-16.53,11.57h-21.15c0-18.67,15.37-30.9,39-30.9s37.51,13.39,37.51,37.02v48.26h-22.48l-1.65-10.91c-2.64,7.6-13.55,13.05-25.95,13.05-17.52,0-28.42-10.25-28.42-26.44ZM470.07,277.98v-4.46l-12.89,1.16c-11.07.99-15.04,3.47-15.04,8.76,0,5.95,3.64,8.76,11.4,8.76,9.75,0,16.53-4.79,16.53-14.21Z" className="fill-foreground"/>
            <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="#3B3BFF"/>
            <circle cx="515.62" cy="244.36" r="14.47" fill="#3B3BFF"/>
            <circle cx="568.01" cy="293.67" r="14.47" fill="#3B3BFF"/>
            <path d="M629.26,223.62c25.68,0,44.42,17.12,44.42,42.64s-18.74,42.48-44.42,42.48-44.58-16.96-44.58-42.48,18.74-42.64,44.58-42.64ZM629.26,286.45c11.47,0,19.38-8.08,19.38-20.35s-7.91-20.19-19.38-20.19-19.54,8.08-19.54,20.19,7.91,20.35,19.54,20.35Z" className="fill-foreground"/>
          </svg>
          <p className="text-sm text-muted-foreground -mt-2">
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta grátis'}
          </p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          {/* Tab toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-secondary'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  {...loginForm.register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    {...loginForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          ) : (
            <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input {...signupForm.register('fullName')} placeholder="Seu nome" />
                {signupForm.formState.errors.fullName && (
                  <p className="text-xs text-destructive">{signupForm.formState.errors.fullName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...signupForm.register('email')} type="email" placeholder="seu@email.com" />
                {signupForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input
                  {...signupForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input
                  {...signupForm.register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                />
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={signupForm.formState.isSubmitting}
              >
                {signupForm.formState.isSubmitting ? 'Criando...' : 'Criar conta'}
              </Button>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Google */}
          <Button variant="outline" className="w-full gap-2" onClick={onGoogle}>
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  )
}