// Chaves de cache centralizadas para TanStack Query
// Seguindo o padrão de factory functions para invalidação granular

export const queryKeys = {
  // Transactions
  transactions: {
    all: (userId: string) => ['transactions', userId] as const,
    list: (userId: string, filters?: Record<string, unknown>) =>
      ['transactions', userId, 'list', filters] as const,
    detail: (id: string) => ['transactions', id] as const,
  },

  // Analytics
  analytics: {
    monthly: (userId: string) => ['analytics', userId, 'monthly'] as const,
    categories: (userId: string, month?: string) =>
      ['analytics', userId, 'categories', month] as const,
    summary: (userId: string, month?: string) =>
      ['analytics', userId, 'summary', month] as const,
  },

  // Social / Friendships
  friendships: {
    all: (userId: string) => ['friendships', userId] as const,
    accepted: (userId: string) => ['friendships', userId, 'accepted'] as const,
    pending: (userId: string) => ['friendships', userId, 'pending'] as const,
  },

  // User profiles
  profiles: {
    me: (userId: string) => ['profile', userId] as const,
    friend: (userId: string) => ['profile', 'friend', userId] as const,
    search: (term: string) => ['profile', 'search', term] as const,
  },

  // Preferences
  preferences: {
    me: (userId: string) => ['preferences', userId] as const,
  },

  // Shared expenses / approvals
  sharedExpenses: {
    pending: (userId: string) => ['shared-expenses', userId, 'pending'] as const,
    history: (userId: string) => ['shared-expenses', userId, 'history'] as const,
    detail: (id: string) => ['shared-expenses', id] as const,
    // Keys separadas para a página de aprovações (evita conflito de cache com useNotifications)
    approvalsPending: (userId: string) => ['approvals', userId, 'pending'] as const,
    approvalsHistory: (userId: string) => ['approvals', userId, 'history'] as const,
  },

  // Recurring transactions
  recurring: {
    mine: (userId: string) => ['recurring', userId, 'mine'] as const,
    shared: (userId: string) => ['recurring', userId, 'shared'] as const,
  },

  // Notifications
  notifications: {
    all: (userId: string) => ['notifications', userId] as const,
    unreadCount: (userId: string) => ['notifications', userId, 'unread-count'] as const,
  },
}