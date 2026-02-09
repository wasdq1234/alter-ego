import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { AuthForm } from './components/AuthForm'
import { PersonaForm } from './components/PersonaForm'
import { ChatWindow } from './components/ChatWindow'
import type { Persona } from './types'

type View = 'list' | 'create' | 'chat'

function App() {
  const { user, session, loading, signIn, signUp, signOut } = useAuth()
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
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
        onCreated={(persona) => {
          setPersonas((prev) => [persona, ...prev])
          setView('list')
        }}
        onCancel={() => setView('list')}
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
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-red-600 hover:underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">My Personas</h2>
          <button
            onClick={() => setView('create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + New Persona
          </button>
        </div>

        {loadingPersonas ? (
          <p className="text-gray-500">Loading personas...</p>
        ) : personas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 mb-4">No personas yet. Create your first one!</p>
            <button
              onClick={() => setView('create')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Create Persona
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{persona.name}</h3>
                  <p className="text-sm text-gray-500">{persona.personality}</p>
                </div>
                <button
                  onClick={() => {
                    setActivePersona(persona)
                    setView('chat')
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
