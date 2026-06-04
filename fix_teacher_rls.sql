-- ──────────────────────────────────────────────────────────────
-- fix_teacher_rls.sql
-- 고민 수신함 RLS 우회 패치
-- 문제: TeacherDashboard가 worries/worry_messages를 직접 조회하면
--       RLS(학생 본인만 허용)에 막혀 빈 결과 반환
-- 해결: SECURITY DEFINER RPC를 수정하고 대시보드에서 RPC만 사용
-- Supabase SQL Editor에서 실행
-- ──────────────────────────────────────────────────────────────

-- 1. get_teacher_worries: teacher_replied 필드 추가
CREATE OR REPLACE FUNCTION public.get_teacher_worries()
RETURNS TABLE (
  id              uuid,
  anon_id         text,
  title           text,
  preview         text,
  target_type     text,
  grade           integer,
  class_num       integer,
  status          text,
  last_message_at timestamptz,
  msg_count       integer,
  teacher_replied boolean,
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
    substr(md5(w.student_id::text), 1, 6)                                     AS anon_id,
    w.title,
    left(w.content, 80)                                                        AS preview,
    w.target_type,
    w.grade,
    w.class_num,
    w.status,
    COALESCE(
      (SELECT MAX(m.created_at) FROM public.worry_messages m WHERE m.worry_id = w.id),
      w.created_at
    )                                                                          AS last_message_at,
    (SELECT COUNT(*)::int FROM public.worry_messages m WHERE m.worry_id = w.id) AS msg_count,
    EXISTS(
      SELECT 1 FROM public.worry_messages m
      WHERE m.worry_id = w.id AND m.sender_role = 'teacher'
    )                                                                          AS teacher_replied,
    w.created_at
  FROM public.worries w
  WHERE w.school_code = t_school
    AND (
      w.target_type = 'counselor'
      OR (w.target_type = 'homeroom' AND w.grade = t_grade AND w.class_num = t_class)
    )
  ORDER BY COALESCE(
    (SELECT MAX(m.created_at) FROM public.worry_messages m WHERE m.worry_id = w.id),
    w.created_at
  ) DESC;
END;
$$;

-- 2. get_worry_thread: messages에 sender_id, reply_to 추가 (WorryThread 컴포넌트에서 필요)
--    updated_at도 추가 (수정 여부 표시용)
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

  SELECT json_agg(
    json_build_object(
      'id',          m.id,
      'sender_role', m.sender_role,
      'sender_id',   m.sender_id,
      'content',     m.content,
      'reply_to',    m.reply_to,
      'created_at',  m.created_at
    ) ORDER BY m.created_at
  ) INTO msgs
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
    'status',      w_rec.status,
    'created_at',  w_rec.created_at,
    'updated_at',  w_rec.updated_at,
    'messages',    COALESCE(msgs, '[]'::json)
  );
  RETURN result;
END;
$$;

-- 3. reply_to_worry: reply_to 파라미터 추가 (답장 threading 지원)
CREATE OR REPLACE FUNCTION public.reply_to_worry(
  p_worry_id uuid,
  p_content  text,
  p_reply_to uuid DEFAULT NULL
)
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

  INSERT INTO public.worry_messages (worry_id, sender_role, sender_id, content, reply_to)
  VALUES (p_worry_id, 'teacher', auth.uid(), p_content, p_reply_to)
  RETURNING id INTO new_id;

  UPDATE public.worries SET updated_at = now() WHERE id = p_worry_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_worries()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_worry_thread(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_to_worry(uuid, text, uuid)   TO authenticated;
