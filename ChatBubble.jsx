import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatTime(dateStr) {
  const d = parseISO(dateStr)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return `Hier ${format(d, 'HH:mm')}`
  return format(d, 'd MMM HH:mm', { locale: fr })
}

function FilePreview({ url, name, type }) {
  const isImage = type?.startsWith('image/')
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{display:'block',marginTop:6}}>
        <img src={url} alt={name} style={{maxWidth:220,maxHeight:180,borderRadius:8,display:'block',objectFit:'cover'}} />
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,padding:'6px 10px',
        background:'rgba(255,255,255,0.2)',borderRadius:6,fontSize:12,color:'inherit',textDecoration:'none'}}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 2h6l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 2v3h3" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
      {name || 'Fichier'}
    </a>
  )
}

export default function ChatBubble({ message, isOwn }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: isOwn ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 12,
      animation: 'fadeIn 0.15s ease'
    }}>
      {!isOwn && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--green-light)', color: 'var(--green-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 500, flexShrink: 0
        }}>
          {(message.profiles?.full_name || '?').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
        </div>
      )}
      <div style={{ maxWidth: '70%' }}>
        {!isOwn && message.profiles?.full_name && (
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 3, paddingLeft: 2 }}>
            {message.profiles.full_name}
          </div>
        )}
        <div style={{
          padding: message.file_url && !message.content ? '6px 8px' : '10px 14px',
          borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isOwn ? 'var(--green)' : 'var(--gray-100)',
          color: isOwn ? '#fff' : 'var(--gray-900)',
          fontSize: 13,
          lineHeight: 1.5,
          wordBreak: 'break-word'
        }}>
          {message.content && <div>{message.content}</div>}
          {message.file_url && (
            <FilePreview url={message.file_url} name={message.file_name} type={message.file_type} />
          )}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--gray-400)', marginTop: 3,
          textAlign: isOwn ? 'right' : 'left', paddingLeft: 2, paddingRight: 2,
          display: 'flex', alignItems: 'center', gap: 4,
          justifyContent: isOwn ? 'flex-end' : 'flex-start'
        }}>
          {formatTime(message.created_at)}
          {isOwn && (
            <span style={{ color: message.read_at ? 'var(--green)' : 'var(--gray-300)' }}>
              {message.read_at ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
