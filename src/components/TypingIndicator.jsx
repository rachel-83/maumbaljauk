export default function TypingIndicator({ petImg }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <img src={petImg} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 shadow-sm" />
      <div className="glass rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 bg-primary-500 rounded-full inline-block"
              style={{ animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
