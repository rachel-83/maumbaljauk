-- ──────────────────────────────────────────────────────────────
-- fix_teacher_emotion_tags.sql
-- 교사 전용: 담당 반 최근 7일 감정 태그 빈도 집계 RPC
-- diary + chat_logs emotion_tags 를 SECURITY DEFINER로 조회 (RLS 우회)
-- Supabase SQL Editor에서 실행
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_class_emotion_tags()
RETURNS TABLE (tag text, cnt bigint)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
  t_from   timestamptz;
BEGIN
  SELECT school_code, grade, class_num INTO t_school, t_grade, t_class
  FROM public.users WHERE id = auth.uid() AND role = 'teacher';

  IF t_school IS NULL THEN
    RAISE EXCEPTION '교사 권한이 없습니다';
  END IF;

  t_from := now() - INTERVAL '7 days';

  RETURN QUERY
  SELECT sub.tag, SUM(sub.cnt)::bigint AS cnt
  FROM (
    -- diary emotion_tags
    SELECT unnest(d.emotion_tags) AS tag, 1::bigint AS cnt
    FROM public.diary d
    JOIN public.users u ON u.id = d.user_id
    WHERE u.school_code = t_school
      AND u.grade       = t_grade
      AND u.class_num   = t_class
      AND u.role        = 'student'
      AND d.created_at >= t_from
      AND d.emotion_tags IS NOT NULL
      AND array_length(d.emotion_tags, 1) > 0

    UNION ALL

    -- chat_logs emotion_tags
    SELECT unnest(c.emotion_tags) AS tag, 1::bigint AS cnt
    FROM public.chat_logs c
    JOIN public.users u ON u.id = c.user_id
    WHERE u.school_code = t_school
      AND u.grade       = t_grade
      AND u.class_num   = t_class
      AND u.role        = 'student'
      AND c.created_at >= t_from
      AND c.emotion_tags IS NOT NULL
      AND array_length(c.emotion_tags, 1) > 0
  ) sub
  WHERE sub.tag IS NOT NULL AND sub.tag <> ''
  GROUP BY sub.tag
  ORDER BY cnt DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_emotion_tags() TO authenticated;
