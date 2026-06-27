import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useAvatarUpload(userId: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Aceita File (vindo direto do input, sem crop) ou Blob (já recortado pelo modal)
  const upload = async (input: File | Blob): Promise<string | null> => {
    if (!userId) { setError('Usuário não autenticado'); return null }
    setUploading(true)
    setError(null)

    try {
      const isFile = input instanceof File
      if (isFile && !input.type.startsWith('image/')) throw new Error('Arquivo deve ser uma imagem')
      if (input.size > 8 * 1024 * 1024) throw new Error('Imagem deve ter no máximo 8MB')

      // Se vier de File não recortado (fallback raro), ainda passa pelo convertToJpeg
      // Se já vier como Blob do crop modal (sempre 400x400 jpeg), usa direto
      const jpegBlob = isFile ? await convertToJpeg(input as File) : input

      const path = `${userId}-${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, jpegBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Bucket "avatars" não encontrado. Execute o SQL de configuração no Supabase.')
        }
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('policy')) {
          throw new Error('Permissão negada. Verifique as policies do bucket "avatars" no Supabase.')
        }
        throw new Error(`Falha no upload: ${uploadError.message}`)
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(
          { user_id: userId, avatar_url: publicUrl, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )

      if (profileError) throw new Error(`Falha ao salvar perfil: ${profileError.message}`)

      return publicUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer upload da foto'
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
      const MAX = 800
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else        { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Conversão para JPEG falhou')),
        'image/jpeg', 0.88
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem')) }
    img.src = url
  })
}