import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './MessageBubble'
import { useWebSocket } from '../hooks/useWebSocket'
import { useI18n } from '../hooks/useI18n'
import type { Persona } from '../types'

interface ChatWindowProps {
  persona: Persona
  token: string
  onBack: () => void
}

export function ChatWindow({ persona, token, onBack }: ChatWindowProps) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { messages, isStreaming, connect, sendMessage, disconnect } =
    useWebSocket(token)

  useEffect(() => {
    let cancelled = false

    async function initThread() {
      try {
        const res = await fetch('/api/chat/thread', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ persona_id: persona.id }),
        })
        if (!res.ok) throw new Error('Failed to create thread')
        const data = await res.json()
        if (!cancelled) {
          await connect(data.id)
          if (!cancelled) setThreadId(data.id)
        }
      } catch (err) {
        console.error('Thread creation failed:', err)
      }
    }

    initThread()
    return () => {
      cancelled = true
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.id, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming || !threadId) return
    sendMessage(text, persona.id)
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          &larr;
        </button>
        <div>
          <h2 className="font-semibold text-gray-900">{persona.name}</h2>
          <p className="text-xs text-gray-500">{persona.personality}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={threadId ? t('chat.placeholder') : t('chat.connecting')}
            disabled={!threadId}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim() || !threadId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
