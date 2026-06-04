-- ──────────────────────────────────────────────────────────────
-- fix_worry_status.sql
-- 교사 답글 INSERT 시 worries.status 자동 업데이트 + 수동 RPC 추가
-- Supabase SQL Editor에서 실행
-- ──────────────────────────────────────────────────────────────

-- 1. reply_to_worry: 답글 저장 시 status = 'replied' 자동 반영
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

  -- 답글 저장과 동시에 status → 'replied'
  UPDATE public.worries
  SET status = 'replied', updated_at = now()
  WHERE id = p_worry_id;

  RETURN new_id;
END;
$$;

-- 2. mark_worry_replied: 답글 없이 수동으로 답변완료 처리하는 RPC
CREATE OR REPLACE FUNCTION public.mark_worry_replied(p_worry_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  t_school text;
  t_grade  integer;
  t_class  integer;
  w_rec    public.worries%ROWTYPE;
BEGIN
  SELECT school_code, grade, class_num INTO t_school, t_grade, t_class
  FROM public.users WHERE id = auth.uid() AND role = 'teacher';

  SELECT * INTO w_rec FROM public.worries WHERE id = p_worry_id;
  IF NOT FOUND THEN RAISE EXCEPTION '고민을 찾을 수 없습니다'; END IF;
  IF w_rec.school_code != t_school THEN RAISE EXCEPTION '접근 권한이 없습니다'; END IF;
  IF w_rec.target_type = 'homeroom' AND (w_rec.grade != t_grade OR w_rec.class_num != t_class) THEN
    RAISE EXCEPTION '담당 반 고민이 아닙니다';
  END IF;

  UPDATE public.worries
  SET status = 'replied', updated_at = now()
  WHERE id = p_worry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_worry(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_worry_replied(uuid)          TO authenticated;
