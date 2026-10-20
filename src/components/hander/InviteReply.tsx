import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { InviteStatus } from "@/lib/hander-data";
import { MAX_EVENT_GUESTS } from "@/lib/event-admin";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const OPTIONS = [
  ["accepted", "Kommer", "#3E9B5F", "rgba(62,155,95,.35)", "#EAF6EE"],
  ["maybe", "Kanske", "#D9A13B", "rgba(217,161,59,.4)", "#FBF3E2"],
  ["declined", "Kan inte", "#D9534F", "rgba(217,83,79,.35)", "#FBECEB"],
] as const;

/** Delar upp "musik, mat , musik" i ["musik", "mat"] – max 6 stycken. */
export function parseInterests(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,;]/)) {
    const tag = part.trim().slice(0, 30);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === 6) break;
  }
  return out;
}

/**
 * Svara på en inbjudan.
 *
 * Krav: ett namn måste alltid finnas innan svaret sparas. Inloggade får sitt
 * visningsnamn förifyllt men kan ändra det; utloggade skriver in det själva.
 * Intressen är frivilliga och sparas i databasen så att alla som är med i
 * eventet kan se dem.
 */
export function InviteReply({
  loggedIn,
  accountName,
  answered,
  savedName,
  savedInterests,
  full = false,
  disabled = false,
  onReply,
}: {
  loggedIn: boolean;
  accountName?: string | undefined;
  /** Svar gästen redan gett (om något), visas som vald. */
  answered?: InviteStatus | undefined;
  /** Namnet gästen skrev när hen svarade – förifylls i fältet. */
  savedName?: string | undefined;
  /** Intressen gästen redan angett – förifylls i fältet. */
  savedInterests?: string[] | undefined;
  /** Eventet har nått max antal deltagare. */
  full?: boolean | undefined;
  disabled?: boolean | undefined;
  onReply: (status: Exclude<InviteStatus, "invited">, name: string, interests: string[]) => void;
}) {
  const [name, setName] = useState(savedName ?? accountName ?? "");
  const [interestsText, setInterestsText] = useState((savedInterests ?? []).join(", "));
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Kontonamnet kan komma efter första rendern – fyll bara i om fältet är tomt.
  useEffect(() => {
    if (!savedName && accountName) {
      setName((current) => (current.trim() ? current : accountName));
    }
  }, [accountName, savedName]);

  // Gästlistan kan laddas efter första rendern – ta då med sparade intressen.
  useEffect(() => {
    if (savedInterests?.length) {
      setInterestsText((current) => (current.trim() ? current : savedInterests.join(", ")));
    }
  }, [savedInterests]);

  const effectiveName = name.trim();
  const interests = parseInterests(interestsText);
  // Den som redan svarat är redan med (eller har tackat nej) och får ändra sig
  // även när eventet är fullt.
  const blockedByLimit = full && !answered;

  const submit = (s: InviteStatus) => {
    if (blockedByLimit) {
      toast.error(`Eventet är fullt (max ${MAX_EVENT_GUESTS} deltagare).`);
      return;
    }
    if (!effectiveName) {
      setShowError(true);
      toast.error("Skriv in ditt namn innan du svarar.");
      inputRef.current?.focus();
      return;
    }
    setShowError(false);
    onReply(s as Exclude<InviteStatus, "invited">, effectiveName, interests);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <label
          htmlFor="invite-reply-name"
          className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          Ditt namn (obligatoriskt)
        </label>
        <input
          id="invite-reply-name"
          ref={inputRef}
          className={cn(field, showError && !name.trim() && "border-destructive")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setShowError(false);
          }}
          placeholder="T.ex. Oliver"
          autoComplete="name"
          required
          aria-required="true"
          aria-invalid={showError && !name.trim() ? true : undefined}
          aria-describedby={showError && !name.trim() ? "invite-reply-name-error" : undefined}
          autoFocus={!loggedIn}
        />
        {loggedIn && (
          <p className="text-[11px] text-muted-foreground">
            Förifyllt från ditt konto – ändra om du vill presentera dig annorlunda.
          </p>
        )}
        {showError && !name.trim() && (
          <p
            id="invite-reply-name-error"
            role="alert"
            className="text-xs font-semibold text-destructive"
          >
            Skriv in ditt namn innan du svarar.
          </p>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <label
          htmlFor="invite-reply-interests"
          className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          Dina intressen (frivilligt)
        </label>
        <input
          id="invite-reply-interests"
          className={field}
          value={interestsText}
          onChange={(e) => setInterestsText(e.target.value)}
          placeholder="T.ex. musik, fotboll, mat"
          autoComplete="off"
          aria-describedby="invite-reply-interests-help"
        />
        <p id="invite-reply-interests-help" className="text-[11px] text-muted-foreground">
          Separera med kommatecken. Intressena syns för alla som är med i eventet.
        </p>
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Dina intressen">
            {interests.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-[#F7E5D5] px-2.5 py-1 text-[11px] font-bold text-[#8A4A1F]"
              >
                <Sparkles className="h-3 w-3" aria-hidden /> {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Svara på inbjudningen
      </p>
      {blockedByLimit && (
        <p
          role="status"
          className="mt-2 rounded-xl bg-[#FBECEB] px-3 py-2 text-xs font-bold text-[#B03A36]"
        >
          Eventet är fullt – max {MAX_EVENT_GUESTS} deltagare.
        </p>
      )}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {OPTIONS.map(([s, lbl, tone, shadow, soft]) => (
          <button
            key={s}
            type="button"
            disabled={disabled || blockedByLimit}
            onClick={() => submit(s)}
            aria-pressed={answered === s}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-2xl px-3 py-3 text-xs font-bold transition-colors active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50",
              answered === s
                ? "text-[#FFFDF9] shadow-[0_3px_0_var(--tw-shadow-color)]"
                : "border border-border",
            )}
            style={
              answered === s
                ? ({ backgroundColor: tone, "--tw-shadow-color": shadow } as React.CSSProperties)
                : { backgroundColor: soft, color: tone }
            }
          >
            {answered === s && <Check className="h-3.5 w-3.5" aria-hidden />}
            {lbl}
          </button>
        ))}
      </div>

      {answered && (
        <p className="mt-2 text-sm font-semibold text-[#2A2421]">
          Du har svarat “
          {answered === "accepted"
            ? "Kommer"
            : answered === "maybe"
              ? "Kanske"
              : answered === "declined"
                ? "Kan inte"
                : "Inbjuden"}
          ”.
        </p>
      )}
    </div>
  );
}
