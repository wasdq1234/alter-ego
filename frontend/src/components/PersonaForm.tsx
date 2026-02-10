import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { Persona, PersonaImage } from '../types'

interface PersonaFormProps {
  token: string
  persona?: Persona
  onSaved: (persona: Persona) => void
  onCancel: () => void
}

export function PersonaForm({ token, persona, onSaved, onCancel }: PersonaFormProps) {
  const { t } = useI18n()
  const isEdit = !!persona
  const [name, setName] = useState(persona?.name ?? '')
  const [personality, setPersonality] = useState(persona?.personality ?? '')
  const [speakingStyle, setSpeakingStyle] = useState(persona?.speaking_style ?? '')
  const [background, setBackground] = useState(persona?.background ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Image state
  const [images, setImages] = useState<PersonaImage[]>([])
  const [imagePrompt, setImagePrompt] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState('')

  const apiUrl = import.meta.env.VITE_API_URL || ''

  // 기본 프롬프트 생성
  useEffect(() => {
    if (isEdit) {
      const defaultPrompt = `A portrait of a character named ${name}. ${personality}. ${background || ''}. Digital art style, high quality avatar.`
      setImagePrompt(defaultPrompt.trim())
    }
  }, [isEdit, name, personality, background])

  // 이미지 목록 로드
  useEffect(() => {
    if (!isEdit || !persona) return
    fetch(`${apiUrl}/api/persona/${persona.id}/images`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setImages(data))
      .catch(() => {})
  }, [isEdit, persona, token, apiUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const url = isEdit
        ? `${apiUrl}/api/persona/${persona.id}`
        : `${apiUrl}/api/persona`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          personality,
          speaking_style: speakingStyle,
          background: background || null,
        }),
      })
      if (!res.ok) throw new Error(isEdit ? t('form.updateError') : t('form.createError'))
      const saved: Persona = await res.json()
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateImage = async () => {
    if (!persona || !imagePrompt.trim()) return
    setGeneratingImage(true)
    setImageError('')
    try {
      const res = await fetch(`${apiUrl}/api/persona/${persona.id}/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: imagePrompt.trim() }),
      })
      if (!res.ok) throw new Error(t('image.generateError'))
      const newImage: PersonaImage = await res.json()
      setImages((prev) => [newImage, ...prev])
    } catch (err) {
      setImageError(err instanceof Error ? err.message : t('image.generateError'))
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleSetProfile = async (imageId: string) => {
    if (!persona) return
    const res = await fetch(`${apiUrl}/api/persona/${persona.id}/image/${imageId}/set-profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setImages((prev) =>
        prev.map((img) => ({ ...img, is_profile: img.id === imageId }))
      )
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!persona) return
    const res = await fetch(`${apiUrl}/api/persona/${persona.id}/image/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setImages((prev) => {
        const deleted = prev.find((img) => img.id === imageId)
        const remaining = prev.filter((img) => img.id !== imageId)
        // 프로필이 삭제되었으면 첫 번째 이미지가 자동 승격됨
        if (deleted?.is_profile && remaining.length > 0) {
          remaining[0] = { ...remaining[0], is_profile: true }
        }
        return remaining
      })
    }
  }

  const profileImage = images.find((img) => img.is_profile)

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {isEdit ? t('form.editTitle') : t('form.createTitle')}
      </h2>

      {/* 프로필 이미지 표시 */}
      {isEdit && (
        <div className="flex justify-center mb-4">
          {profileImage ? (
            <img
              src={profileImage.url.startsWith('http') ? profileImage.url : `${apiUrl}${profileImage.url}`}
              alt={persona?.name}
              className="w-24 h-24 rounded-full object-cover border-2 border-blue-300"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl text-gray-400">
              {persona?.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t('form.namePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.personality')}</label>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            required
            placeholder={t('form.personalityPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.speakingStyle')}</label>
          <textarea
            value={speakingStyle}
            onChange={(e) => setSpeakingStyle(e.target.value)}
            required
            placeholder={t('form.speakingStylePlaceholder')}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.background')}</label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder={t('form.backgroundPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? (isEdit ? t('form.saving') : t('form.creating'))
              : (isEdit ? t('form.save') : t('form.create'))}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('form.cancel')}
          </button>
        </div>
      </form>

      {/* 이미지 생성 섹션 (수정 모드에서만) */}
      {isEdit && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('image.title')}</h3>

          {/* 프롬프트 입력 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{t('image.prompt')}</label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder={t('image.promptPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={generatingImage || !imagePrompt.trim()}
              className="w-full py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {generatingImage ? t('image.generating') : t('image.generate')}
            </button>
            {imageError && <p className="text-sm text-red-600">{imageError}</p>}
          </div>

          {/* 이미지 갤러리 */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('image.gallery')}</h4>
            {images.length === 0 ? (
              <p className="text-sm text-gray-400">{t('image.noImages')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative rounded-lg overflow-hidden border-2 ${
                      img.is_profile ? 'border-blue-500' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={img.url.startsWith('http') ? img.url : `${apiUrl}${img.url}`}
                      alt="Generated"
                      className="w-full aspect-square object-cover"
                    />
                    {img.is_profile && (
                      <span className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                        {t('image.profile')}
                      </span>
                    )}
                    <div className="flex gap-1 p-1 bg-white">
                      {!img.is_profile && (
                        <button
                          onClick={() => handleSetProfile(img.id)}
                          className="flex-1 text-xs py-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          {t('image.setProfile')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="flex-1 text-xs py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        {t('image.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
