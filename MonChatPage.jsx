import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useChat, useBroadcasts } from '../hooks/useChat'
import { supabase } from '../lib/supabase'
import ChatBubble from '../components/ChatBubble'
import { format, parseISO, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function MonChatPage() {
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState(null)
  const [loadingConv, setLoadingConv] = useState(true)
  const [tab, setTab] = useState('chat')
  const { broadcasts } = useBroadcasts()

  useEffect(() => {
    fetchOrCreateConv()
  }, [user])

  async function fetchOrCreateConv() {
    if (!user) return
    // Trouver la fiche client de cet utilisateur
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!client) { setLoadingConv(false); return }

    // Trouver ou créer la conversation
    let { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', client.id)
      .single()

    if (!conv) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ client_id: client.id })
        .select('id')
        .single()
      conv = newConv
    }

    setConversationId(conv?.id || null)
    setLoadingConv(false)
  }

  if (loadingConv) {
    return (
      <>
        <div className="topbar"><div className="topbar-title">Messagerie</div></div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:1,color:'var(--gray-400)'}}>Chargement…</div>
      </>
    )
  }

  if (!conversationId) {
    return (
      <>
        <div className="topbar"><div className="topbar-title">Messagerie</div></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,color:'var(--gray-400)',padding:20,textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>💬</div>
          <div>Votre espace de messagerie sera activé par votre nutritionniste.</div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Messagerie</div>
      </div>
      <div style={{height:'calc(100vh - 58px)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div className="tabs" style={{padding:'0 20px',marginBottom:0,borderBottom:'1px solid var(--gray-100)',flexShrink:0}}>
          <button className={`tab-btn${tab==='chat'?' active':''}`} onClick={() => setTab('chat')}>Mon coach</button>
          <button className={`tab-btn${tab==='annonces'?' active':''}`} onClick={() => setTab('annonces')}>
            Annonces
            {broadcasts.length > 0 && (
              <span style={{marginLeft:5,background:'var(--green)',color:'#fff',
                borderRadius:10,fontSize:10,padding:'1px 6px'}}>{broadcasts.length}</span>
            )}
          </button>
        </div>

        {tab === 'chat' && (
          <ClientChatWindow conversationId={conversationId} userId={user?.id} />
        )}

        {tab === 'annonces' && (
          <div style={{flex:1,overflowY:'auto',padding:20}}>
            {broadcasts.length === 0 ? (
              <div style={{textAlign:'center',color:'var(--gray-400)',fontSize:13,marginTop:40}}>
                <div style={{fontSize:32,marginBottom:10}}>📢</div>
                Aucune annonce pour le moment.
              </div>
            ) : (
              broadcasts.map(b => (
                <div key={b.id} className="card" style={{marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:'var(--green-light)',
                      color:'var(--green-dark)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500}}>
                      AU
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:500}}>Aurélie</div>
                      <div style={{fontSize:10,color:'var(--gray-400)'}}>
                        {format(parseISO(b.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:13,color:'var(--gray-900)',lineHeight:1.6,paddingLeft:36}}>
                    {b.content}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}

function ClientChatWindow({ conversationId, userId }) {
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

  const grouped = messages.reduce((acc, msg) => {
    const d = format(parseISO(msg.created_at), isToday(parseISO(msg.created_at)) ? "'Aujourd\'hui'" : 'd MMMM yyyy', { locale: fr })
    if (!acc[d]) acc[d] = []
    acc[d].push(msg)
    return acc
  }, {})

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
        {loading ? (
          <div style={{textAlign:'center',color:'var(--gray-400)',fontSize:12,marginTop:40}}>Chargement…</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:'center',color:'var(--gray-400)',fontSize:13,marginTop:60}}>
            <div style={{fontSize:36,marginBottom:10}}>👋</div>
            <div style={{fontWeight:500,marginBottom:6}}>Bonjour !</div>
            <div style={{fontSize:12}}>Écrivez à Aurélie, elle vous répondra dès que possible.</div>
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

      <div style={{padding:'12px 16px',borderTop:'1px solid var(--gray-100)',flexShrink:0}}>
        <form onSubmit={handleSend} style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={handleFile} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="btn btn-ghost btn-sm" style={{padding:'8px',flexShrink:0}} disabled={uploading} title="Envoyer une photo">
            {uploading ? '…' : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="12.5" cy="5" r="1" fill="currentColor"/>
              </svg>
            )}
          </button>
          <textarea
            className="form-textarea"
            style={{flex:1,minHeight:38,maxHeight:100,resize:'none',padding:'8px 12px',fontSize:13,lineHeight:1.4}}
            placeholder="Écrire à Aurélie…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button type="submit" className="btn btn-primary btn-sm"
            style={{padding:'8px 14px',flexShrink:0}} disabled={!text.trim() || sending}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M13 7.5L2 2l2.5 5.5L2 13l11-5.5z" fill="currentColor"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
