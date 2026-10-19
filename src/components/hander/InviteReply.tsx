import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { InviteStatus } from "@/lib/hander-data";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const OPTIONS = [
  ["accepted", "Kommer", "#3E9B5F", "rgba(62,155,95,.35)", "#EAF6EE"],
  ["maybe", "Kanske", "#D9A13B", "rgba(217,161,59,.4)", "#FBF3E2"],
  ["declined", "Kan inte", "#D9534F", "rgba(217,83,79,.35)", "#FBECEB"],
] as const;

/**
 * Svara på en inbjudan.
 *
 * Krav: ett namn måste finnas innan svaret sparas –
 * inloggade svarar med kontots visningsnamn (punkt 2),
 * utloggade måste skriva in ett namn i det obligatoriska fältet (punkt 1).
 */
export function InviteReply({
  loggedIn,
  accountName,
  answered,
  savedName,
  disabled = false,
  onReply,
}: {
  loggedIn: boolean;
  accountName?: string | undefined;
  /** Svar gästen redan gett (om något), visas som vald. */
  answered?: InviteStatus | undefined;
  /** Namnet gästen skrev när hen svarade – förifylls i fältet. */
  savedName?: string | undefined;
  disabled?: boolean | undefined;
  onReply: (status: Exclude<InviteStatus, "invited">, name: string) => void;
}) {
  const [name, setName] = useState(savedName ?? "");
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveName = loggedIn ? (accountName ?? "").trim() : name.trim();

  const submit = (s: InviteStatus) => {
    if (!effectiveName) {
      setShowError(true);
      toast.error("Skriv in ditt namn innan du svarar.");
      inputRef.current?.focus();
      return;
    }
    setShowError(false);
    onReply(s as Exclude<InviteStatus, "invited">, effectiveName);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {loggedIn ? (
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Svarar som <span className="normal-case text-foreground">{accountName || "du"}</span>
        </p>
      ) : (
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
            autoFocus
          />
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
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Svara på inbjudningen
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {OPTIONS.map(([s, lbl, tone, shadow, soft]) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => submit(s)}
            aria-pressed={answered === s}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-2xl px-3 py-3 text-xs font-bold transition-colors active:translate-y-[2px]",
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
