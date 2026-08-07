import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  BrainCircuit, Zap, Save, RotateCcw, MessageCircle, Send, Bot, 
  Sparkles, ChevronDown, Gauge, Shield, SlidersHorizontal, Play
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import {
  fetchAIConfig, updateAIConfig,
  fetchPersona, applyPersona,
  chatWithAI, resetPersona,
} from '../lib/api';

export default function AIBrain() {
  const { restEndpoint, masterToken, setPersonaMood, personaMood } = useStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [model, setModel] = useState('gemini-2.5-flash');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [chatTemp, setChatTemp] = useState(0.7);
  const [postTemp, setPostTemp] = useState(0.65);
  const [safetyLevel, setSafetyLevel] = useState('medium');
  const [provider, setProvider] = useState('gemini');

  const [tone, setTone] = useState(60);
  const [aggression, setAggression] = useState(70);
  const [humor, setHumor] = useState(20);
  const [mood, setMood] = useState(personaMood || 'professional');
  const [availableMoods, setAvailableMoods] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');

  const [chatMessage, setChatMessage] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const cfg = { restEndpoint, masterToken };

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const [configData, personaData] = await Promise.all([
          fetchAIConfig(cfg).catch(() => null),
          fetchPersona(cfg).catch(() => null),
        ]);
        if (configData) {
          if (configData.model) setModel(configData.model);
          if ((configData as any).available_models) setAvailableModels((configData as any).available_models);
          if ((configData as any).available_providers) setAvailableProviders((configData as any).available_providers);
          if (configData.chat_temperature !== undefined) setChatTemp(configData.chat_temperature as number);
          if (configData.post_temperature !== undefined) setPostTemp(configData.post_temperature as number);
          if (configData.safety_level) setSafetyLevel(configData.safety_level as string);
          if (configData.provider) setProvider(configData.provider as string);
        }
        if (personaData) {
          if (personaData.tone !== undefined) setTone(personaData.tone);
          if (personaData.aggression !== undefined) setAggression(personaData.aggression);
          if (personaData.humor !== undefined) setHumor(personaData.humor);
          if (personaData.persona_mood) setMood(personaData.persona_mood as typeof mood);
          if (personaData.available_moods) setAvailableMoods(personaData.available_moods);
          if (personaData.system_prompt) setSystemPrompt(personaData.system_prompt);
        }
      } catch (err: any) { setError(err.message); }
      finally { setLoading(false); }
    };
    loadConfig();
  }, [restEndpoint]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateAIConfig(cfg, { model, chat_temperature: chatTemp, post_temperature: postTemp, safety_level: safetyLevel, provider }),
        applyPersona(cfg, { tone, aggression, humor, model, system_prompt: systemPrompt || '', persona_mood: mood }),
      ]);
      setPersonaMood(mood as any);
      toast.success('AI configuration saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    try {
      const d = await resetPersona(cfg);
      if (d.persona) {
        if (d.persona.tone !== undefined) setTone(d.persona.tone);
        if (d.persona.aggression !== undefined) setAggression(d.persona.aggression);
        if (d.persona.humor !== undefined) setHumor(d.persona.humor);
        if (d.persona.persona_mood) setMood(d.persona.persona_mood as typeof mood);
        if (d.persona.system_prompt !== undefined) setSystemPrompt(d.persona.system_prompt || '');
      }
      toast.success('Reset to defaults');
    } catch { toast.error('Reset failed'); }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    setChatLoading(true); setChatReply('');
    try {
      const d = await chatWithAI(cfg, chatMessage);
      setChatReply(d.reply || d.response || 'No response');
    } catch { setChatReply('Chat failed. Check your Gemini key.'); }
    finally { setChatLoading(false); }
  };

  const MOOD_CARDS = [
    { key: 'analytical', label: 'Analytical', emoji: '🧠', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { key: 'professional', label: 'Professional', emoji: '💼', color: 'text-brand-primary bg-brand-primary/10 border-brand-primary/20' },
    { key: 'creative', label: 'Creative', emoji: '🎨', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { key: 'urgent', label: 'Urgent', emoji: '⚡', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  ];

  const filteredMoodCards = availableMoods.length > 0 ? MOOD_CARDS.filter(m => availableMoods.includes(m.key)) : MOOD_CARDS;

  const modelLabel = (id: string) => {
    const map: Record<string, string> = { 'gemini-2.5-flash': 'Gemini 2.5 Flash', 'gemini-2.5-pro': 'Gemini 2.5 Pro', 'gemini-1.5-pro': 'Gemini 1.5 Pro', 'gemini-1.5-flash': 'Gemini 1.5 Flash' };
    return map[id] || id;
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse max-w-4xl">
        <div className="h-8 bg-brand-elevated rounded w-48" />
        <div className="h-64 bg-brand-surface/50 border border-brand-border/50 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20 max-w-4xl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <BrainCircuit className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Brain</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {modelLabel(model)} · {mood} · Chat: {chatTemp.toFixed(1)} / Post: {postTemp.toFixed(1)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface border border-brand-border/50 text-brand-text-muted hover:text-white text-xs font-bold font-mono uppercase tracking-wider transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
            {saving ? 'Saving…' : <><Save className="w-3.5 h-3.5" /> Save All</>}
          </motion.button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono">{error}</div>}

      {/* Model Configuration */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 space-y-5">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-brand-primary" /> Model Configuration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1.5 block">Active Model</label>
            <select value={model} onChange={e => setModel(e.target.value)}
              className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text font-bold focus:outline-none focus:border-brand-primary/50 transition-all">
              {(availableModels.length > 0 ? availableModels : ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash']).map(m => (
                <option key={m} value={m}>{modelLabel(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1.5 block">Safety Level</label>
            <select value={safetyLevel} onChange={e => setSafetyLevel(e.target.value)}
              className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text font-bold focus:outline-none focus:border-brand-primary/50 transition-all">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
        </div>

        {[
          { label: 'Chat Temperature', value: chatTemp, set: setChatTemp, icon: MessageCircle },
          { label: 'Post Temperature', value: postTemp, set: setPostTemp, icon: Send },
        ].map(slider => (
          <div key={slider.label}>
            <div className="flex justify-between mb-1.5">
              <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-1.5">
                <slider.icon className="w-3 h-3" /> {slider.label}
              </label>
              <span className="text-xs font-mono font-bold text-white">{slider.value.toFixed(1)}</span>
            </div>
            <input type="range" min="0" max="2" step="0.1" value={slider.value}
              onChange={e => slider.set(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-brand-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary" />
            <div className="flex justify-between text-[8px] text-brand-text-muted font-mono mt-1">
              <span>Precise</span><span>Creative</span>
            </div>
          </div>
        ))}
      </div>

      {/* Personality Matrix */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 space-y-5">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Personality Matrix
        </h2>

        {[
          { label: 'Tone', value: tone, set: setTone, left: 'Formal', right: 'Casual' },
          { label: 'Assertiveness', value: aggression, set: setAggression, left: 'Passive', right: 'Assertive' },
          { label: 'Humor', value: humor, set: setHumor, left: 'Serious', right: 'Playful' },
        ].map(slider => (
          <div key={slider.label}>
            <div className="flex justify-between mb-1.5">
              <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted">{slider.label}</label>
              <span className="text-xs font-mono font-bold text-white">{slider.value}%</span>
            </div>
            <input type="range" min="0" max="100" value={slider.value}
              onChange={e => slider.set(parseInt(e.target.value))}
              className="w-full h-1.5 bg-brand-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400" />
            <div className="flex justify-between text-[8px] text-brand-text-muted font-mono mt-1">
              <span>{slider.left}</span><span>{slider.right}</span>
            </div>
          </div>
        ))}

        {/* Mood */}
        <div>
          <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-2 block">Active Mood</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {filteredMoodCards.map(m => (
              <button key={m.key} onClick={() => setMood(m.key as any)}
                className={cn('p-3 rounded-xl border text-left transition-all',
                  mood === m.key ? m.color : 'bg-brand-elevated border-brand-border/50 text-brand-text-muted hover:border-brand-primary/30')}>
                <div className="text-xl mb-0.5">{m.emoji}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider">{m.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1.5 block">System Prompt Override</label>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            placeholder="Custom system instructions for the AI..."
            rows={3}
            className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text font-mono placeholder-brand-text-muted/40 focus:outline-none focus:border-brand-primary/50 transition-all resize-none" />
        </div>
      </div>

      {/* Test Chat */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 space-y-4">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-emerald-400" /> Test Chat
        </h2>
        <div className="flex gap-2">
          <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChat()}
            placeholder="Type a test message..."
            className="flex-1 bg-brand-elevated border border-brand-border/50 rounded-xl px-3.5 py-2.5 text-sm text-brand-text placeholder-brand-text-muted/40 focus:outline-none focus:border-brand-primary/50 transition-all" />
          <button onClick={handleChat} disabled={chatLoading || !chatMessage.trim()}
            className="px-4 py-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 text-xs font-bold">
            {chatLoading ? <Bot className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
            Test
          </button>
        </div>
        <AnimatePresence>
          {chatReply && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="p-4 bg-brand-elevated/30 border border-brand-border/30 rounded-xl">
              <p className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">AI Response</p>
              <p className="text-sm text-white leading-relaxed">{chatReply}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
