import { useEffect, useState } from "react";

const KEY = "hander-intro-v1";

const STEPS = [
  {
    emoji: "🧭",
    title: "Hitta något",
    text: "Upptäck events, platser och oväntade aktiviteter nära dig.",
  },
  {
    emoji: "📣",
    title: "Planera med kompisar",
    text: "Skapa en plan på sekunder och dela länken i gruppchatten.",
  },
  {
    emoji: "✅",
    title: "Bestäm – och kör",
    text: "Alla svarar utan konto. Händer visar vad som funkar bäst för gänget.",
  },
];

export function IntroSheet() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  const close = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Välkommen till Händer"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-pin)]">
        <p className="text-center text-3xl" aria-hidden>
          👋
        </p>
        <h2 className="mt-2 text-center font-display text-xl font-bold">
          Vad ska ni göra?
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Händer hjälper ditt kompisgäng att hitta något roligt – och bestämma det utan hundra meddelanden.
        </p>
        <ol className="mt-5 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-2xl bg-secondary/70 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-lg" aria-hidden>
                {s.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-xs text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={close}
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)] transition-transform active:scale-[0.98]"
        >
          Kom igång
        </button>
      </div>
    </div>
  );
}
