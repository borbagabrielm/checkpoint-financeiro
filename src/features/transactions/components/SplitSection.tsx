import { useState } from 'react'
import { Users, Check, ChevronDown } from 'lucide-react'
import { Input } from '@/shared/components/ui/form-elements'
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@/shared/components/ui/display'
import { cn, formatCurrency, getInitials, roundToCents } from '@/shared/lib/utils'
import type { Friendship } from '@/shared/types'
import type { SplitEntry } from './TransactionForm'

interface Props {
  accepted: Friendship[]
  userId: string
  amount: number
  selectedFriends: SplitEntry[]
  splitType: 'equal' | 'custom'
  onToggleFriend: (userId: string, displayName: string) => void
  onUpdateCustomAmount: (userId: string, value: string) => void
  onChangeSplitType: (type: 'equal' | 'custom') => void
  getOtherProfile: (f: Friendship, userId: string) => { user_id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null } | undefined
}

export function SplitSection({
  accepted, userId, amount, selectedFriends, splitType,
  onToggleFriend, onUpdateCustomAmount, onChangeSplitType, getOtherProfile,
}: Props) {
  const [splitEnabled, setSplitEnabled] = useState(selectedFriends.length > 0)

  const totalPeople = selectedFriends.length + 1
  const equalSharePerPerson = amount > 0 && selectedFriends.length > 0
    ? roundToCents(amount / totalPeople) : 0

  const getFriendAmount = (f: SplitEntry): number =>
    splitType === 'equal' ? equalSharePerPerson : parseFloat(f.customAmount) || 0

  const friendsTotal = selectedFriends.reduce((s, f) => s + getFriendAmount(f), 0)
  const creatorShare = Math.max(0, roundToCents(amount - friendsTotal))

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button type="button" onClick={() => setSplitEnabled((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors">
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Dividir com amigos
          {selectedFriends.length > 0 && (
            <Badge variant="secondary">{selectedFriends.length} selecionado{selectedFriends.length > 1 ? 's' : ''}</Badge>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', splitEnabled && 'rotate-180')} />
      </button>

      {splitEnabled && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Você ainda não tem amigos. Vá em <strong>Amigos</strong> para adicionar.
            </p>
          ) : (
            <>
              {/* Seleção de amigos */}
              <ul className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
                {accepted.map((friendship) => {
                  const profile = getOtherProfile(friendship, userId)
                  if (!profile) return null
                  const isSelected = selectedFriends.some((f) => f.userId === profile.user_id)
                  return (
                    <li key={friendship.id}>
                      <button type="button"
                        onClick={() => onToggleFriend(profile.user_id, profile.display_name ?? profile.username ?? 'Amigo')}
                        className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-secondary')}>
                        <Avatar className="h-7 w-7 shrink-0">
                          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                          <AvatarFallback className="text-xs">{getInitials(profile.display_name)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{profile.display_name ?? profile.username}</span>
                        {isSelected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {selectedFriends.length > 0 && (
                <>
                  {/* Tipo de divisão */}
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                    {(['equal', 'custom'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => onChangeSplitType(t)}
                        className={cn('flex-1 py-1.5 font-medium transition-colors',
                          splitType === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary')}>
                        {t === 'equal' ? 'Divisão igual' : 'Valor personalizado'}
                      </button>
                    ))}
                  </div>

                  {/* Preview divisão igual */}
                  {splitType === 'equal' && (
                    <div className="rounded-lg bg-secondary p-3 space-y-1.5 text-sm">
                      <p className="text-xs text-muted-foreground mb-1">
                        {amount > 0 ? `R$ ${amount.toFixed(2)} ÷ ${totalPeople} pessoas` : 'Digite o valor acima para ver a divisão'}
                      </p>
                      <div className="flex justify-between">
                        <span className="font-medium">Você</span>
                        <span className="font-mono">{amount > 0 ? formatCurrency(creatorShare) : '—'}</span>
                      </div>
                      {selectedFriends.map((f) => (
                        <div key={f.userId} className="flex justify-between text-muted-foreground">
                          <span className="truncate max-w-[60%]">{f.displayName}</span>
                          <span className="font-mono">{amount > 0 ? formatCurrency(equalSharePerPerson) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inputs valor personalizado */}
                  {splitType === 'custom' && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Quanto cada amigo deve pagar:</p>
                      {selectedFriends.map((f) => (
                        <div key={f.userId} className="flex items-center gap-2">
                          <span className="text-sm flex-1 truncate">{f.displayName}</span>
                          <div className="relative w-32">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input type="number" step="0.01" min="0.01" placeholder="0,00"
                              value={f.customAmount}
                              onChange={(e) => onUpdateCustomAmount(f.userId, e.target.value)}
                              className="pl-8 font-mono text-sm h-8" />
                          </div>
                        </div>
                      ))}
                      {amount > 0 && (
                        <div className="flex justify-between text-sm pt-1 border-t border-border">
                          <span className="text-muted-foreground">Sua parte</span>
                          <span className="font-mono font-medium">{formatCurrency(creatorShare)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}