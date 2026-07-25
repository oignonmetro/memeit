import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useChatVisible } from '../hooks/useChatVisible';
import { playerColor } from '../lib/playerColor';
import { MAX_CHAT_LENGTH } from '../types';

export default function Chat() {
  const visible = useChatVisible();
  const code = useGameStore((s) => s.code);
  const role = useGameStore((s) => s.role);
  const selfId = useGameStore((s) => s.selfId);
  const chat = useGameStore((s) => s.chat);
  const chatOrder = useGameStore((s) => s.chatOrder);
  const sendChat = useGameStore((s) => s.sendChat);

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(chat.length);

  // New-room baseline: existing history is never counted as unread.
  useEffect(() => {
    prevCountRef.current = chat.length;
    setUnread(0);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Unread counter: bump while the panel is closed and messages arrive.
  useEffect(() => {
    const prev = prevCountRef.current;
    if (chat.length === prev) return;
    prevCountRef.current = chat.length;
    if (!open && chat.length > prev) {
      setUnread((u) => u + (chat.length - prev));
    }
  }, [chat.length, open]);

  // Stick to the bottom when open and on each new message.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, chat.length]);

  const openChat = () => {
    setUnread(0);
    setOpen(true);
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText('');
    try {
      await sendChat(value);
    } catch {
      setText(value);
    } finally {
      setSending(false);
    }
  }

  // All hooks above run unconditionally; only now do we decide whether to render.
  if (!visible || role !== 'player' || !code) return null;

  return (
    <>
      <button className="chat-fab" aria-label="Ouvrir le chat" onClick={openChat}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {unread > 0 && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="chat-overlay" onClick={() => setOpen(false)}>
          <div className="chat-panel" role="dialog" aria-label="Chat" onClick={(e) => e.stopPropagation()}>
            <header className="chat-panel__header">
              <h2>Chat</h2>
              <button className="chat-panel__close" aria-label="Fermer" onClick={() => setOpen(false)}>✕</button>
            </header>

            <div className="chat-messages" ref={listRef}>
              {chat.length === 0 ? (
                <p className="chat-empty">Aucun message. Lancez la conversation !</p>
              ) : (
                chat.map((m) => {
                  const mine = m.playerId === selfId;
                  return (
                    <div key={m.id} className={`chat-msg${mine ? ' chat-msg--mine' : ''}`}>
                      {!mine && (
                        <span className="chat-msg__name" style={{ color: playerColor(chatOrder, m.playerId) }}>
                          {m.name}
                        </span>
                      )}
                      <span className="chat-msg__bubble">{m.text}</span>
                    </div>
                  );
                })
              )}
            </div>

            <form className="chat-input" onSubmit={handleSend}>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Votre message…"
                maxLength={MAX_CHAT_LENGTH}
                autoFocus
              />
              <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 16px' }} type="submit" disabled={!text.trim() || sending}>
                Envoyer
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
