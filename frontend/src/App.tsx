import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useI18n } from './hooks/useI18n'
import { AuthForm } from './components/AuthForm'
import { ManagerPage } from './pages/ManagerPage'
import { SNSFeedPage } from './pages/SNSFeedPage'
import { PostDetailPage } from './pages/PostDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import type { Persona } from './types'

function App() {
  const { user, session, loading, signIn, signUp, signOut } = useAuth()
  const { t, locale, changeLocale } = useI18n()
  const [personas, setPersonas] = useState<Persona[]>([])

  const token = session?.access_token

  // Fetch user's personas (needed for comment/like/follow actions in SNS pages)
  useEffect(() => {
    if (!token) return
    const apiUrl = import.meta.env.VITE_API_URL || ''
    fetch(`${apiUrl}/api/persona`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setPersonas(data))
      .catch(() => {})
  }, [token])

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

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-bold text-gray-900">Alter Ego</h1>
              <nav className="flex items-center gap-1">
                <NavLink
                  to="/manager"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  {t('nav.manager')}
                </NavLink>
                <NavLink
                  to="/sns"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  {t('nav.sns')}
                </NavLink>
              </nav>
            </div>
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

        <Routes>
          <Route path="/manager" element={<ManagerPage token={token} />} />
          <Route path="/sns" element={<SNSFeedPage token={token} />} />
          <Route
            path="/sns/post/:postId"
            element={<PostDetailPage token={token} personas={personas} />}
          />
          <Route
            path="/sns/profile/:personaId"
            element={<ProfilePage token={token} personas={personas} />}
          />
          <Route path="*" element={<Navigate to="/manager" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
