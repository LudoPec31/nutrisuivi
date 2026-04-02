import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useConversationList, useChat, useBroadcasts } from '../hooks/useChat'
import { supabase } from '../lib/supabase'
import ChatBubble from '../components/ChatBubble'
import { format, parseISO, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

const avatarColors = ['av-green', 'av-purple', 'av-amber', 'av-coral']
function avatarColor(str) {
  if (!str) return 'av-green'
  let h = 0; for (let c of str) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return avatarColors[h % avatarColors.length]
}
function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
}

function ConvLastMsg({ messages }) {
  if (!messages?.length) return <span style={{color:'var(--gray-400)',fontSize:12}}>Aucun message</span>
  const last = [...messages].sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0]
  const preview = last.content || (last.file_name ? `📎 ${last.file_name}` : '—')
  return <span style={{color:'var(--gray-400)',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{preview}</span>
}

function UnreadDot({ messages, userId }) {
  const unread = messages?.filter(m => m.sender_id !== userId && !m.read_at).length || 0
  if (!unread) return null
  return (
    <div style={{width:18,height:18,borderRadius:'50%',background:'var(--green)',color:'#fff',
      fontSize:10,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      {unread > 9 ? '9+' : unread}
    </div>
  )
}

// ── Composant tchat interne ──
function ChatWindow({ conversationId, clientName, userId, onClose }) {
  const { messages, loading, sendMessage, markAsRead } = useChat(conversationId)
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (conversationId && userId) markAsRead(userId)
  }, [conversationId, messages.length])

  async function handleSend(e) {
    e?.preventDefault()
    if (!text.trim()) return
    setSending(true)
    await sendMessage({ content: text, senderId: userId })
    setText('')
    setSending(false)
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${conversationId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('chat-files').upload(path, file)
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
      await sendMessage({ content: '', senderId: userId, fileUrl: publicUrl, fileName: file.name, fileType: file.type })
    }
    setUploading(false)
    fileRef.current.value = ''
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Grouper les messages par date
  const grouped = messages.reduce((acc, msg) => {
    const d = format(parseISO(msg.created_at), isToday(parseISO(msg.created_at)) ? "'Aujourd\'hui'" : 'd MMMM yyyy', { locale: fr })
    if (!acc[d]) acc[d] = []
    acc[d].push(msg)
    return acc
  }, {})

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{padding:'14px 18px',borderBottom:'1px solid var(--gray-100)',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className={`avatar av-sm ${avatarColor(clientName)}`}>{getInitials(clientName)}</div>
          <div>
            <div style={{fontWeight:500,fontSize:13}}>{clientName}</div>
            <div style={{fontSize:11,color:'var(--green)',display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}></div>
              En ligne
            </div>
          </div>
        </div>
        {onClose && (
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{padding:'4px 8px',fontSize:16}}>×</button>
        )}
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>
        {loading ? (
          <div style={{textAlign:'center',color:'var(--gray-400)',fontSize:12,marginTop:40}}>Chargement…</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:'center',color:'var(--gray-400)',fontSize:13,marginTop:60}}>
            <div style={{fontSize:32,marginBottom:10}}>💬</div>
            Démarrez la conversation avec {clientName.split(' ')[0]}
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, msgs]) => (
            <div key={dateLabel}>
              <div style={{textAlign:'center',margin:'12px 0',fontSize:11,color:'var(--gray-400)'}}>
                <span style={{background:'var(--gray-100)',padding:'3px 10px',borderRadius:20}}>{dateLabel}</span>
              </div>
              {msgs.map(msg => (
                <ChatBubble key={msg.id} message={msg} isOwn={msg.sender_id === userId} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{padding:'12px 14px',borderTop:'1px solid var(--gray-100)',flexShrink:0}}>
        <form onSubmit={handleSend} style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            style={{display:'none'}}
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn btn-ghost btn-sm"
            style={{padding:'8px',flexShrink:0}}
            disabled={uploading}
            title="Envoyer un fichier"
          >
            {uploading ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{animation:'spin 1s linear infinite'}}>
                <circle cx="8" cy="8" r="6" stroke="var(--gray-300)" strokeWidth="2"/>
                <path d="M8 2a6 6 0 016 6" stroke="var(--green)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 9.5v2.5a1.5 1.5 0 01-1.5 1.5H4a1.5 1.5 0 01-1.5-1.5V9.5M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <textarea
            className="form-textarea"
            style={{flex:1,minHeight:38,maxHeight:120,resize:'none',padding:'8px 12px',fontSize:13,lineHeight:1.4}}
            placeholder="Écrire un message… (Entrée pour envoyer)"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{padding:'8px 14px',flexShrink:0}}
            disabled={!text.trim() || sending}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M13 7.5L2 2l2.5 5.5L2 13l11-5.5z" fill="currentColor"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Page principale messagerie (nutritionniste) ──
export default function MessagesPage() {
  const { user } = useAuth()
  const { conversations, loading, getOrCreateConversation } = useConversationList()
  const { broadcasts, sendBroadcast } = useBroadcasts()
  const [activeConvId, setActiveConvId] = useState(null)
  const [activeClientName, setActiveClientName] = useState('')
  const [tab, setTab] = useState('chats') // chats | broadcast
  const [broadcastText, setBroadcastText] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastSent, setBroadcastSent] = useState(false)

  async function openConv(clientId, clientName) {
    const convId = await getOrCreateConversation(clientId)
    setActiveConvId(convId)
    setActiveClientName(clientName)
  }

  async function handleBroadcast(e) {
    e.preventDefault()
    if (!broadcastText.trim()) return
    setSendingBroadcast(true)
    await sendBroadcast(broadcastText, user.id)
    setBroadcastText('')
    setSendingBroadcast(false)
    setBroadcastSent(true)
    setTimeout(() => setBroadcastSent(false), 3000)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Messagerie</div>
      </div>
      <div style={{display:'flex',height:'calc(100vh - 58px)',overflow:'hidden'}}>

        {/* ── Colonne gauche : liste conversations ── */}
        <div style={{width:280,borderRight:'1px solid var(--gray-100)',display:'flex',flexDirection:'column',flexShrink:0}}>
          <div className="tabs" style={{padding:'0 12px',marginBottom:0,borderBottom:'1px solid var(--gray-100)'}}>
            <button className={`tab-btn${tab==='chats'?' active':''}`} onClick={() => setTab('chats')}>Conversations</button>
            <button className={`tab-btn${tab==='broadcast'?' active':''}`} onClick={() => setTab('broadcast')}>Annonce</button>
          </div>

          {tab === 'chats' && (
            <div style={{flex:1,overflowY:'auto'}}>
              {loading ? (
                <div style={{padding:20,color:'var(--gray-400)',fontSize:12,textAlign:'center'}}>Chargement…</div>
              ) : conversations.length === 0 ? (
                <div style={{padding:20,color:'var(--gray-400)',fontSize:12,textAlign:'center'}}>
                  Aucune conversation.<br/>Ouvrez la fiche d'un client pour démarrer.
                </div>
              ) : (
                conversations.map(conv => {
                  const name = conv.clients?.profiles?.full_name || '—'
                  const isActive = activeConvId === conv.id
                  return (
                    <div
                      key={conv.id}
                      onClick={() => openConv(conv.client_id, name)}
                      style={{
                        display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                        cursor:'pointer',borderBottom:'1px solid var(--gray-100)',
                        background: isActive ? 'var(--green-light)' : 'transparent',
                        transition:'background 0.12s'
                      }}
                    >
                      <div className={`avatar av-sm ${avatarColor(name)}`}>{getInitials(name)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:500,fontSize:13,color:isActive?'var(--green-dark)':'var(--gray-900)'}}>{name}</div>
                        <ConvLastMsg messages={conv.messages} />
                      </div>
                      <UnreadDot messages={conv.messages} userId={user?.id} />
                    </div>
                  )
                })
              )}
            </div>
          )}

          {tab === 'broadcast' && (
            <div style={{flex:1,overflowY:'auto',padding:14}}>
              <div style={{fontSize:12,color:'var(--gray-600)',marginBottom:12,lineHeight:1.5}}>
                Envoyez un message visible par <strong>tous vos clients</strong> dans leur espace.
              </div>
              <form onSubmit={handleBroadcast}>
                <textarea
                  className="form-textarea"
                  style={{marginBottom:8,fontSize:13}}
                  placeholder="Ex: Je suis en vacances du 15 au 22 juillet…"
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  rows={4}
                />
                <button className="btn btn-primary btn-sm" type="submit" style={{width:'100%'}} disabled={sendingBroadcast||!broadcastText.trim()}>
                  {sendingBroadcast ? 'Envoi…' : broadcastSent ? '✓ Envoyé !' : '📢 Envoyer à tous'}
                </button>
              </form>
              {broadcasts.length > 0 && (
                <div style={{marginTop:16}}>
                  <div style={{fontSize:11,color:'var(--gray-400)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>Historique annonces</div>
                  {broadcasts.map(b => (
                    <div key={b.id} style={{padding:'8px 10px',background:'var(--gray-50)',borderRadius:6,marginBottom:6,fontSize:12}}>
                      <div style={{color:'var(--gray-900)',marginBottom:3}}>{b.content}</div>
                      <div style={{color:'var(--gray-400)',fontSize:10}}>
                        {format(parseISO(b.created_at), 'd MMM yyyy HH:mm', { locale: fr })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Zone de tchat ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {activeConvId ? (
            <ChatWindow
              conversationId={activeConvId}
              clientName={activeClientName}
              userId={user?.id}
            />
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--gray-400)'}}>
              <div style={{fontSize:40,marginBottom:12}}>💬</div>
              <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>Sélectionnez une conversation</div>
              <div style={{fontSize:12}}>ou ouvrez la fiche d'un client</div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
