# 말동무 개발 환경 설정 가이드

## 1단계 — Supabase 프로젝트 생성

1. https://supabase.com 에서 무료 프로젝트 생성
2. `supabase_schema.sql` 파일 내용을 **Supabase SQL Editor**에 붙여넣고 실행
3. Project Settings → API 에서 아래 값 복사

## 2단계 — .env 파일 설정

`.env` 파일을 열고 아래 값을 채워넣으세요:

```env
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_CLAUDE_API_KEY=sk-ant-...
```

- Supabase URL/KEY: Supabase 대시보드 → Settings → API
- Claude API KEY: https://console.anthropic.com → API Keys

## 3단계 — 개발 서버 실행

```bash
cd maldongmu
npm install
npm run dev
```

브라우저에서 http://localhost:5173 열기

## 4단계 — Vercel 배포

```bash
npm install -g vercel
vercel --prod
```

환경변수는 Vercel 대시보드 → Settings → Environment Variables 에서 동일하게 설정

---

## 프로젝트 구조

```
src/
├── lib/
│   ├── supabase.js        # Supabase 클라이언트
│   └── claude.js          # Claude API 호출 + 프롬프트
├── context/
│   └── AuthContext.jsx    # 인증 & 프로필 전역 상태
├── pages/
│   ├── AuthPage.jsx       # 로그인/회원가입
│   ├── OnboardingPage.jsx # 캐릭터 선택 + 기분 시딩
│   ├── ChatPage.jsx       # AI 챗봇 (Module A)
│   ├── DiaryPage.jsx      # AI 감정 일기 (Module B)
│   ├── ReportPage.jsx     # 감정 대시보드 (Module C)
│   └── ExpertPage.jsx     # 공공 자원 연결 (Module D)
└── components/
    ├── BottomNav.jsx
    ├── ExpertBanner.jsx
    └── TypingIndicator.jsx
```

## 주의사항

- `.env` 파일은 절대 git에 커밋하지 마세요
- Claude API 키는 프로토타입 전용 클라이언트 직접 호출 방식입니다
- 프로덕션 배포 시 서버사이드 프록시(Supabase Edge Function 등)를 통해 API 키를 숨기세요
