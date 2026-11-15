'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp, Gavel, MessageCircle, Sparkles, X } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };
const welcome: Message = { role: 'assistant', content: 'Hi! I’m Bidi, your BIDORA auction buddy. Ask me about bidding, listing an item, payment time, or delivery.' };
const suggestions = ['How long does bidding stay open?', 'How do I list an item?', 'What if the winner doesn’t pay?'];

export function BidiChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, open]);

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setDraft(''); setBusy(true); setError('');
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-8), page: pathname }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Bidi could not reply right now.');
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
      setError(result.notice || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bidi could not reply right now.');
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return <div className="bidi-chat-root">
    {open && <section className="bidi-chat-panel" aria-label="Chat with Bidi" aria-live="polite">
      <header className="bidi-chat-header">
        <span className="bidi-avatar"><Gavel size={20}/><i><Sparkles size={10}/></i></span>
        <span className="bidi-chat-title"><strong>Bidi</strong><small>BIDORA auction buddy <b>·</b> Here to help</small></span>
        <button className="bidi-close" type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18}/></button>
      </header>
      <div className="bidi-chat-messages" ref={scrollRef}>
        {messages.map((message, index) => <div className={`bidi-message ${message.role}`} key={`${index}-${message.role}`}>
          {message.role === 'assistant' && <span className="bidi-message-avatar"><Gavel size={13}/></span>}
          <p>{message.content}</p>
        </div>)}
        {messages.length === 1 && <div className="bidi-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div>}
        {busy && <div className="bidi-typing" role="status"><span/><span/><span/> Bidi is thinking</div>}
        {error && <p className="bidi-chat-error" role="alert">{error}</p>}
      </div>
      <form className="bidi-chat-form" onSubmit={submit}>
        <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about an auction…" maxLength={700} aria-label="Your message" disabled={busy}/>
        <button type="submit" aria-label="Send message" disabled={!draft.trim() || busy}><ArrowUp size={17}/></button>
      </form>
      <p className="bidi-chat-note">Bidi shares auction guidance, not payment or account confirmations.</p>
    </section>}
    <button type="button" className={`bidi-chat-launch ${open ? 'is-open' : ''}`} onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close Bidi chat' : 'Ask Bidi for auction help'} aria-expanded={open}>
      {open ? <X size={22}/> : <><MessageCircle size={21}/><span>Ask Bidi</span></>}
      {!open && <i className="bidi-launch-spark"><Sparkles size={11}/></i>}
    </button>
  </div>;
}
