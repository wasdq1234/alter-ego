export interface Persona {
  id: string
  user_id: string
  name: string
  personality: string
  speaking_style: string
  background: string | null
  system_prompt: string | null
  created_at: string
  profile_image_url?: string | null
}

export interface PersonaImage {
  id: string
  persona_id: string
  file_path: string
  prompt: string
  is_profile: boolean
  created_at: string
  url: string
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
