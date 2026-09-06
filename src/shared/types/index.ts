// ─── User & Auth ──────────────────────────────────────────────
export interface UserProfile {
  id: string
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  categories: string[]
  debit_payment_methods: string[]
  credit_payment_methods: string[]
  theme: 'light' | 'dark' | 'system'
  currency: string
  created_at: string
  updated_at: string
}

// ─── Transactions ─────────────────────────────────────────────
export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  user_id: string
  description: string
  amount: number
  type: TransactionType
  category: string
  payment_method: string | null
  date: string
  created_at: string
  updated_at: string
  recurring_id: string | null
  // computed from shared_transactions join
  shared_with?: SharedTransactionSummary[]
}

export interface TransactionInput {
  description: string
  amount: number
  type: TransactionType
  category: string
  payment_method: string | null
  date: string
  installments?: number
  shared_with?: {
    user_id: string
    amount: number
    percentage?: number
  }[]
  tags?: string[]
}

// ─── Shared Expenses ──────────────────────────────────────────
export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected'

export interface SharedTransaction {
  id: string
  transaction_id: string
  shared_with_user_id: string
  split_amount: number
  split_percentage: number | null
  status: ApprovalStatus
  created_at: string
}

export interface SharedTransactionSummary {
  id: string
  user_id: string
  amount: number
  percentage?: number
  status: ApprovalStatus
}

export interface SharedTransactionWithDetails extends SharedTransaction {
  transaction: Transaction
  sender_profile: UserProfile
}

// ─── Notifications ────────────────────────────────────────────
export type NotificationType = 'shared_transaction' | 'friend_request'

export interface Notification {
  id: string
  type: NotificationType
  recipient_user_id: string
  sender_user_id: string
  is_read: boolean
  created_at: string
  // shared_transaction notifications
  shared_transaction_id?: string
  transaction_amount?: number
  transaction_description?: string
  transaction_date?: string
  // friend request notifications
  friendship_id?: string
}

// ─── Social ───────────────────────────────────────────────────
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected'

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
  requester_profile?: UserProfile
  addressee_profile?: UserProfile
}

// ─── Analytics ────────────────────────────────────────────────
export interface MonthlyStats {
  month: string // YYYY-MM
  label: string
  income: number
  expense: number
  balance: number
}

export interface CategoryBreakdown {
  category: string
  amount: number
  percentage: number
  count: number
}

export interface FinancialGoal {
  id: string
  user_id: string
  title: string
  target_amount: number
  current_amount: number
  deadline: string | null
  category: string | null
  created_at: string
}

// ─── Import sessions ──────────────────────────────────────────
export interface ImportSession {
  id: string
  user_id: string
  name: string
  bank_id: string
  format: 'ofx' | 'csv'
  file_hash: string
  transaction_count: number
  failed_count: number
  created_at: string
}

// ─── Budgets ──────────────────────────────────────────────────
export interface Budget {
  id: string
  user_id: string
  category: string
  amount: number
  created_at: string
  updated_at: string
  // computed
  spent?: number
  percentage?: number
}

// ─── Recurring transactions ───────────────────────────────────
export interface RecurringTransaction {
  id: string
  user_id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  payment_method: string | null
  day_of_month: number
  active: boolean
  last_created_at: string | null
  generated_until: string | null
  created_at: string
}

export interface RecurringTransactionShare {
  id: string
  recurring_id: string
  shared_with_user_id: string
  split_amount: number
  split_percentage: number | null
  created_at: string
}

// Recorrência de outro usuário, compartilhada com o usuário atual
export interface SharedRecurringTransaction extends RecurringTransaction {
  owner_profile: UserProfile | null
  split_amount: number
}