import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';

type ChatEntry = { role: 'user' | 'assistant'; content: string };

const GREETING: ChatEntry = {
  role: 'assistant',
  content:
    "Namaste! I'm the Paras Kachoriwala assistant. Ask me about our menu, today's prices, live availability, opening hours or how to reach us.",
};

const SUGGESTIONS = ['Are you open right now?', 'What is on the menu today?', 'Where are you located?'];

/**
 * Public shop assistant. Answers from live public data only; it has no access
 * to credentials, OTPs, admin data or customer data, and refuses such requests.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, open, sending]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;

    setInput('');
    setEntries((prev) => [...prev, { role: 'user', content: message }]);
    setSending(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: entries.slice(-6),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; reply?: string; error?: string }
        | null;

      if (response.ok && payload?.ok && payload.reply) {
        setEntries((prev) => [...prev, { role: 'assistant', content: payload.reply as string }]);
      } else {
        setEntries((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: payload?.error || 'Sorry, I could not answer just now. Please try again.',
          },
        ]);
      }
    } catch {
      setEntries((prev) => [
        ...prev,
        { role: 'assistant', content: 'I could not connect just now. Please check your connection and try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the shop assistant"
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-spice-600 px-4 py-3 text-sm font-semibold text-white shadow-warm transition-colors hover:bg-spice-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-spice-300 focus-visible:ring-offset-2"
        >
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Ask us</span>
        </button>
      )}

      {open && (
        <section
          aria-label="Shop assistant"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-spice-100 bg-white shadow-warm animate-scale-in sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px] origin-bottom-right"
        >
          <header className="flex items-start gap-3 bg-spice-600 px-4 py-3.5 text-white">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold leading-tight">Paras Kachoriwala</p>
              <p className="text-[11px] leading-tight text-white/80">Menu • Timings • Availability</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the shop assistant"
              className="shrink-0 rounded-full p-1.5 text-white/90 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto bg-spice-50/50 px-4 py-4"
          >
            {entries.map((entry, index) => (
              <p
                key={index}
                className={
                  entry.role === 'user'
                    ? 'ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-spice-600 px-3.5 py-2.5 text-sm leading-relaxed text-white'
                    : 'w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-charcoal-100 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-charcoal-800'
                }
              >
                {entry.content}
              </p>
            ))}

            {sending && (
              <p className="w-fit rounded-2xl rounded-bl-sm border border-charcoal-100 bg-white px-3.5 py-2.5">
                <span className="flex items-center gap-1" aria-label="Assistant is typing">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-spice-400" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-spice-400 [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-spice-400 [animation-delay:0.4s]" />
                </span>
              </p>
            )}

            {!sending && entries.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-spice-200 bg-white px-3 py-1.5 text-xs font-medium text-spice-700 transition-colors hover:bg-spice-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="border-t border-spice-100 bg-white px-3 py-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={600}
                placeholder="Ask about menu, timings, location…"
                aria-label="Your question"
                className="min-w-0 flex-1 rounded-full border border-charcoal-200 bg-charcoal-50/60 px-3.5 py-2.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-spice-400 focus:outline-none focus:ring-2 focus:ring-spice-200"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send question"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spice-600 text-white transition-colors hover:bg-spice-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-charcoal-400">
              Answers use live public shop information only. Never shares passwords, OTPs, keys or account data.
            </p>
          </form>
        </section>
      )}
    </>
  );
}
