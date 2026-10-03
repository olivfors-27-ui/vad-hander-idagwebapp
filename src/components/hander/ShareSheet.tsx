import { Check, Copy, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { appUrl } from "@/lib/app-url";

export type SharePreview = {
  /** Rubrik i förhandsvisningen, t.ex. "Vi borde göra något! 👀" */
  tagline: string;
  title: string;
  emoji: string;
  gradient?: string | undefined;
  /** Rad under titeln, t.ex. "Fredag 20:00 · Kungsan" */
  meta?: string | undefined;
  /** Uppmaning i förhandsvisningen */
  cta: string;
  /** Absolut URL som kopieras/delas */
  url: string;
  /** Kort URL som visas, t.ex. HANDER.APP/PLAN/AB72KQ */
  displayUrl: string;
  /** Text som följer med vid systemdelning */
  shareText: string;
};

/**
 * Delningsblad: förhandsvisning av länken som den ser ut i gruppchatten,
 * plus Kopiera länk och telefonens vanliga delningsfunktion.
 */
export function ShareSheet({
  open,
  onClose,
  preview,
}: {
  open: boolean;
  onClose: () => void;
  preview: SharePreview;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const copy = () => {
    navigator.clipboard?.writeText(preview.url);
    setCopied(true);
    toast.success("Länken är kopierad – klistra in i gruppchatten!");
  };

  const shareNative = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator
        .share({ title: preview.title, text: preview.shareText, url: preview.url })
        .catch(() => undefined);
      return;
    }
    copy();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="Stäng"
        className="sheet-backdrop absolute inset-0"
        onClick={onClose}
      />
      <div className="sheet-panel relative mx-auto w-full max-w-md rounded-t-3xl p-4 pb-8">
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-bold">Dela</p>
          <button
            type="button"
            aria-label="Stäng delning"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Förhandsvisning – så här ser länken ut i gruppchatten */}
        <div className="mt-3 overflow-hidden rounded-3xl border border-border">
          <div
            className="flex h-24 items-center justify-center"
            style={{ background: preview.gradient ?? "var(--accent)" }}
          >
            <span className="text-5xl">{preview.emoji}</span>
          </div>
          <div className="space-y-1 p-4">
            <p className="text-xs font-bold text-muted-foreground">{preview.tagline}</p>
            <p className="font-display text-lg font-bold leading-tight">{preview.title}</p>
            {preview.meta ? (
              <p className="text-sm font-semibold text-primary">{preview.meta}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{preview.cta}</p>
            <p className="break-all pt-1 font-mono text-[11px] font-bold text-muted-foreground">
              {preview.displayUrl}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3.5 text-sm font-bold"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "Kopierad!" : "Kopiera länk"}
          </button>
          <button
            type="button"
            onClick={shareNative}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-pin)]"
          >
            <Send className="h-4 w-4" /> Dela via…
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Mottagaren öppnar länken direkt – ingen app eller inloggning behövs.
        </p>
      </div>
    </div>
  );
}

/** Absolut URL till appen (miljövariabel i produktion, aktuell origin i dev). */
export function absoluteUrl(path: string): string {
  return appUrl(path);
}
