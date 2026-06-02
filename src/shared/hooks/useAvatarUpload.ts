import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useAvatarUpload(userId: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true)
    setError(null)

    try {
      // Valida tipo e tamanho
      if (!file.type.startsWith('image/')) {
        throw new Error('Arquivo deve ser uma imagem')
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Imagem deve ter no máximo 2MB')
      }

      const ext = file.name.split('.').pop()
      const path = `avatars/${userId}.${ext}`

      // Upload para o bucket avatars
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw new Error(uploadError.message)

      // Gera URL pública
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)

      // Atualiza user_profiles
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (updateError) throw new Error(updateError.message)

      return data.publicUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer upload'
      setError(msg)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error }
}