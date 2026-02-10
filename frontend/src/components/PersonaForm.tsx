import { useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { Persona } from '../types'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
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

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {isEdit ? t('form.editTitle') : t('form.createTitle')}
      </h2>
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
    </div>
  )
}
