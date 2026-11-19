import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Home,
  LogOut,
  Map,
  MoreHorizontal,
  Plus,
  Repeat2,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDay, useHander } from "@/lib/hander-store";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { DesktopRightRail } from "@/components/hander/DesktopRightRail";

type Panel = "search" | "notifications" | null;

const RECENT_KEY = "hander-recent-searches";

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function rememberSearch(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecent().filter((v) => v.toLowerCase() !== trimmed.toLowerCase())];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 8)));
  } catch {
    /* sökhistoriken är en bekvämlighet, inte ett krav */
  }
}

function AppLogo({ expanded }: { expanded: boolean }) {
  return (
    <Link to="/" className="hander-logo" aria-label="Händer – till start">
      <span className="hander-logo-mark" aria-hidden>
        H
      </span>
      {expanded && (
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-extrabold leading-tight">
            Händer
          </span>
        </span>
      )}
    </Link>
  );
}

export function DesktopShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string | undefined;
  subtitle?: string | undefined;
}) {
  const store = useHander();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [panel, setPanel] = useState<Panel>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const closePanel = useCallback(() => setPanel(null), []);

  // Esc stänger panel och meny – samma regel som för modaler.
  useEffect(() => {
    if (!panel && !moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, moreOpen]);

  // Panelen hör till sidan den öppnades från; navigation stänger den.
  useEffect(() => {
    setPanel(null);
    setMoreOpen(false);
  }, [pathname]);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const isHome = pathname === "/";
  const isCreate = pathname === "/skapa";
  const isEvent = pathname.startsWith("/event/");

  // Skapa event visas som en centrerad modal på desktop; Esc stänger den.
  useEffect(() => {
    if (!isCreate) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void router.navigate({ to: "/" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCreate, router]);
  // Sidor som ritar sin egen rubrik (eller fyller ytan) ska inte få en extra.
  const ownHeading =
    isHome ||
    ["/sok", "/profil", "/karta", "/skapa", "/installningar"].some((path) => isActive(path)) ||
    pathname.startsWith("/event/") ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/privat/");
  const isWidePage = ["/sok", "/profil", "/installningar", "/karta", "/admin"].some((path) =>
    isActive(path),
  );

  const account = store.account;

  const navItems: {
    key: string;
    label: string;
    icon: typeof Home;
    avatar?: string | undefined;
    to?: string | undefined;
    onSelect?: (() => void) | undefined;
    active: boolean;
    badge?: number | undefined;
  }[] = [
    { key: "hem", label: "Hem", icon: Home, to: "/", active: pathname === "/" },
    { key: "karta", label: "Karta", icon: Map, to: "/karta", active: isActive("/karta") },
    {
      key: "sok",
      label: "Sök",
      icon: Search,
      onSelect: () => setPanel("search"),
      active: panel === "search",
    },
    {
      key: "notiser",
      label: "Notiser",
      icon: Bell,
      onSelect: () => setPanel("notifications"),
      active: panel === "notifications",
      badge: store.unreadNotifications,
    },
    {
      key: "skapa",
      label: "Skapa event",
      icon: Plus,
      to: "/skapa",
      active: isActive("/skapa"),
    },
    {
      key: "profil",
      label: "Profil",
      icon: UserRound,
      avatar: account?.avatarEmoji,
      to: "/profil",
      active: isActive("/profil"),
    },
  ];

  if (store.isModerator) {
    navItems.push({
      key: "granska",
      label: "Granska",
      icon: ShieldCheck,
      to: "/admin",
      active: isActive("/admin"),
      badge: store.pendingPublicEvents.length,
    });
  }

  const panelOpen = panel !== null;

  return (
    <div
      className="hander-desktop"
      data-panel={panelOpen ? "true" : "false"}
      data-layout={isHome ? "feed" : isWidePage ? "wide" : "page"}
    >
      <aside className="hander-desktop-sidebar" aria-label="Huvudnavigation">
        <div className="hander-sidebar-top">
          <AppLogo expanded={!panelOpen} />
        </div>

        <nav className="hander-sidebar-nav">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const className = cn(
                "hander-sidebar-item group",
                item.active && "is-active",
                item.key === "skapa" && "is-create",
              );
              const inner = (
                <>
                  <span className="hander-sidebar-icon">
                    {item.avatar ? (
                      <span className="hander-sidebar-avatar" aria-hidden>
                        {item.avatar}
                      </span>
                    ) : (
                      <Icon className="h-6 w-6" strokeWidth={item.active ? 2.6 : 2} />
                    )}
                  </span>
                  {!panelOpen && <span className="hander-nav-label">{item.label}</span>}
                  {item.badge ? (
                    <span className="hander-sidebar-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                  ) : null}
                </>
              );

              if (item.to) {
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={item.active ? "page" : undefined}
                      className={className}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.key}>
                  <button
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    aria-expanded={item.active}
                    onClick={item.onSelect}
                    className={className}
                  >
                    {inner}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hander-sidebar-bottom">
          {moreOpen && (
            <>
              <button
                type="button"
                aria-label="Stäng menyn"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMoreOpen(false)}
              />
              <div className="hander-more-menu" role="menu">
                <Link to="/installningar" role="menuitem" className="hander-more-item">
                  <Settings className="h-4 w-4" /> Inställningar
                </Link>
                <Link to="/loggain" role="menuitem" className="hander-more-item">
                  <Repeat2 className="h-4 w-4" /> Byt konto
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="hander-more-item"
                  onClick={() => {
                    void signOut().then(() => toast.success("Du är utloggad"));
                  }}
                >
                  <LogOut className="h-4 w-4" /> Logga ut
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            title="Mer"
            aria-label="Mer"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={cn("hander-sidebar-item", moreOpen && "is-active")}
          >
            <span className="hander-sidebar-icon">
              {account ? (
                <span className="hander-sidebar-avatar" aria-hidden>
                  {account.avatarEmoji}
                </span>
              ) : (
                <MoreHorizontal className="h-6 w-6" />
              )}
            </span>
            {!panelOpen && <span className="hander-nav-label">Mer</span>}
          </button>
        </div>
      </aside>

      {panelOpen && <div className="hander-panel-backdrop" onClick={closePanel} aria-hidden />}

      {panel === "search" && <SearchPanel onClose={closePanel} />}
      {panel === "notifications" && <NotificationsPanel onClose={closePanel} />}
      {isCreate && <div className="hander-modal-backdrop" aria-hidden />}

      <div className="hander-desktop-body">
        <main
          id="innehall"
          className={cn(
            "hander-desktop-main",
            pathname === "/karta" && "hander-desktop-main--map",
            pathname === "/skapa" && "hander-desktop-main--modal",
            isEvent && "hander-desktop-main--event",
          )}
        >
          {isCreate ? (
            <div className="hander-modal-card" role="dialog" aria-modal="true" aria-label="Skapa event">
              <button
                type="button"
                aria-label="Stäng"
                onClick={() => void router.navigate({ to: "/" })}
                className="hander-modal-close"
              >
                <X className="h-4 w-4" />
              </button>
              {children}
            </div>
          ) : (
            <>
              {title && !ownHeading && (
                <header className="hander-desktop-heading">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
                  {subtitle && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
                  )}
                </header>
              )}
              {children}
            </>
          )}
        </main>
        {isHome && <DesktopRightRail />}
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="hander-panel-header">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <div className="flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Stäng panelen"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const store = useHander();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => setRecent(readRecent()), []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return store.events
      .filter((event) =>
        `${event.name} ${event.place} ${event.address} ${event.description}`
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 8);
  }, [query, store.events]);

  const submit = () => {
    rememberSearch(query);
    setRecent(readRecent());
  };

  return (
    <aside className="hander-panel" role="dialog" aria-label="Sök" aria-modal="true">
      <PanelHeader title="Sök" onClose={onClose} />
      <div className="hander-panel-body">
        <div className="hander-search-field">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="Event, plats eller person"
            aria-label="Sök event, plats eller person"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        {query ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Träffar
            </p>
            {results.map((event) => (
              <Link
                key={event.id}
                to="/event/$id"
                params={{ id: event.id }}
                className="hander-panel-row"
                onClick={onClose}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{event.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDay(event.date)} · {event.place}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Inga träffar på ”{query}”.
              </p>
            )}
            {results.length > 0 && (
              <Link
                to="/sok"
                search={{ q: query }}
                onClick={() => {
                  submit();
                  onClose();
                }}
                className="block pt-1 text-sm font-bold text-primary"
              >
                Visa alla träffar
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Senaste sökningar
              </p>
              {recent.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-bold text-primary"
                  onClick={() => {
                    try {
                      localStorage.removeItem(RECENT_KEY);
                    } catch {
                      /* ignorera */
                    }
                    setRecent([]);
                  }}
                >
                  Rensa
                </button>
              )}
            </div>
            {recent.length ? (
              recent.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="hander-panel-row w-full text-left"
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{term}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Du har inga senaste sökningar än. Skriv något ovan.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

type Filter = "alla" | "vanner" | "svar" | "inbjudningar" | "foljer";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "alla", label: "Alla" },
  { id: "vanner", label: "Vänner" },
  { id: "svar", label: "Svar" },
  { id: "inbjudningar", label: "Inbjudningar" },
  { id: "foljer", label: "Följer" },
];

const KIND_FILTER: Record<string, Filter> = {
  follow: "foljer",
  social: "vanner",
  nearby: "vanner",
  plan: "svar",
  reminder: "inbjudningar",
  system: "inbjudningar",
};

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const store = useHander();
  const [filter, setFilter] = useState<Filter>("alla");

  const rows = store.notifications.filter(
    (n) => filter === "alla" || KIND_FILTER[n.kind] === filter,
  );
  const unread = rows.filter((n) => !store.readNotifications.includes(n.id));
  const earlier = rows.filter((n) => store.readNotifications.includes(n.id));

  return (
    <aside className="hander-panel" role="dialog" aria-label="Notiser" aria-modal="true">
      <PanelHeader title="Notiser" onClose={onClose}>
        <button
          type="button"
          onClick={() => store.markNotificationsRead()}
          className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Markera lästa
        </button>
      </PanelHeader>

      <div className="hander-panel-body">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                filter === item.id
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-bold">Inga notiser här än</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Spara eller markera event som intressanta – då dyker påminnelser upp här.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {unread.length > 0 && <NotificationGroup title="Nya" rows={unread} />}
            {earlier.length > 0 && <NotificationGroup title="Tidigare" rows={earlier} />}
          </div>
        )}
      </div>
    </aside>
  );
}

function NotificationGroup({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof useHander>["notifications"];
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-extrabold">{title}</h3>
      <div className="space-y-1">
        {rows.map((notification) => (
          <div key={notification.id} className="hander-panel-row items-start">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm">
              🔔
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{notification.text}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{notification.time}</p>
            </div>
            {notification.eventId && (
              <Link
                to="/event/$id"
                params={{ id: notification.eventId }}
                className="shrink-0 text-[11px] font-bold text-primary"
              >
                Visa
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
