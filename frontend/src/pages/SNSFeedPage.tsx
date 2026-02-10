import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { PostCard } from '../components/PostCard'
import type { Post } from '../types'

interface SNSFeedPageProps {
  token: string
}

export function SNSFeedPage({ token }: SNSFeedPageProps) {
  const { t } = useI18n()
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const apiUrl = import.meta.env.VITE_API_URL || ''

  const fetchFeed = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: '20' })
        if (cursor) params.set('cursor', cursor)

        const res = await fetch(`${apiUrl}/api/sns/feed?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()

        if (cursor) {
          setPosts((prev) => [...prev, ...data.items])
        } else {
          setPosts(data.items)
        }
        setNextCursor(data.next_cursor)
      } finally {
        setLoading(false)
      }
    },
    [token, apiUrl]
  )

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">{t('sns.feed')}</h2>

      {!loading && posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">{t('sns.emptyFeed')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Link key={post.id} to={`/sns/post/${post.id}`} className="block">
              <PostCard post={post} />
            </Link>
          ))}
        </div>
      )}

      {loading && (
        <p className="text-center text-gray-500 py-4">{t('common.loading')}</p>
      )}

      {nextCursor && !loading && (
        <div className="text-center mt-6">
          <button
            onClick={() => fetchFeed(nextCursor)}
            className="px-6 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('sns.loadMore')}
          </button>
        </div>
      )}
    </main>
  )
}
