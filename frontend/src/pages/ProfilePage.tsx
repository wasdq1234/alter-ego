import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { PostCard } from '../components/PostCard'
import type { PersonaProfile, Post, Persona } from '../types'

interface ProfilePageProps {
  token: string
  personas: Persona[]
}

export function ProfilePage({ token, personas }: ProfilePageProps) {
  const { personaId } = useParams<{ personaId: string }>()
  const { t } = useI18n()

  const [profile, setProfile] = useState<PersonaProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [selectedPersonaId, setSelectedPersonaId] = useState(personas[0]?.id || '')

  const apiUrl = import.meta.env.VITE_API_URL || ''

  const fetchProfile = useCallback(async () => {
    if (!personaId) return
    setLoading(true)
    try {
      const [profileRes, feedRes] = await Promise.all([
        fetch(`${apiUrl}/api/sns/persona/${personaId}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/sns/feed?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (profileRes.ok) setProfile(await profileRes.json())

      if (feedRes.ok) {
        const feedData = await feedRes.json()
        // Filter posts by this persona
        const personaPosts = feedData.items.filter(
          (p: Post) => p.persona_id === personaId
        )
        setPosts(personaPosts)
      }
    } finally {
      setLoading(false)
    }
  }, [personaId, token, apiUrl])

  // Check follow status
  useEffect(() => {
    if (!personaId || !selectedPersonaId || selectedPersonaId === personaId) return
    fetch(`${apiUrl}/api/sns/persona/${selectedPersonaId}/following`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setIsFollowing(data.some((f: { id: string }) => f.id === personaId))
      })
      .catch(() => {})
  }, [personaId, selectedPersonaId, token, apiUrl])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (personas.length > 0 && !selectedPersonaId) {
      setSelectedPersonaId(personas[0].id)
    }
  }, [personas, selectedPersonaId])

  const handleFollow = async () => {
    if (!personaId || !selectedPersonaId) return
    if (isFollowing) {
      const res = await fetch(`${apiUrl}/api/sns/follow/${personaId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ follower_id: selectedPersonaId }),
      })
      if (res.ok) {
        setIsFollowing(false)
        setProfile((prev) =>
          prev ? { ...prev, follower_count: prev.follower_count - 1 } : prev
        )
      }
    } else {
      const res = await fetch(`${apiUrl}/api/sns/follow/${personaId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ follower_id: selectedPersonaId }),
      })
      if (res.ok) {
        setIsFollowing(true)
        setProfile((prev) =>
          prev ? { ...prev, follower_count: prev.follower_count + 1 } : prev
        )
      }
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-500">{t('common.loading')}</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-500">Persona not found</p>
      </main>
    )
  }

  const isOwn = personas.some((p) => p.id === personaId)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-semibold flex-shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{profile.personality}</p>
            {profile.background && (
              <p className="text-xs text-gray-400 mt-1">{profile.background}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="font-bold text-gray-900">{profile.post_count}</p>
            <p className="text-xs text-gray-500">{t('sns.posts')}</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900">{profile.follower_count}</p>
            <p className="text-xs text-gray-500">{t('sns.followers')}</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900">{profile.following_count}</p>
            <p className="text-xs text-gray-500">{t('sns.following')}</p>
          </div>

          {/* Follow button (only if not own persona) */}
          {!isOwn && personas.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <select
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={handleFollow}
                className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                  isFollowing
                    ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isFollowing ? t('sns.unfollow') : t('sns.follow')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{t('sns.emptyFeed')}</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Link key={post.id} to={`/sns/post/${post.id}`} className="block">
              <PostCard post={post} />
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
