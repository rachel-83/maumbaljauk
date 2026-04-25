-- 말동무 Supabase 스키마 DDL (v1.2.0 반영)
-- Supabase SQL Editor에서 순서대로 실행하세요.

-- 1. users 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_type        text NOT NULL DEFAULT 'dog',   -- dog / cat / rabbit / bear
  pet_name        text NOT NULL DEFAULT '멍멍이',
  location_consent  boolean NOT NULL DEFAULT false,
  guardian_consent  boolean NOT NULL DEFAULT false,
  onboarding_done   boolean NOT NULL DEFAULT false,
  role            text NOT NULL DEFAULT 'student',
  sido_code       text,
  school_code     text,
  school_name     text,
  grade           integer,
  class_num       integer,
  student_num     integer,   -- 학생 번호 (교사는 null)
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. chat_logs 테이블
CREATE TABLE IF NOT EXISTS public.chat_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_code   text,
  role          text NOT NULL CHECK (role IN ('user','pet')),
  content       text NOT NULL,
  emotion_tags  text[] DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. diary 테이블
CREATE TABLE IF NOT EXISTS public.diary (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_code   text,
  grade         integer,       -- 학생 학년 (교사 집계용)
  class_num     integer,       -- 학생 반 (교사 집계용)
  date          date NOT NULL,
  mood_emoji    text NOT NULL,                 -- 😊 😐 😔 😠 😰
  content       text NOT NULL,
  ai_summary    text DEFAULT '',
  ai_feedback   text DEFAULT '',
  emotion_tags  text[] DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 4. mood_seeding 테이블 (온보딩 기분 초기값)
CREATE TABLE IF NOT EXISTS public.mood_seeding (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_offset  integer NOT NULL CHECK (day_offset BETWEEN 0 AND 6), -- 0=7일전, 6=어제
  mood_index  integer NOT NULL CHECK (mood_index BETWEEN 0 AND 2), -- 0=기쁨,1=보통,2=슬픔
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_offset)
);

-- 5. counselor_info 테이블
CREATE TABLE IF NOT EXISTS public.counselor_info (
  school_code      text PRIMARY KEY,
  school_name      text,
  sido             text,
  has_counselor    boolean,
  counselor_count  integer,
  updated_at       date
);

-- 6. wee_center 테이블
CREATE TABLE IF NOT EXISTS public.wee_center (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sido_code   text,
  name        text,
  address     text,
  phone       text,
  website     text
);

-- 7. 고민 메시지 반응 아이콘 테이블
CREATE TABLE IF NOT EXISTS public.worry_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES public.worry_messages(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji         text NOT NULL CHECK (emoji IN ('💛','🤗','💪')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.worry_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reaction_all" ON public.worry_reactions
  FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() = user_id);

-- 8. 교사 전용 집계 뷰
CREATE OR REPLACE VIEW public.school_emotion_summary AS
SELECT
  school_code,
  COUNT(DISTINCT user_id)          AS student_count,
  mood_emoji,
  COUNT(*)                         AS mood_count
FROM diary
GROUP BY school_code, mood_emoji;

-- ──────────────────────────────────────────
-- RLS (Row Level Security) 정책
-- ──────────────────────────────────────────

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_seeding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselor_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wee_center  ENABLE ROW LEVEL SECURITY;

-- users: 본인만 조회/수정
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (auth.uid() = id);

-- chat_logs: 본인만 조회/삽입
CREATE POLICY "chat_own" ON public.chat_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 교사는 개별 행 직접 접근 차단
CREATE POLICY "teacher_aggregate_only_chat" ON public.chat_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- diary: 본인만 조회/삽입/수정
CREATE POLICY "diary_own" ON public.diary
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- mood_seeding: 본인만 조회/삽입
CREATE POLICY "mood_own" ON public.mood_seeding
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- counselor_info: 인증 사용자 읽기 허용
CREATE POLICY "counselor_read" ON public.counselor_info FOR SELECT TO authenticated USING (true);

-- wee_center: 인증 사용자 읽기 허용
CREATE POLICY "wee_read" ON public.wee_center FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────
-- 신규 사용자 자동 프로필 생성 트리거
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────
-- 교사 전용: 본인 담당 반 감정 집계 조회 (RPC)
-- ──────────────────────────────────────────
-- SECURITY DEFINER로 RLS를 우회하되, 함수 내부에서 호출자가
-- 해당 학교/학년/반의 교사인지 검증한다.
-- 반환값은 익명 집계만 (개별 user_id, content, diary 본문 절대 포함 X)
CREATE OR REPLACE FUNCTION public.get_class_emotion_summary()
RETURNS TABLE (
  mood_emoji    text,
  mood_count    bigint,
  student_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
BEGIN
  -- 호출자(교사) 정보 조회
  SELECT school_code, grade, class_num
    INTO t_school, t_grade, t_class
  FROM public.users
  WHERE id = auth.uid() AND role = 'teacher';

  IF t_school IS NULL THEN
    RAISE EXCEPTION '교사 권한이 없거나 학교 정보가 등록되지 않았습니다';
  END IF;

  RETURN QUERY
  SELECT
    d.mood_emoji,
    COUNT(*)::bigint                 AS mood_count,
    COUNT(DISTINCT d.user_id)::bigint AS student_count
  FROM public.diary d
  JOIN public.users u ON u.id = d.user_id
  WHERE u.school_code = t_school
    AND u.grade       = t_grade
    AND u.class_num   = t_class
    AND u.role        = 'student'
    AND d.created_at  >= NOW() - INTERVAL '7 days'
  GROUP BY d.mood_emoji;
END;
$$;

-- 같은 반 학생 총원 (담임 반에 가입한 학생 수)
CREATE OR REPLACE FUNCTION public.get_class_student_count()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
  cnt      integer;
BEGIN
  SELECT school_code, grade, class_num
    INTO t_school, t_grade, t_class
  FROM public.users
  WHERE id = auth.uid() AND role = 'teacher';

  IF t_school IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO cnt FROM public.users
  WHERE role        = 'student'
    AND school_code = t_school
    AND grade       = t_grade
    AND class_num   = t_class;

  RETURN cnt;
END;
$$;

-- 교사가 호출 가능하도록 권한 부여
GRANT EXECUTE ON FUNCTION public.get_class_emotion_summary()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_student_count()    TO authenticated;

-- ──────────────────────────────────────────
-- 고민 털어놓기 (worries / worry_messages)
-- ──────────────────────────────────────────
-- target_type: 'counselor' (전문상담교사 있는 학교) | 'homeroom' (담임)
-- 학생은 본인 것만 RLS로 접근, 교사는 RPC(SECURITY DEFINER)로 익명화된 데이터만 조회

CREATE TABLE IF NOT EXISTS public.worries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_code   text NOT NULL,
  grade         integer,
  class_num     integer,
  target_type   text NOT NULL CHECK (target_type IN ('counselor','homeroom')),
  title         text,
  content       text NOT NULL,
  status        text NOT NULL DEFAULT 'open',   -- open | closed
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worries_school_class
  ON public.worries (school_code, target_type, grade, class_num);

CREATE TABLE IF NOT EXISTS public.worry_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worry_id      uuid NOT NULL REFERENCES public.worries(id) ON DELETE CASCADE,
  sender_role   text NOT NULL CHECK (sender_role IN ('student','teacher')),
  sender_id     uuid NOT NULL REFERENCES public.users(id),
  content       text NOT NULL,
  reply_to      uuid REFERENCES public.worry_messages(id),  -- 답장 대상 메시지 (null = 일반)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worry_messages_thread
  ON public.worry_messages (worry_id, created_at);

ALTER TABLE public.worries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worry_messages  ENABLE ROW LEVEL SECURITY;

-- 학생: 본인 worries만 접근
DROP POLICY IF EXISTS "worry_student_own" ON public.worries;
CREATE POLICY "worry_student_own" ON public.worries
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- 학생: 본인 worry 스레드 메시지 읽기/쓰기
DROP POLICY IF EXISTS "worry_msg_student_own" ON public.worry_messages;
CREATE POLICY "worry_msg_student_own" ON public.worry_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.worries w WHERE w.id = worry_id AND w.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.worries w WHERE w.id = worry_id AND w.student_id = auth.uid()));

-- ── 교사 전용 RPC ──────────────────────────────────────────

-- 1. 교사가 받은 고민 목록 (학생 익명화)
CREATE OR REPLACE FUNCTION public.get_teacher_worries()
RETURNS TABLE (
  id              uuid,
  anon_id         text,             -- md5 앞 6자리 (학생 식별 불가, 같은 학생은 동일 값)
  title           text,
  preview         text,              -- 첫 80자 미리보기
  target_type     text,
  grade           integer,
  class_num       integer,
  status          text,
  last_message_at timestamptz,
  msg_count       integer,
  created_at      timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
BEGIN
  SELECT school_code, grade, class_num INTO t_school, t_grade, t_class
  FROM public.users WHERE id = auth.uid() AND role = 'teacher';

  IF t_school IS NULL THEN
    RAISE EXCEPTION '교사 권한이 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    substr(md5(w.student_id::text), 1, 6) AS anon_id,
    w.title,
    left(w.content, 80)                   AS preview,
    w.target_type,
    w.grade,
    w.class_num,
    w.status,
    COALESCE((SELECT MAX(created_at) FROM public.worry_messages m WHERE m.worry_id = w.id), w.created_at) AS last_message_at,
    (SELECT COUNT(*)::int FROM public.worry_messages m WHERE m.worry_id = w.id) AS msg_count,
    w.created_at
  FROM public.worries w
  WHERE w.school_code = t_school
    AND (
      w.target_type = 'counselor'
      OR (w.target_type = 'homeroom' AND w.grade = t_grade AND w.class_num = t_class)
    )
  ORDER BY COALESCE((SELECT MAX(created_at) FROM public.worry_messages m WHERE m.worry_id = w.id), w.created_at) DESC;
END;
$$;

-- 2. 교사가 특정 고민의 스레드 조회 (본문 + 메시지 배열, 익명 표시)
CREATE OR REPLACE FUNCTION public.get_worry_thread(p_worry_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
  w_rec    public.worries%ROWTYPE;
  msgs     json;
  result   json;
BEGIN
  SELECT school_code, grade, class_num INTO t_school, t_grade, t_class
  FROM public.users WHERE id = auth.uid() AND role = 'teacher';

  SELECT * INTO w_rec FROM public.worries WHERE id = p_worry_id;
  IF NOT FOUND THEN RAISE EXCEPTION '고민을 찾을 수 없습니다'; END IF;
  IF w_rec.school_code != t_school THEN RAISE EXCEPTION '접근 권한이 없습니다'; END IF;
  IF w_rec.target_type = 'homeroom' AND (w_rec.grade != t_grade OR w_rec.class_num != t_class) THEN
    RAISE EXCEPTION '담당 반 고민이 아닙니다';
  END IF;

  SELECT json_agg(json_build_object(
    'id',          m.id,
    'sender_role', m.sender_role,
    'content',     m.content,
    'created_at',  m.created_at
  ) ORDER BY m.created_at) INTO msgs
  FROM public.worry_messages m
  WHERE m.worry_id = p_worry_id;

  result := json_build_object(
    'id',          w_rec.id,
    'anon_id',     substr(md5(w_rec.student_id::text), 1, 6),
    'title',       w_rec.title,
    'content',     w_rec.content,
    'target_type', w_rec.target_type,
    'grade',       w_rec.grade,
    'class_num',   w_rec.class_num,
    'created_at',  w_rec.created_at,
    'messages',    COALESCE(msgs, '[]'::json)
  );
  RETURN result;
END;
$$;

-- 3. 교사가 답글 작성 (본인의 user_id가 DB에는 기록되지만 학생은 "선생님"으로만 표시)
CREATE OR REPLACE FUNCTION public.reply_to_worry(p_worry_id uuid, p_content text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
  w_rec    public.worries%ROWTYPE;
  new_id   uuid;
BEGIN
  SELECT school_code, grade, class_num INTO t_school, t_grade, t_class
  FROM public.users WHERE id = auth.uid() AND role = 'teacher';

  SELECT * INTO w_rec FROM public.worries WHERE id = p_worry_id;
  IF NOT FOUND THEN RAISE EXCEPTION '고민을 찾을 수 없습니다'; END IF;
  IF w_rec.school_code != t_school THEN RAISE EXCEPTION '접근 권한이 없습니다'; END IF;
  IF w_rec.target_type = 'homeroom' AND (w_rec.grade != t_grade OR w_rec.class_num != t_class) THEN
    RAISE EXCEPTION '담당 반 고민이 아닙니다';
  END IF;

  INSERT INTO public.worry_messages (worry_id, sender_role, sender_id, content)
  VALUES (p_worry_id, 'teacher', auth.uid(), p_content)
  RETURNING id INTO new_id;

  UPDATE public.worries SET updated_at = now() WHERE id = p_worry_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_worries()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_worry_thread(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_to_worry(uuid, text)             TO authenticated;
