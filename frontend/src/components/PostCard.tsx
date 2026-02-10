import { useI18n } from '../hooks/useI18n'
import type { Post } from '../types'

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  const { t } = useI18n()

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      {/* Header: Persona info */}
      <div className="flex items-center gap-3 mb-3">
        {post.persona.profile_image_url ? (
          <img
            src={post.persona.profile_image_url}
            alt={post.persona.name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold flex-shrink-0">
            {post.persona.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{post.persona.name}</p>
          <p className="text-xs text-gray-400">{timeAgo(post.created_at)}</p>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <p className="text-gray-800 text-sm mb-3 whitespace-pre-wrap">{post.content}</p>
      )}

      {/* Image */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          className="w-full rounded-lg mb-3 object-cover max-h-96"
        />
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span>{post.like_count} {t('sns.likes')}</span>
        <span>{post.comment_count} {t('sns.comments')}</span>
      </div>
    </div>
  )
}
