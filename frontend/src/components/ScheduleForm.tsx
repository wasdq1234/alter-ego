import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { Persona, Schedule } from '../types'

interface ScheduleFormProps {
  token: string
  persona: Persona
  onBack: () => void
}

type ScheduleView = 'list' | 'create' | 'edit'

const CRON_PRESETS = [
  { label: 'schedule.presetDaily10' as const, value: '0 10 * * *' },
  { label: 'schedule.presetEvery3h' as const, value: '0 */3 * * *' },
  { label: 'schedule.presetEvery6h' as const, value: '0 */6 * * *' },
  { label: 'schedule.presetWeekday9' as const, value: '0 9 * * 1-5' },
]

const INTERVAL_PRESETS = [
  { label: '1h', value: '1h' },
  { label: '3h', value: '3h' },
  { label: '6h', value: '6h' },
  { label: '12h', value: '12h' },
  { label: '24h', value: '24h' },
]

export function ScheduleForm({ token, persona, onBack }: ScheduleFormProps) {
  const { t } = useI18n()
  const apiUrl = import.meta.env.VITE_API_URL || ''

  const [view, setView] = useState<ScheduleView>('list')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)

  // Form state
  const [scheduleType, setScheduleType] = useState<'cron' | 'interval'>('cron')
  const [scheduleValue, setScheduleValue] = useState('')
  const [activityType, setActivityType] = useState<'post' | 'react' | 'free'>('post')
  const [activityPrompt, setActivityPrompt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSchedules()
  }, [persona.id])

  async function fetchSchedules() {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/persona/${persona.id}/schedules`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSchedules(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setScheduleType('cron')
    setScheduleValue('')
    setActivityType('post')
    setActivityPrompt('')
    setIsActive(true)
    setError('')
    setEditingSchedule(null)
  }

  function openCreate() {
    resetForm()
    setView('create')
  }

  function openEdit(schedule: Schedule) {
    setEditingSchedule(schedule)
    setScheduleType(schedule.schedule_type)
    setScheduleValue(schedule.schedule_value)
    setActivityType(schedule.activity_type)
    setActivityPrompt(schedule.activity_prompt ?? '')
    setIsActive(schedule.is_active)
    setError('')
    setView('edit')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        schedule_type: scheduleType,
        schedule_value: scheduleValue,
        activity_type: activityType,
        activity_prompt: activityPrompt || null,
        is_active: isActive,
      }

      const isEdit = view === 'edit' && editingSchedule
      const url = isEdit
        ? `${apiUrl}/api/persona/${persona.id}/schedule/${editingSchedule.id}`
        : `${apiUrl}/api/persona/${persona.id}/schedule`
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(t('schedule.saveError'))

      const saved: Schedule = await res.json()
      if (isEdit) {
        setSchedules((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      } else {
        setSchedules((prev) => [saved, ...prev])
      }
      setView('list')
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('schedule.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(scheduleId: string) {
    if (!confirm(t('schedule.deleteConfirm'))) return
    try {
      const res = await fetch(
        `${apiUrl}/api/persona/${persona.id}/schedule/${scheduleId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
      }
    } catch {
      // ignore
    }
  }

  async function handleToggleActive(schedule: Schedule) {
    try {
      const res = await fetch(
        `${apiUrl}/api/persona/${persona.id}/schedule/${schedule.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...schedule, is_active: !schedule.is_active }),
        },
      )
      if (res.ok) {
        const updated: Schedule = await res.json()
        setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      }
    } catch {
      // ignore
    }
  }

  // Render form (create / edit)
  if (view === 'create' || view === 'edit') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {view === 'edit' ? t('schedule.edit') : t('schedule.create')}
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.type')}
            </label>
            <select
              value={scheduleType}
              onChange={(e) => {
                setScheduleType(e.target.value as 'cron' | 'interval')
                setScheduleValue('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cron">{t('schedule.typeCron')}</option>
              <option value="interval">{t('schedule.typeInterval')}</option>
            </select>
          </div>

          {/* Schedule Value with presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.value')}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(scheduleType === 'cron' ? CRON_PRESETS : INTERVAL_PRESETS).map(
                (preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setScheduleValue(preset.value)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      scheduleValue === preset.value
                        ? 'bg-blue-100 border-blue-400 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {scheduleType === 'cron' ? t(preset.label as string) : preset.label}
                  </button>
                ),
              )}
            </div>
            <input
              type="text"
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              required
              placeholder={t('schedule.valuePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.activityType')}
            </label>
            <select
              value={activityType}
              onChange={(e) =>
                setActivityType(e.target.value as 'post' | 'react' | 'free')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="post">{t('schedule.activityPost')}</option>
              <option value="react">{t('schedule.activityReact')}</option>
              <option value="free">{t('schedule.activityFree')}</option>
            </select>
          </div>

          {/* Activity Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.prompt')}
            </label>
            <textarea
              value={activityPrompt}
              onChange={(e) => setActivityPrompt(e.target.value)}
              placeholder={t('schedule.promptPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {isActive ? t('schedule.active') : t('schedule.inactive')}
            </span>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('schedule.saving') : t('schedule.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setView('list')
                resetForm()
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('schedule.cancel')}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // Render list view
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('schedule.back')}
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {persona.name} - {t('schedule.title')}
          </h2>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {t('schedule.create')}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">{t('schedule.empty')}</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {t('schedule.create')}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {schedule.schedule_type === 'cron'
                        ? t('schedule.typeCron')
                        : t('schedule.typeInterval')}
                    </span>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {schedule.schedule_value}
                    </code>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        schedule.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {schedule.is_active
                        ? t('schedule.active')
                        : t('schedule.inactive')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {schedule.activity_type === 'post'
                      ? t('schedule.activityPost')
                      : schedule.activity_type === 'react'
                        ? t('schedule.activityReact')
                        : t('schedule.activityFree')}
                  </p>
                  {schedule.activity_prompt && (
                    <p className="text-xs text-gray-400 truncate max-w-md">
                      {schedule.activity_prompt}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(schedule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      schedule.is_active ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        schedule.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(schedule)}
                    className="px-2.5 py-1 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {t('persona.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="px-2.5 py-1 border border-red-300 rounded-md text-xs text-red-600 hover:bg-red-50"
                  >
                    {t('schedule.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
