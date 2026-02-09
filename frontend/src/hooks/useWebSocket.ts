import { useCallback, useRef, useState } from 'react'
import type { ChatMessage, StreamMessage } from '../types'

export function useWebSocket(token: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const streamBufferRef = useRef('')

  const connect = useCallback(
    (threadId: string) => {
      if (!token) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.VITE_API_URL
        ? new URL(import.meta.env.VITE_API_URL).host
        : window.location.host
      const ws = new WebSocket(
        `${protocol}//${host}/ws/chat/${threadId}?token=${token}`
      )

      ws.onmessage = (event) => {
        const data: StreamMessage = JSON.parse(event.data)

        if (data.type === 'error') {
          console.error('WS error:', data.content)
          return
        }

        if (data.type === 'stream') {
          if (data.done) {
            // 스트리밍 완료 → 최종 메시지 확정
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { ...last, content: streamBufferRef.current }]
              }
              return prev
            })
            streamBufferRef.current = ''
            setIsStreaming(false)
          } else {
            streamBufferRef.current += data.content
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { ...last, content: streamBufferRef.current }]
              }
              return [...prev, { role: 'assistant', content: streamBufferRef.current }]
            })
          }
        }
      }

      ws.onclose = () => {
        // Only clear ref if this is still the active WebSocket
        // (StrictMode remount can cause stale onclose to fire after new WS is assigned)
        if (wsRef.current === ws) {
          wsRef.current = null
        }
      }

      wsRef.current = ws
    },
    [token]
  )

  const sendMessage = useCallback(
    (content: string, personaId: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      setMessages((prev) => [...prev, { role: 'user', content }])
      streamBufferRef.current = ''
      setIsStreaming(true)
      wsRef.current.send(JSON.stringify({ persona_id: personaId, content }))
    },
    []
  )

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isStreaming, connect, sendMessage, disconnect, clearMessages }
}
