import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  MessageSquare, Send, Search, RefreshCw, AlertTriangle, 
  Phone, Video, MoreHorizontal, Smile, Paperclip, CheckCheck,
  Clock, User, Users, ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ConversationSummary {
  sender_id: string; name?: string; last_message?: string;
  time?: string; unread?: number; platform?: string; avatar?: string;
}

interface MessageEntry {
  id?: string | number; text?: string; message?: string;
  time?: string; is_me?: boolean; sender_id?: string;
  created_at?: string; status?: 'sent' | 'delivered' | 'read';
}

// ── Platform indicator ─────────────────────────────────────────────────────

function PlatformDot({ platform }: { platform?: string }) {
  const colors: Record<string, string> = {
    facebook: 'bg-[#1877F2]', messenger: 'bg-[#1877F2]',
    whatsapp: 'bg-[#25D366]', telegram: 'bg-[#229ED9]',
    twitter: 'bg-sky-400', instagram: 'bg-[#E4405F]',
  };
  return <div className={cn('w-2 h-2 rounded-full ring-2 ring-brand-surface', colors[platform || ''] || 'bg-brand-primary')} />;
}

// ── Status icon ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status?: string }) {
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-brand-text-muted" />;
  return <Clock className="w-3 h-3 text-brand-text-muted" />;
}

// ── Time formatter ─────────────────────────────────────────────────────────

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonConv = () => (
  <div className="flex items-start gap-3 p-3 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-brand-elevated" />
    <div className="flex-1 space-y-2">
      <div className="flex justify-between"><div className="h-3 w-20 bg-brand-elevated rounded" /><div className="h-2 w-8 bg-brand-elevated rounded" /></div>
      <div className="h-2.5 w-full bg-brand-elevated rounded" />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function Messenger() {
  const { restEndpoint, masterToken } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    setConvLoading(true); setConvError(false);
    try {
      const res = await fetch(`${base}/messages?limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.messages || data.conversations || []);
      } else throw new Error('Failed');
    } catch { setConvError(true); }
    finally { setConvLoading(false); }
  };

  const fetchMessages = async (senderId: string) => {
    setMsgLoading(true); setMsgError(false);
    try {
      const res = await fetch(`${base}/messages/${senderId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else throw new Error('Failed');
    } catch { setMsgError(true); }
    finally { setMsgLoading(false); }
  };

  useEffect(() => { fetchConversations(); const id = setInterval(fetchConversations, 15000); return () => clearInterval(id); }, [restEndpoint]);

  const activeId = selectedId ?? conversations[0]?.sender_id ?? null;
  const selectedConversation = conversations.find(c => c.sender_id === activeId) || null;

  useEffect(() => {
    if (activeId) { fetchMessages(activeId); setShowMobileList(false); }
  }, [activeId, restEndpoint]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = messageInput.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    // Optimistic send
    const tempMsg: MessageEntry = { id: `temp_${Date.now()}`, text, is_me: true, time: new Date().toISOString(), status: 'sent' };
    setMessages(prev => [...prev, tempMsg]);
    setMessageInput('');
    try {
      const res = await fetch(`${base}/messages/reply`, {
        method: 'POST', headers,
        body: JSON.stringify({ recipient_id: activeId, text }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'delivered' } : m));
        fetchConversations();
      } else {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'sent' } : m));
        const d = await res.json();
        toast.error(d.error || 'Send failed');
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'sent' } : m));
      toast.error(err.message || 'Send failed');
    } finally { setSending(false); }
  };

  const filteredConversations = useMemo(
    () => conversations.filter(c =>
      (c.name || c.sender_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.last_message || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [conversations, searchQuery]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-120px)] flex flex-col md:flex-row gap-0 md:gap-4 pb-20 md:pb-0">
      
      {/* Conversation List */}
      <div className={cn(
        'w-full md:w-80 bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden shrink-0',
        showMobileList ? 'flex' : 'hidden md:flex'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-brand-border/30 bg-brand-elevated/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Messages</h2>
              <p className="text-[9px] font-mono text-brand-text-muted uppercase mt-0.5">{conversations.length} conversations</p>
            </div>
            <button onClick={fetchConversations}
              className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-white transition-all">
              <RefreshCw className={cn('w-4 h-4', convLoading && 'animate-spin')} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
            <input type="text" placeholder="Search conversations..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-brand-elevated border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 transition-all" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="p-2 space-y-1">{[1,2,3,4,5,6].map(i => <SkeletonConv key={i} />)}</div>
          ) : convError ? (
            <div className="py-12 text-center text-xs text-red-400 font-mono flex flex-col items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Failed to load
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-12 text-center text-xs text-brand-text-muted font-mono uppercase">No conversations</div>
          ) : (
            filteredConversations.map((conv, idx) => (
              <motion.button key={conv.sender_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                onClick={() => setSelectedId(conv.sender_id)}
                className={cn(
                  'w-full text-left p-3 flex items-start gap-3 transition-all border-b border-brand-border/20 hover:bg-brand-elevated/20',
                  activeId === conv.sender_id ? 'bg-brand-primary/10 border-l-2 border-l-brand-primary' : ''
                )}>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary/30 to-brand-accent/30 flex items-center justify-center text-xs font-bold text-white ring-2 ring-brand-surface">
                    {(conv.name || conv.sender_id).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5"><PlatformDot platform={conv.platform} /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-xs font-bold text-white truncate">{conv.name || conv.sender_id}</h3>
                    <span className="text-[9px] text-brand-text-muted font-mono flex-shrink-0 ml-2">{formatTime(conv.time)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-brand-text-muted truncate pr-2">{conv.last_message || 'No messages yet'}</p>
                    {!!conv.unread && (
                      <span className="w-4 h-4 rounded-full bg-brand-primary text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Chat View */}
      {activeId ? (
        <div className={cn(
          'flex-1 bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden',
          !showMobileList ? 'flex' : 'hidden md:flex'
        )}>
          {/* Chat header */}
          <div className="p-3 border-b border-brand-border/30 flex items-center justify-between bg-brand-elevated/10 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowMobileList(true)} className="md:hidden p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-primary/30 to-brand-accent/30 flex items-center justify-center text-xs font-bold text-white">
                {(selectedConversation?.name || activeId).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">{selectedConversation?.name || activeId}</h3>
                <p className="text-[9px] text-emerald-400 font-mono">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><Phone className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><Video className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><MoreHorizontal className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-bg/30">
            {msgLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-brand-text-muted" /></div>
            ) : msgError ? (
              <div className="py-10 text-center text-xs text-red-400 font-mono">Failed to load messages</div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center text-xs text-brand-text-muted font-mono uppercase">No messages yet. Send the first reply.</div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div key={msg.id ?? idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.01 }}
                  className={cn('flex', msg.is_me ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed',
                    msg.is_me
                      ? 'bg-brand-primary text-white rounded-br-md'
                      : 'bg-brand-elevated border border-brand-border/30 text-brand-text rounded-bl-md'
                  )}>
                    <p>{msg.text || msg.message}</p>
                    <div className={cn('flex items-center gap-1 mt-1', msg.is_me ? 'justify-end' : 'justify-start')}>
                      <span className="text-[9px] opacity-60 font-mono">{formatTime(msg.time || msg.created_at)}</span>
                      {msg.is_me && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-brand-border/30 bg-brand-elevated/10 shrink-0">
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><Paperclip className="w-4 h-4" /></button>
              <input type="text" placeholder="Type a reply..." value={messageInput}
                onChange={e => setMessageInput(e.target.value)} disabled={sending}
                className="flex-1 px-3.5 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 transition-all disabled:opacity-50" />
              <button type="button" className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><Smile className="w-4 h-4" /></button>
              <button type="submit" disabled={sending || !messageInput.trim()}
                className="p-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 transition-all shadow-glow-primary flex items-center justify-center disabled:opacity-50">
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className={cn(
          'flex-1 bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col items-center justify-center text-brand-text-muted',
          !showMobileList ? 'flex' : 'hidden md:flex'
        )}>
          <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-brand-primary/50" />
          </div>
          <p className="text-sm font-bold text-white mb-1">Omni-Channel Inbox</p>
          <p className="text-xs text-brand-text-muted font-mono">Select a conversation to start messaging</p>
        </div>
      )}
    </motion.div>
  );
}
