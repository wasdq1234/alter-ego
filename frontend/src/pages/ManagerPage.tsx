import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { PersonaForm } from '../components/PersonaForm'
import { ChatWindow } from '../components/ChatWindow'
import type { Persona } from '../types'

type View = 'list' | 'create' | 'edit' | 'chat'

interface ManagerPageProps {
  token: string
}

export function ManagerPage({ token }: ManagerPageProps) {
  const { t } = useI18n()
  const [view, setView] = useState<View>('list')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activePersona, setActivePersona] = useState<Persona | null>(null)
  const [loadingPersonas, setLoadingPersonas] = useState(true)

  useEffect(() => {
    let cancelled = false
    const apiUrl = import.meta.env.VITE_API_URL || ''
    fetch(`${apiUrl}/api/persona`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setPersonas(data) })
      .finally(() => { if (!cancelled) setLoadingPersonas(false) })
    return () => { cancelled = true }
  }, [token])

  const handleDelete = async (persona: Persona) => {
    if (!confirm(`"${persona.name}"${t('persona.deleteConfirm')}`)) return

    const apiUrl = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiUrl}/api/persona/${persona.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setPersonas((prev) => prev.filter((p) => p.id !== persona.id))
    }
  }

  if (view === 'chat' && activePersona) {
    return (
      <ChatWindow
        persona={activePersona}
        token={token}
        onBack={() => {
          setActivePersona(null)
          setView('list')
        }}
      />
    )
  }

  if (view === 'create') {
    return (
      <PersonaForm
        token={token}
        onSaved={(persona) => {
          setPersonas((prev) => [persona, ...prev])
          setView('list')
        }}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'edit' && activePersona) {
    return (
      <PersonaForm
        token={token}
        persona={activePersona}
        onSaved={(updated) => {
          setPersonas((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          )
          setActivePersona(null)
          setView('list')
        }}
        onCancel={() => {
          setActivePersona(null)
          setView('list')
        }}
      />
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t('persona.myPersonas')}</h2>
        <button
          onClick={() => setView('create')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {t('persona.newPersona')}
        </button>
      </div>

      {loadingPersonas ? (
        <p className="text-gray-500">{t('persona.loading')}</p>
      ) : personas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">{t('persona.empty')}</p>
          <button
            onClick={() => setView('create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {t('persona.createPersona')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                {persona.profile_image_url ? (
                  <img
                    src={persona.profile_image_url.startsWith('http') ? persona.profile_image_url : `${import.meta.env.VITE_API_URL || ''}${persona.profile_image_url}`}
                    alt={persona.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold flex-shrink-0">
                    {persona.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{persona.name}</h3>
                  <p className="text-sm text-gray-500">{persona.personality}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActivePersona(persona)
                    setView('edit')
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t('persona.edit')}
                </button>
                <button
                  onClick={() => handleDelete(persona)}
                  className="px-3 py-1.5 border border-red-300 rounded-md text-sm text-red-600 hover:bg-red-50"
                >
                  {t('persona.delete')}
                </button>
                <button
                  onClick={() => {
                    setActivePersona(persona)
                    setView('chat')
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  {t('persona.chat')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
