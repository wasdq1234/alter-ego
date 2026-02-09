export interface Persona {
  id: string
  user_id: string
  name: string
  personality: string
  speaking_style: string
  background: string | null
  system_prompt: string | null
  created_at: string
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

export interface StreamMessage {
  type: 'stream' | 'error'
  content: string
  done?: boolean
}
