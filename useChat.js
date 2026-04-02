import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useChat(conversationId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!conversationId) return
    fetchMessages()
    subscribeRealtime()
    return () => { channelRef.current?.unsubscribe() }
  }, [conversationId])

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(full_name, role)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
    setLoading(false)
  }

  function subscribeRealtime() {
    channelRef.current = supabase
      .channel(`conv:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
        // Enrichir avec le profil sender
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', payload.new.sender_id)
          .single()
        setMessages(prev => [...prev, { ...payload.new, profiles: profile }])
      })
      .subscribe()
  }

  async function sendMessage({ content, senderId, fileUrl, fileName, fileType }) {
    if (!content?.trim() && !fileUrl) return
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content?.trim() || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileType || null
    })
    // Mettre à jour last_message_at
    await supabase.from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
    return { error }
  }

  async function markAsRead(senderId) {
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', senderId)
      .is('read_at', null)
  }

  return { messages, loading, sendMessage, markAsRead, refetch: fetchMessages }
}

export function useConversationList() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
    const channel = supabase
      .channel('conv_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchConversations()
      })
      .subscribe()
    return () => channel.unsubscribe()
  }, [])

  async function fetchConversations() {
    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        clients(*, profiles(full_name, email)),
        messages(id, content, file_name, created_at, sender_id, read_at)
      `)
      .order('last_message_at', { ascending: false })
    if (data) setConversations(data)
    setLoading(false)
  }

  async function getOrCreateConversation(clientId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', clientId)
      .single()
    if (existing) return existing.id

    const { data: created } = await supabase
      .from('conversations')
      .insert({ client_id: clientId })
      .select('id')
      .single()
    return created?.id
  }

  return { conversations, loading, getOrCreateConversation, refetch: fetchConversations }
}

export function useUnreadCount(userId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    fetchUnread()
    const channel = supabase
      .channel(`unread:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => fetchUnread())
      .subscribe()
    return () => channel.unsubscribe()
  }, [userId])

  async function fetchUnread() {
    const { count: c } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .neq('sender_id', userId)
      .is('read_at', null)
    setCount(c || 0)
  }

  return count
}

export function useBroadcasts() {
  const [broadcasts, setBroadcasts] = useState([])

  useEffect(() => {
    fetchBroadcasts()
    const channel = supabase
      .channel('broadcasts_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload) => {
        setBroadcasts(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => channel.unsubscribe()
  }, [])

  async function fetchBroadcasts() {
    const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(20)
    if (data) setBroadcasts(data)
  }

  async function sendBroadcast(content, senderId) {
    return await supabase.from('broadcasts').insert({ content, sender_id: senderId })
  }

  return { broadcasts, sendBroadcast }
}
