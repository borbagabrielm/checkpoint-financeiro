import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useAvatarUpload(userId: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<string | null> => {
    if (!userId) {
      setError('Usuário não autenticado')
      return null
    }

    setUploading(true)
    setError(null)

    try {
      if (!file.type.startsWith('image/')) throw new Error('Arquivo deve ser uma imagem')
      if (file.size > 2 * 1024 * 1024) throw new Error('Imagem deve ter no máximo 2MB')

      // Sempre usa .jpg para evitar problemas com extensões
      const path = `avatars/${userId}-${Date.now()}.jpg`

      // Converte para blob jpg se necessário
      let uploadFile: File | Blob = file
      if (file.type !== 'image/jpeg') {
        uploadFile = await convertToJpeg(file)
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, uploadFile, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        console.error('[useAvatarUpload] upload error:', uploadError)
        throw new Error(`Upload falhou: ${uploadError.message}`)
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`

      // Tenta update primeiro, depois upsert como fallback
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (updateError) {
        // Row não existe ainda — criar
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({ user_id: userId, avatar_url: publicUrl, updated_at: new Date().toISOString() })

        if (insertError) {
          console.error('[useAvatarUpload] insert error:', insertError)
          throw new Error(`Erro ao salvar perfil: ${insertError.message}`)
        }
      }

      return publicUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer upload'
      console.error('[useAvatarUpload]', msg)
      setError(msg)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error }
}

async function convertToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Conversão falhou')),
        'image/jpeg',
        0.92
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao ler imagem')) }
    img.src = url
  })
}