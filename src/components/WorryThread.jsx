import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function WorryThread({
  worry, messages, viewerRole, viewerLabel, otherLabel, onSendReply, onMarkReplied, onBack, onRefresh
}) {
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [likes, setLikes] = useState({})
  const [replyTo, setReplyTo] = useState(null)
  const [showInput, setShowInput] = useState(viewerRole === 'teacher')
  const [editingMsg, setEditingMsg] = useState(null)
  const [menuMsg, setMenuMsg] = useState(null)
  const [myUid, setMyUid] = useState(null)
  const [editingPost, setEditingPost] = useState(false)
  const [postDraft, setPostDraft] = useState('')
  const [savingPost, setSavingPost] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUid(data.user?.id))
  }, [])
  useEffect(() => { loadLikes() }, [messages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── 좋아요 ────────────────────────────────────────────────
  async function loadLikes() {
    const ids = messages.map(m => m.id)
    if (!ids.length) return
    const { data } = await supabase.from('worry_reactions').select('*').in('message_id', ids)
    const uid = (await supabase.auth.getUser()).data.user.id
    const map = {}
    ;(data ?? []).forEach(r => {
      if (!map[r.message_id]) map[r.message_id] = { count: 0, mine: false }
      map[r.message_id].count++
      if (r.user_id === uid) map[r.message_id].mine = true
    })
    setLikes(map)
  }

  async function toggleLike(msgId) {
    const uid = (await supabase.auth.getUser()).data.user.id
    if (likes[msgId]?.mine) {
      await supabase.from('worry_reactions').delete().eq('message_id', msgId).eq('user_id', uid)
      setLikes(prev => ({ ...prev, [msgId]: { count: Math.max(0, (prev[msgId]?.count ?? 1) - 1), mine: false } }))
    } else {
      await supabase.from('worry_reactions').upsert(
        { message_id: msgId, user_id: uid, emoji: '\u2764\uFE0F' },
        { onConflict: 'message_id,user_id,emoji' }
      )
      setLikes(prev => ({ ...prev, [msgId]: { count: (prev[msgId]?.count ?? 0) + 1, mine: true } }))
    }
  }

  // ── 전송 ──────────────────────────────────────────────────
  async function handleSend() {
    if (!reply.trim() || sending) return
    setSending(true)
    if (editingMsg) {
      await supabase.from('worry_messages').update({ content: reply.trim() }).eq('id', editingMsg.id)
      setEditingMsg(null)
      if (onRefresh) await onRefresh()
    } else {
      await onSendReply(reply.trim(), replyTo?.id ?? null)
    }
    setReply('')
    clearReplyTo()
    if (viewerRole !== 'teacher') setShowInput(false)
    setSending(false)
  }

  // ── 답장 대상 ─────────────────────────────────────────────
  function startReplyTo(msg) {
    setReplyTo(msg)
    setEditingMsg(null)
    setShowInput(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function clearReplyTo() {
    setReplyTo(null)
  }

  function cancelInput() {
    setShowInput(viewerRole === 'teacher')
    setEditingMsg(null)
    setReplyTo(null)
    setReply('')
  }

  // ── 수정/삭제 ─────────────────────────────────────────────
  function startEdit(msg) {
    setEditingMsg(msg)
    setReplyTo(null)
    setReply(msg.content)
    setMenuMsg(null)
    setShowInput(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleDelete(msgId) {
    if (!confirm('댓글을 삭제할까?')) return
    setMenuMsg(null)
    await supabase.from('worry_messages').delete().eq('id', msgId)
    if (onRefresh) await onRefresh()
  }

  // ── 원본 글 수정 ──────────────────────────────────────────
  async function handleSavePost() {
    if (!postDraft.trim() || savingPost) return
    setSavingPost(true)
    await supabase.from('worries').update({ content: postDraft.trim() }).eq('id', worry.id)
    setSavingPost(false)
    setEditingPost(false)
    if (onRefresh) await onRefresh()
  }

  async function handleDeletePost() {
    if (!confirm('이 고민을 삭제할까?\n삭제하면 모든 대화 내용도 함께 사라져.')) return
    await supabase.from('worry_messages').delete().eq('worry_id', worry.id)
    await supabase.from('worries').delete().eq('id', worry.id)
    if (onBack) onBack()
  }

  const isMine = (m) => m.sender_id === myUid
  function senderName(m) {
    return m?.sender_role === viewerRole ? viewerLabel : otherLabel
  }

  // ── 트리 ──────────────────────────────────────────────────
  const msgMap = {}
  messages.forEach(m => { msgMap[m.id] = m })
  const roots = []
  const childMap = {}
  messages.forEach(m => {
    if (m.reply_to) {
      if (!childMap[m.reply_to]) childMap[m.reply_to] = []
      childMap[m.reply_to].push(m)
    } else {
      roots.push(m)
    }
  })
  const ordered = []
  function collect(pid) {
    ;(childMap[pid] ?? []).forEach(k => { ordered.push({ ...k, _indent: true }); collect(k.id) })
  }
  roots.forEach(m => { ordered.push({ ...m, _indent: false }); collect(m.id) })

  // ── 댓글 카드 ─────────────────────────────────────────────
  function renderComment(m) {
    const mine = isMine(m)
    const isTeacher = m.sender_role === 'teacher'
    const like = likes[m.id]
    const isMenuOpen = menuMsg === m.id
    const isHighlighted = replyTo?.id === m.id

    return (
      <div key={m.id} style={m._indent ? { paddingLeft: 44 } : {}} className="mb-1">
        <div className={`flex gap-2.5 py-2.5 px-2 rounded-2xl transition-all ${
          isHighlighted ? 'bg-primary-50 border border-primary-300' : ''
        }`}>
          {/* 아바타 */}
          <div className="flex-shrink-0 pt-0.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${mine ? 'bg-primary-50' : 'bg-gray-100'}`}>
              {isTeacher ? '\uD83D\uDC69\u200D\uD83C\uDFEB' : '\uD83D\uDE48'}
            </div>
          </div>

          {/* 본문 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">{mine ? viewerLabel : otherLabel}</span>
              <span className="text-[10px] text-gray-400">{formatTime(m.created_at)}</span>
            </div>
            {m.reply_to && msgMap[m.reply_to] && (
              <p className="text-[11px] text-primary-600 font-semibold mt-0.5">@{senderName(msgMap[m.reply_to])}</p>
            )}
            <p className="text-sm text-gray-700 leading-relaxed mt-0.5 whitespace-pre-wrap">{m.content}</p>

            <div className="flex items-center gap-3 mt-1">
              <button onClick={() => startReplyTo(m)} className="text-[11px] text-gray-400 font-semibold hover:text-primary-600">
                댓글 달기
              </button>
              {mine && (
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setMenuMsg(isMenuOpen ? null : m.id)}
                    className="text-[11px] text-gray-300 hover:text-gray-500 font-bold tracking-wider px-1">
                    •••
                  </button>
                  {isMenuOpen && (
                    <div className="absolute left-0 bottom-6 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 w-24">
                      <button onClick={() => startEdit(m)}
                        className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100">수정</button>
                      <button onClick={() => handleDelete(m.id)}
                        className="w-full text-left px-3 py-2.5 text-xs text-red-400 hover:bg-red-50">삭제</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 좋아요 */}
          <div className="flex-shrink-0 flex flex-col items-center pt-2">
            <button onClick={() => toggleLike(m.id)} className="p-1 active:scale-125 transition-transform">
              <svg width="16" height="16" viewBox="0 0 24 24" fill={like?.mine ? '#E87B5A' : 'none'} stroke={like?.mine ? 'none' : '#BDBDBD'} strokeWidth="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            {like?.count > 0 && <span className="text-[9px] text-gray-400">{like.count}</span>}
          </div>
        </div>
        {!m._indent && <div className="border-b border-gray-100 ml-10" />}
      </div>
    )
  }

  // ── placeholder ───────────────────────────────────────────
  const placeholder = editingMsg
    ? '수정할 내용을 입력하세요...'
    : replyTo
      ? `${senderName(replyTo)}에게 답장...`
      : '댓글을 입력하세요...'

  return (
    <div className="flex flex-col h-dvh pt-11 bg-transparent" onClick={() => menuMsg && setMenuMsg(null)}>
      {/* 헤더 */}
      <div className="px-4 py-3 glass-strong border-b border-gray-100">
        <button onClick={onBack} className="text-xs text-gray-500">{'\u2190'} 목록</button>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">{'\uD83D\uDCAC'} {otherLabel}과 대화</p>
          <div className="flex items-center gap-1.5">
            {viewerRole === 'teacher' ? (
              worry.status === 'replied' ? (
                <span className="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-semibold">답변완료</span>
              ) : (
                <button
                  onClick={onMarkReplied}
                  className="text-[9px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-semibold active:scale-95 transition-transform"
                >
                  답변완료 표시
                </button>
              )
            ) : (
              messages.some(m => m.sender_role === 'teacher') ? (
                <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">답변완료</span>
              ) : (
                <span className="text-[9px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">답변 대기중</span>
              )
            )}
            <span className="text-[9px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold">익명 보호됨</span>
          </div>
        </div>
      </div>

      {/* 스크롤 */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-36 scrollbar-hide">
        <div className="glass rounded-3xl p-4 mb-4 shadow-sm">
          {/* 수정됨 표시 */}
          {new Date(worry.updated_at) - new Date(worry.created_at) > 60000 && (
            <span className="inline-block text-[9px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-semibold mb-2">수정됨</span>
          )}
          {worry.title && <p className="text-sm font-bold text-gray-800 mb-2">{worry.title}</p>}

          {editingPost ? (
            <>
              <textarea
                value={postDraft}
                onChange={e => setPostDraft(e.target.value)}
                className="w-full min-h-[120px] text-sm text-gray-700 leading-relaxed bg-gray-50 border border-primary-200 rounded-2xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                autoFocus
              />
              <div className="flex gap-2 mt-2 justify-end">
                <button
                  onClick={() => setEditingPost(false)}
                  className="text-xs text-gray-400 px-3 py-1.5 rounded-xl bg-gray-100"
                >
                  취소
                </button>
                <button
                  onClick={handleSavePost}
                  disabled={savingPost || !postDraft.trim()}
                  className="text-xs text-white font-bold px-3 py-1.5 rounded-xl bg-primary-500 disabled:opacity-40"
                >
                  {savingPost ? '저장 중...' : '저장'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{worry.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[9px] text-gray-400">{formatTime(worry.created_at)}</p>
                {viewerRole === 'student' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setPostDraft(worry.content); setEditingPost(true) }}
                      className="text-[11px] text-gray-400 font-semibold hover:text-primary-500"
                    >
                      수정
                    </button>
                    <button
                      onClick={handleDeletePost}
                      className="text-[11px] text-red-400 font-semibold hover:text-red-500"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="glass rounded-3xl shadow-sm px-3 py-1">
          {ordered.map(m => renderComment(m))}
        </div>

        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-6">
            {viewerRole === 'student' ? '선생님의 답장을 기다리는 중이야 \uD83D\uDE4F' : '따뜻한 한마디를 건네주세요 \uD83D\uDC9A'}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      {showInput && (
        <div className={`${viewerRole === 'teacher' ? '' : 'fixed bottom-[68px] left-1/2 -translate-x-1/2 w-full max-w-[420px]'} px-4 py-2 glass-strong border-t border-gray-100 z-[110]`}>
          {/* 인용 박스 */}
          {replyTo && !editingMsg && (
            <div className="flex items-center gap-2 bg-primary-50 rounded-xl px-3 py-2 mb-2 border border-primary-200">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary-600 font-bold">{'\uD83D\uDCAC'} {senderName(replyTo)}의 글에 답장</p>
                <p className="text-[11px] text-gray-500 truncate">{replyTo.content.slice(0, 20)}...</p>
              </div>
              <button onClick={cancelInput}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 text-xs font-bold">
                {'\u2715'}
              </button>
            </div>
          )}
          {/* 수정 헤더 */}
          {editingMsg && (
            <div className="flex items-center justify-between mb-1 px-1">
              <p className="text-[10px] text-primary-600 font-bold">댓글 수정 중</p>
              <button onClick={cancelInput} className="text-[10px] text-gray-400 font-semibold">취소</button>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-sm flex-shrink-0">
              {viewerRole === 'teacher' ? '\uD83D\uDC69\u200D\uD83C\uDFEB' : '\uD83D\uDE48'}
            </div>
            <input
              ref={inputRef}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
              onBlur={() => { if (!reply.trim() && !editingMsg && !replyTo && viewerRole !== 'teacher') setTimeout(() => cancelInput(), 200) }}
              placeholder={placeholder}
              className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none placeholder-gray-400"
            />
            {reply.trim() && (
              <button onClick={handleSend} disabled={sending}
                className="text-sm font-bold text-primary-600 disabled:opacity-40 flex-shrink-0">
                {editingMsg ? '수정' : '게시'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
