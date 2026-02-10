const ko = {
  // Auth
  'auth.title': 'Alter Ego',
  'auth.signIn': '로그인',
  'auth.signUp': '회원가입',
  'auth.signInDesc': '계정에 로그인하세요',
  'auth.signUpDesc': '새 계정을 만드세요',
  'auth.email': '이메일',
  'auth.password': '비밀번호',
  'auth.noAccount': '계정이 없으신가요?',
  'auth.hasAccount': '이미 계정이 있으신가요?',
  'auth.checkEmail': '이메일을 확인하여 계정을 인증해주세요.',
  'auth.error': '오류가 발생했습니다',
  'auth.signOut': '로그아웃',

  // Persona list
  'persona.myPersonas': '내 페르소나',
  'persona.newPersona': '+ 새 페르소나',
  'persona.empty': '아직 페르소나가 없습니다. 첫 번째 페르소나를 만들어보세요!',
  'persona.createPersona': '페르소나 만들기',
  'persona.edit': '수정',
  'persona.delete': '삭제',
  'persona.chat': '채팅',
  'persona.deleteConfirm': '을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
  'persona.loading': '페르소나 로딩 중...',

  // Persona form
  'form.createTitle': '페르소나 만들기',
  'form.editTitle': '페르소나 수정',
  'form.name': '이름',
  'form.namePlaceholder': '예: 루나',
  'form.personality': '성격',
  'form.personalityPlaceholder': '예: 밝고 긍정적, 유머러스',
  'form.speakingStyle': '말투',
  'form.speakingStylePlaceholder': '예: 캐주얼한 톤, 이모지 자주 사용',
  'form.background': '배경 (선택사항)',
  'form.backgroundPlaceholder': '예: 25세, 서울 거주, 음악을 좋아함',
  'form.create': '만들기',
  'form.save': '저장',
  'form.creating': '생성 중...',
  'form.saving': '저장 중...',
  'form.cancel': '취소',
  'form.createError': '페르소나 생성에 실패했습니다',
  'form.updateError': '페르소나 수정에 실패했습니다',
  'form.error': '오류가 발생했습니다',

  // Chat
  'chat.placeholder': '메시지를 입력하세요...',
  'chat.connecting': '연결 중...',
  'chat.send': '전송',

  // Common
  'common.loading': '로딩 중...',
} as const

const en: typeof ko = {
  // Auth
  'auth.title': 'Alter Ego',
  'auth.signIn': 'Sign In',
  'auth.signUp': 'Sign Up',
  'auth.signInDesc': 'Sign in to your account',
  'auth.signUpDesc': 'Create a new account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.noAccount': "Don't have an account?",
  'auth.hasAccount': 'Already have an account?',
  'auth.checkEmail': 'Check your email to confirm your account.',
  'auth.error': 'An error occurred',
  'auth.signOut': 'Sign Out',

  // Persona list
  'persona.myPersonas': 'My Personas',
  'persona.newPersona': '+ New Persona',
  'persona.empty': 'No personas yet. Create your first one!',
  'persona.createPersona': 'Create Persona',
  'persona.edit': 'Edit',
  'persona.delete': 'Delete',
  'persona.chat': 'Chat',
  'persona.deleteConfirm': '? This cannot be undone.',
  'persona.loading': 'Loading personas...',

  // Persona form
  'form.createTitle': 'Create Persona',
  'form.editTitle': 'Edit Persona',
  'form.name': 'Name',
  'form.namePlaceholder': 'e.g. Luna',
  'form.personality': 'Personality',
  'form.personalityPlaceholder': 'e.g. Bright and positive, humorous',
  'form.speakingStyle': 'Speaking Style',
  'form.speakingStylePlaceholder': 'e.g. Casual tone, uses emojis often',
  'form.background': 'Background (optional)',
  'form.backgroundPlaceholder': 'e.g. 25 years old, lives in Seoul, loves music',
  'form.create': 'Create',
  'form.save': 'Save',
  'form.creating': 'Creating...',
  'form.saving': 'Saving...',
  'form.cancel': 'Cancel',
  'form.createError': 'Failed to create persona',
  'form.updateError': 'Failed to update persona',
  'form.error': 'Error occurred',

  // Chat
  'chat.placeholder': 'Type a message...',
  'chat.connecting': 'Connecting...',
  'chat.send': 'Send',

  // Common
  'common.loading': 'Loading...',
}

export type TranslationKey = keyof typeof ko

function detectLocale(): 'ko' | 'en' {
  const lang = navigator.language || ''
  return lang.startsWith('ko') ? 'ko' : 'en'
}

const translations = { ko, en }

let currentLocale = detectLocale()

export function getLocale() {
  return currentLocale
}

export function setLocale(locale: 'ko' | 'en') {
  currentLocale = locale
}

export function t(key: TranslationKey): string {
  return translations[currentLocale][key]
}
