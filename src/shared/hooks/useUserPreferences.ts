import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import { supabase } from '@/shared/lib/supabase'
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_DEBIT_METHODS, DEFAULT_INCOME_METHODS } from '@/shared/lib/utils'

export interface UserPreferences {
  categories: string[]
  income_categories: string[]
  debit_payment_methods: string[]
  credit_payment_methods: string[]
  currency: string
}

const DEFAULT_PREFS: UserPreferences = {
  categories: DEFAULT_CATEGORIES,
  income_categories: DEFAULT_INCOME_CATEGORIES,
  debit_payment_methods: DEFAULT_DEBIT_METHODS,
  credit_payment_methods: DEFAULT_INCOME_METHODS,
  currency: 'BRL',
}

export function useUserPreferences() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.preferences.me(user?.id ?? ''),
    queryFn: async (): Promise<UserPreferences> => {
      const { data } = await supabase
        .from('user_preferences')
        .select('categories, income_categories, debit_payment_methods, credit_payment_methods, currency')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (!data) return DEFAULT_PREFS
      return {
        categories: (data.categories as string[])?.length
          ? (data.categories as string[])
          : DEFAULT_PREFS.categories,
        income_categories: (data.income_categories as string[])?.length
          ? (data.income_categories as string[])
          : DEFAULT_PREFS.income_categories,
        debit_payment_methods: (data.debit_payment_methods as string[])?.length
          ? (data.debit_payment_methods as string[])
          : DEFAULT_PREFS.debit_payment_methods,
        credit_payment_methods: (data.credit_payment_methods as string[])?.length
          ? (data.credit_payment_methods as string[])
          : DEFAULT_PREFS.credit_payment_methods,
        currency: data.currency ?? 'BRL',
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  })

  const save = useMutation({
    mutationFn: async (prefs: Partial<UserPreferences>) => {
      const current = query.data ?? DEFAULT_PREFS
      const merged = { ...current, ...prefs }
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user!.id,
            categories: merged.categories,
            income_categories: merged.income_categories,
            debit_payment_methods: merged.debit_payment_methods,
            credit_payment_methods: merged.credit_payment_methods,
            currency: merged.currency,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      if (error) throw new Error(error.message)
      return merged
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.preferences.me(user?.id ?? '') })
    },
  })

  return {
    preferences: query.data ?? DEFAULT_PREFS,
    isLoading: query.isLoading,
    save,
  }
}