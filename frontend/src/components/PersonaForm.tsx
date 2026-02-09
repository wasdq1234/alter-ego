import { useState } from 'react'
import type { Persona } from '../types'

interface PersonaFormProps {
  token: string
  onCreated: (persona: Persona) => void
  onCancel: () => void
}

export function PersonaForm({ token, onCreated, onCancel }: PersonaFormProps) {
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('')
  const [speakingStyle, setSpeakingStyle] = useState('')
  const [background, setBackground] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/persona`, {
        method: 'POST',
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
      if (!res.ok) throw new Error('Failed to create persona')
      const persona: Persona = await res.json()
      onCreated(persona)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Create Persona</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Luna"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            required
            placeholder="e.g. Bright and positive, humorous"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Speaking Style</label>
          <textarea
            value={speakingStyle}
            onChange={(e) => setSpeakingStyle(e.target.value)}
            required
            placeholder="e.g. Casual tone, uses emojis often"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Background (optional)</label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="e.g. 25 years old, lives in Seoul, loves music"
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
            {loading ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
