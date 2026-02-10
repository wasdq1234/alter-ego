import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { ActivityLog as ActivityLogType, ActivityLogListResponse, Persona } from '../types'

interface ActivityLogProps {
  token: string
  persona: Persona
  onBack: () => void
}

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  post: '📝',
  like: '❤️',
  comment: '💬',
  follow: '👤',
  react: '⚡',
  free: '🎯',
}

const TRIGGER_COLORS: Record<string, string> = {
  schedule: 'bg-blue-100 text-blue-700',
  manual: 'bg-green-100 text-green-700',
  auto: 'bg-purple-100 text-purple-700',
}

export function ActivityLog({ token, persona, onBack }: ActivityLogProps) {
  const { t } = useI18n()
  const apiUrl = import.meta.env.VITE_API_URL || ''

  const [logs, setLogs] = useState<ActivityLogType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterTrigger, setFilterTrigger] = useState('')

  useEffect(() => {
    setLogs([])
    setNextCursor(null)
    fetchLogs(null)
  }, [persona.id, filterType, filterTrigger])

  async function fetchLogs(cursor: string | null) {
    if (cursor) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (cursor) params.set('cursor', cursor)
      if (filterType) params.set('activity_type', filterType)
      if (filterTrigger) params.set('triggered_by', filterTrigger)

      const res = await fetch(
        `${apiUrl}/api/persona/${persona.id}/activity-logs?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.ok) {
        const data: ActivityLogListResponse = await res.json()
        if (cursor) {
          setLogs((prev) => [...prev, ...data.items])
        } else {
          setLogs(data.items)
        }
        setNextCursor(data.next_cursor)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function formatTime(iso: string) {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d ago`
    return date.toLocaleDateString()
  }

  function getActivityTypeLabel(type: string) {
    const map: Record<string, () => string> = {
      post: () => t('activityLog.typePost'),
      like: () => t('activityLog.typeLike'),
      comment: () => t('activityLog.typeComment'),
      follow: () => t('activityLog.typeFollow'),
      react: () => t('activityLog.typeReact'),
      free: () => t('activityLog.typeFree'),
    }
    return (map[type] ?? (() => type))()
  }

  function getTriggerLabel(trigger: string) {
    const map: Record<string, () => string> = {
      schedule: () => t('activityLog.triggerSchedule'),
      manual: () => t('activityLog.triggerManual'),
      auto: () => t('activityLog.triggerInteraction'),
    }
    return (map[trigger] ?? (() => trigger))()
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('activityLog.back')}
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {persona.name} - {t('activityLog.title')}
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('activityLog.allTypes')}</option>
          <option value="post">{t('activityLog.typePost')}</option>
          <option value="like">{t('activityLog.typeLike')}</option>
          <option value="comment">{t('activityLog.typeComment')}</option>
          <option value="follow">{t('activityLog.typeFollow')}</option>
        </select>
        <select
          value={filterTrigger}
          onChange={(e) => setFilterTrigger(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('activityLog.allTriggers')}</option>
          <option value="schedule">{t('activityLog.triggerSchedule')}</option>
          <option value="manual">{t('activityLog.triggerManual')}</option>
          <option value="auto">{t('activityLog.triggerInteraction')}</option>
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">{t('activityLog.empty')}</p>
        </div>
      ) : (
        <div className="space-y-0">
          {logs.map((log, idx) => (
            <div key={log.id} className="flex gap-3">
              {/* Timeline line + icon */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                  {ACTIVITY_TYPE_ICONS[log.activity_type] ?? '•'}
                </div>
                {idx < logs.length - 1 && (
                  <div className="w-px flex-1 bg-gray-200" />
                )}
              </div>
              {/* Content */}
              <div className="pb-4 flex-1 min-w-0">
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {getActivityTypeLabel(log.activity_type)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        TRIGGER_COLORS[log.triggered_by] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {getTriggerLabel(log.triggered_by)}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                  {typeof log.detail?.content === 'string' && log.detail.content && (
                    <p className="text-sm text-gray-600 line-clamp-3">{log.detail.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Load More */}
          {nextCursor && (
            <div className="text-center pt-2">
              <button
                onClick={() => fetchLogs(nextCursor)}
                disabled={loadingMore}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? t('common.loading') : t('activityLog.loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
