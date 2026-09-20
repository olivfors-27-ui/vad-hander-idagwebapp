import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { CATEGORIES } from "@/lib/hander-data";
import {
  activeFilterCount,
  defaultFilters,
  type DateFilter,
  type Filters,
  type PriceFilter,
  type SortMode,
  type TimeFilter,
  type VisibilityFilter,
  TIME_RANGES,
} from "@/lib/hander-store";
import { cn } from "@/lib/utils";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "filter-chip rounded-full border min-h-9 px-3.5 py-2 text-xs font-semibold transition-colors",
        active
          ? "border-[#E45048] bg-[#E45048] text-[#FFFDF9]"
          : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Divider i palettfärg mellan filtersektionerna, i bandets ordning. */
const SECTION_DIVIDERS = ["#E57657", "#E7A057", "#EAB24F", "#627BD8", "#465BC4"] as const;
function SectionDivider({ index }: { index: number }) {
  return (
    <div
      aria-hidden
      className="mb-4 h-[3px] w-full rounded-full"
      style={{ backgroundColor: SECTION_DIVIDERS[index % SECTION_DIVIDERS.length], opacity: 0.5 }}
    />
  );
}

export function FilterButton({
  filters,
  onOpen,
}: {
  filters: Filters;
  onOpen: () => void;
}) {
  const n = activeFilterCount(filters);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "map-filter-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-[var(--shadow-card)] transition-colors",
        n > 0 ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" />
      Filter
      {n > 0 && (
        <span className="rounded-full bg-primary-foreground/25 px-1.5 text-[11px]">{n}</span>
      )}
    </button>
  );
}

/** Snabbfilter-rad som alltid syns. */
export function QuickFilters({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const set = (p: Partial<Filters>) => setFilters({ ...filters, ...p });
  const toggleDate = (d: DateFilter) => set({ date: filters.date === d ? "alla" : d });
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      <Chip active={filters.date === "idag" && filters.time === "alla"} onClick={() => set({ date: filters.date === "idag" && filters.time === "alla" ? "alla" : "idag", time: "alla" })}>
        Idag
      </Chip>
      <Chip active={filters.date === "helg"} onClick={() => toggleDate("helg")}>
        Helgen
      </Chip>
      <Chip
        active={filters.price === "gratis"}
        onClick={() => set({ price: filters.price === "gratis" ? "alla" : "gratis" })}
      >
        Gratis
      </Chip>
      {CATEGORIES.slice(0, 6).map((c) => (
        <Chip
          key={c.id}
          active={filters.categories.includes(c.id)}
          onClick={() =>
            set({
              categories: filters.categories.includes(c.id)
                ? filters.categories.filter((x) => x !== c.id)
                : [...filters.categories, c.id],
            })
          }
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

export function FilterSheet({
  open,
  onClose,
  filters,
  setFilters,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);
  if (!open) return null;
  const set = (p: Partial<Filters>) => setDraft({ ...draft, ...p });

  const dates: { id: DateFilter; label: string }[] = [
    { id: "alla", label: "Alla datum" },
    { id: "idag", label: "Idag" },
    { id: "helg", label: "I helgen" },
  ];
  const times: { id: TimeFilter; label: string }[] = [
    { id: "alla", label: "Hela dygnet" },
    ...(Object.keys(TIME_RANGES) as Exclude<TimeFilter, "alla">[]).map((id) => ({
      id: id as TimeFilter,
      label: TIME_RANGES[id].label,
    })),
  ];
  const prices: { id: PriceFilter; label: string }[] = [
    { id: "alla", label: "Alla priser" },
    { id: "gratis", label: "Gratis" },
    { id: "under100", label: "Under 100 kr" },
  ];
  const vis: { id: VisibilityFilter; label: string }[] = [
    { id: "alla", label: "Alla" },
    { id: "public", label: "Publika" },
    { id: "private", label: "Privata" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Stäng filter"
        className="sheet-backdrop filter-sheet-backdrop absolute inset-0"
        onClick={onClose}
      />
      <div className="filter-sheet-panel relative max-h-[calc(100%-119px)] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Filter</h2>
          <button type="button" onClick={onClose} aria-label="Stäng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Kategori
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={draft.categories.includes(c.id)}
                onClick={() =>
                  set({
                    categories: draft.categories.includes(c.id)
                      ? draft.categories.filter((x) => x !== c.id)
                      : [...draft.categories, c.id],
                  })
                }
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </section>

        <SectionDivider index={0} />

        <section className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            När
          </p>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <Chip key={d.id} active={draft.date === d.id} onClick={() => set({ date: d.id })}>
                {d.label}
              </Chip>
            ))}
          </div>
        </section>

        <SectionDivider index={1} />

        <section className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Tid på dygnet
          </p>
          <div className="flex flex-wrap gap-2">
            {times.map((t) => (
              <Chip key={t.id} active={draft.time === t.id} onClick={() => set({ time: t.id })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </section>

        <SectionDivider index={2} />

        <section className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Pris
          </p>
          <div className="flex flex-wrap gap-2">
            {prices.map((p) => (
              <Chip key={p.id} active={draft.price === p.id} onClick={() => set({ price: p.id })}>
                {p.label}
              </Chip>
            ))}
          </div>
        </section>

        <SectionDivider index={3} />

        <section className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Publikt / privat
          </p>
          <div className="flex flex-wrap gap-2">
            {vis.map((v) => (
              <Chip
                key={v.id}
                active={draft.visibility === v.id}
                onClick={() => set({ visibility: v.id })}
              >
                {v.label}
              </Chip>
            ))}
          </div>
        </section>

        <SectionDivider index={4} />

        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Avstånd
            </p>
            <p className="text-xs font-bold">{draft.maxDistance} km</p>
          </div>
          <input
            type="range"
            min={0.5}
            max={25}
            step={0.5}
            value={draft.maxDistance}
            onChange={(e) => set({ maxDistance: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(defaultFilters)}
            className="flex-1 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground"
          >
            Rensa
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(draft);
              onClose();
            }}
            className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            Visa resultat
          </button>
        </div>
      </div>
    </div>
  );
}

const SORTS: { id: SortMode; label: string }[] = [
  { id: "relevans", label: "Relevans" },
  { id: "avstand", label: "Avstånd" },
  { id: "tid", label: "Tid" },
  { id: "popularitet", label: "Populärt" },
];

/** Sorteringsval som rad med chips. */
export function SortBar({ sort, setSort }: { sort: SortMode; setSort: (s: SortMode) => void }) {
  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Sortera
      </span>
      {SORTS.map((s) => (
        <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>
          {s.label}
        </Chip>
      ))}
    </div>
  );
}
