import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useI18n } from './hooks/useI18n'
import { AuthForm } from './components/AuthForm'
import { PersonaForm } from './components/PersonaForm'
import { ChatWindow } from './components/ChatWindow'
import type { Persona } from './types'

type View = 'list' | 'create' | 'edit' | 'chat'

function App() {
  const { user, session, loading, signIn, signUp, signOut } = useAuth()
  const { t, locale, changeLocale } = useI18n()
  const [view, setView] = useState<View>('list')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activePersona, setActivePersona] = useState<Persona | null>(null)
  const [loadingPersonas, setLoadingPersonas] = useState(false)

  const token = session?.access_token

  useEffect(() => {
    if (!token) return
    setLoadingPersonas(true)
    const apiUrl = import.meta.env.VITE_API_URL || ''
    fetch(`${apiUrl}/api/persona`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setPersonas(data))
      .finally(() => setLoadingPersonas(false))
  }, [token])

  const handleDelete = async (persona: Persona) => {
    if (!token) return
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (!user || !token) {
    return <AuthForm onSignIn={signIn} onSignUp={signUp} />
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

  // Persona list view
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Alter Ego</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeLocale(locale === 'ko' ? 'en' : 'ko')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {locale === 'ko' ? 'EN' : '한국어'}
            </button>
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-red-600 hover:underline"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </header>

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
    </div>
  )
}

export default App
