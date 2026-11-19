import { cn } from "@/lib/utils";
import { SOURCE_TABS, type SourceTab } from "@/lib/event-source";

/**
 * Flikarna Events / Temporära / Båda. Samma innehåll på mobil och desktop –
 * bara formen skiljer sig: understruken flikrad på desktop, pillrad på mobil.
 */
export function SourceTabs({
  value,
  onChange,
  variant = "desktop",
  className,
}: {
  value: SourceTab;
  onChange: (next: SourceTab) => void;
  variant?: "desktop" | "mobile";
  className?: string;
}) {
  if (variant === "mobile") {
    return (
      <div
        className={cn("flex gap-1 rounded-full bg-[#F7E5D5] p-1", className ?? "mx-4")}
        role="tablist"
        aria-label="Visa fasta, event eller båda"
      >
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-xs font-bold transition-colors",
              value === tab.id
                ? "bg-[#E45048] text-[#FFFDF9] shadow-[0_2px_0_rgba(112,28,23,.2)]"
                : "text-[#8C7A6B]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="hander-source-tabs" role="tablist" aria-label="Visa fasta, event eller båda">
      {SOURCE_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn("hander-source-tab", value === tab.id && "is-active")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
