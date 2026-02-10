/**
 * E2E test helpers for i18n-aware selectors.
 * Matches both English and Korean text so tests work regardless of browser locale.
 */

export const texts = {
  // Auth
  signInDesc: /Sign in to your account|계정에 로그인하세요/,
  signUpDesc: /Create a new account|새 계정을 만드세요/,
  signIn: /^로그인$|^Sign In$/,
  signUp: /^회원가입$|^Sign Up$/,
  signOut: /^로그아웃$|^Sign Out$/,
  email: /^Email$|^이메일$/,
  password: /^Password$|^비밀번호$/,

  // Persona list
  myPersonas: /^My Personas$|^내 페르소나$/,
  newPersona: /\+ New Persona|\+ 새 페르소나/,
  createPersona: /^Create Persona$|^페르소나 만들기$/,
  edit: /^Edit$|^수정$/,
  delete: /^Delete$|^삭제$/,
  chat: /^Chat$|^채팅$/,

  // Persona form
  createTitle: /^Create Persona$|^페르소나 만들기$/,
  editTitle: /^Edit Persona$|^페르소나 수정$/,
  namePlaceholder: /^e\.g\. Luna$|^예: 루나$/,
  personalityPlaceholder: /Bright and positive|밝고 긍정적/,
  speakingStylePlaceholder: /Casual tone|캐주얼한 톤/,
  create: /^Create$|^만들기$/,
  save: /^Save$|^저장$/,
  cancel: /^Cancel$|^취소$/,

  // Chat
  chatPlaceholder: /Type a message|메시지를 입력하세요/,
  send: /^Send$|^전송$/,
}
