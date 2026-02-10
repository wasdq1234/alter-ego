import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { PostCard } from '../components/PostCard'
import type { TranslationKey } from '../i18n'
import type { Post, Comment as CommentType, Persona } from '../types'

interface PostDetailPageProps {
  token: string
  personas: Persona[]
}

export function PostDetailPage({ token, personas }: PostDetailPageProps) {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<CommentType[]>([])
  const [commentText, setCommentText] = useState('')
  const [selectedPersonaId, setSelectedPersonaId] = useState(personas[0]?.id || '')
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || ''

  const fetchPost = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    try {
      const [postRes, commentsRes] = await Promise.all([
        fetch(`${apiUrl}/api/sns/post/${postId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/sns/post/${postId}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      if (postRes.ok) setPost(await postRes.json())
      if (commentsRes.ok) setComments(await commentsRes.json())
    } finally {
      setLoading(false)
    }
  }, [postId, token, apiUrl])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  useEffect(() => {
    if (personas.length > 0 && !selectedPersonaId) {
      setSelectedPersonaId(personas[0].id)
    }
  }, [personas, selectedPersonaId])

  const handleLike = async () => {
    if (!post || !selectedPersonaId) return
    const res = await fetch(
      `${apiUrl}/api/sns/post/${post.id}/like?persona_id=${selectedPersonaId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (res.ok) {
      const data = await res.json()
      setPost((prev) => prev ? { ...prev, like_count: data.like_count } : prev)
    }
  }

  const handleComment = async () => {
    if (!post || !commentText.trim() || !selectedPersonaId) return
    const body: Record<string, string> = {
      persona_id: selectedPersonaId,
      content: commentText.trim(),
    }
    if (replyTo) body.parent_id = replyTo

    const res = await fetch(`${apiUrl}/api/sns/post/${post.id}/comment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setCommentText('')
      setReplyTo(null)
      fetchPost() // refresh comments
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-500">{t('common.loading')}</p>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-500">Post not found</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        &larr; {t('sns.back')}
      </button>

      <PostCard post={post} />

      {/* Like button */}
      <div className="mt-3 flex items-center gap-3">
        {personas.length > 0 && (
          <>
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
              onClick={handleLike}
              className="text-sm text-pink-600 hover:text-pink-700 font-medium"
            >
              ♥ {t('sns.likes')}
            </button>
          </>
        )}
      </div>

      {/* Comments */}
      <div className="mt-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          {t('sns.comments')} ({post.comment_count})
        </h3>

        {comments.length === 0 ? (
          <p className="text-sm text-gray-400">{t('sns.noComments')}</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(id) => setReplyTo(id)}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Comment form */}
        {personas.length > 0 && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              placeholder={
                replyTo
                  ? `${t('sns.reply')}...`
                  : t('sns.writeComment')
              }
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {replyTo && (
              <button
                onClick={() => setReplyTo(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
            <button
              onClick={handleComment}
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {t('sns.post')}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function CommentItem({
  comment,
  onReply,
  t,
  depth = 0,
}: {
  comment: CommentType
  onReply: (id: string) => void
  t: (key: TranslationKey) => string
  depth?: number
}) {
  return (
    <div className={depth > 0 ? 'ml-8' : ''}>
      <div className="flex items-start gap-2">
        <Link to={`/sns/profile/${comment.persona_id}`}>
          {comment.persona.profile_image_url ? (
            <img
              src={comment.persona.profile_image_url}
              alt={comment.persona.name}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold flex-shrink-0">
              {comment.persona.name.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <Link
              to={`/sns/profile/${comment.persona_id}`}
              className="text-xs font-semibold text-gray-900 hover:underline"
            >
              {comment.persona.name}
            </Link>
            <p className="text-sm text-gray-700">{comment.content}</p>
          </div>
          {depth === 0 && (
            <button
              onClick={() => onReply(comment.id)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1 ml-2"
            >
              {t('sns.reply')}
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onReply={onReply}
          t={t}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}
