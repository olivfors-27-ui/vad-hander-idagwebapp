import { Check, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { geocode, type GeoHit } from "@/lib/geocode";
import { cn } from "@/lib/utils";

/**
 * Sökfält för riktiga adresser. Väljer användaren ett förslag hämtas
 * latitude/longitude från geokodningen och skickas till formuläret.
 */
export function AddressSearch({
  value,
  onSelect,
  onClear,
  placeholder = "Sök efter adress eller plats",
}: {
  value: GeoHit | null;
  onSelect: (hit: GeoHit) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!touched || query.trim().length < 3) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        setHits(await geocode(query, ctrl.signal));
      } catch {
        /* avbruten eller nätverksfel – behåll tidigare träffar tomma */
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, touched]);

  if (value) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-primary/50 bg-accent/50 p-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{value.short}</p>
          <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{value.label}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery("");
            setHits([]);
          }}
          aria-label="Byt adress"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onFocus={(e) =>
            e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })
          }
          onChange={(e) => {
            setTouched(true);
            setQuery(e.target.value);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {hits.length > 0 && (
        <ul className="absolute inset-x-0 top-14 z-40 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-float)]">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng},${h.label}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(h);
                  setHits([]);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary",
                )}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words">{h.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {touched && !loading && query.trim().length >= 3 && hits.length === 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Hittade ingen adress. Prova med gatunamn, nummer och ort.
        </p>
      )}
    </div>
  );
}
