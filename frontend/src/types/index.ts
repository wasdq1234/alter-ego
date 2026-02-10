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
  lora_model_id?: string | null
  lora_trigger_word?: string | null
  lora_status?: 'pending' | 'training' | 'ready' | 'failed' | null
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

// --- SNS Types ---

export interface PostPersona {
  id: string
  name: string
  profile_image_url: string | null
}

export interface Post {
  id: string
  persona_id: string
  content: string | null
  image_url: string | null
  created_at: string
  persona: PostPersona
  like_count: number
  comment_count: number
}

export interface FeedResponse {
  items: Post[]
  next_cursor: string | null
}

export interface Comment {
  id: string
  post_id: string
  persona_id: string
  parent_id: string | null
  content: string
  created_at: string
  persona: PostPersona
  replies: Comment[]
}

export interface PersonaProfile {
  id: string
  name: string
  personality: string
  speaking_style: string
  background: string | null
  profile_image_url: string | null
  post_count: number
  follower_count: number
  following_count: number
}
