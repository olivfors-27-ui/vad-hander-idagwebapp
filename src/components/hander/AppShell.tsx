import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  CalendarPlus,
  Home,
  Map,
  MapPin,
  Plus,
  Search,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { EventCover } from "@/components/hander/EventBits";
import { useHander } from "@/lib/hander-store";
import { cn } from "@/lib/utils";

let savedMapScrollTop = 0;

const NAV_LEFT = [
  { to: "/", label: "Hem", icon: Home },
  { to: "/karta", label: "Karta", icon: Map },
] as const;

const NAV_RIGHT = [
  { to: "/vanner", label: "Vänner", icon: Users },
  { to: "/sparat", label: "Sparat", icon: Bookmark },
] as const;

/** Vänstermenyn på desktop – samma destinationer som bottennavet plus sök/notiser. */
const DESKTOP_NAV = [
  { to: "/", label: "Hem", icon: Home },
  { to: "/karta", label: "Karta", icon: Map },
  { to: "/sok", label: "Sök", icon: Search },
  { to: "/skapa", label: "Skapa event", icon: CalendarPlus },
  { to: "/vanner", label: "Vänner", icon: Users },
  { to: "/sparat", label: "Sparat", icon: Bookmark },
  { to: "/notiser", label: "Notiser", icon: Bell },
  { to: "/profil", label: "Profil", icon: User },
] as const;

export function TopBar({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  const { unreadNotifications } = useHander();
  return (
    <header className="shrink-0 sticky top-0 z-30 hander-topbar">
      <div className="hander-topbar-inner flex items-center justify-between gap-3 px-4 pb-3 pt-3.5">
        {/* Neutral cirkel som placeholder för appens logotyp. */}
        <div
          className="hander-logo-placeholder h-9 w-9 shrink-0 rounded-full"
          aria-label="Logotyp"
          role="img"
        />
        {/* Underrubrikplatsen reserveras alltid så att titeln ligger på samma nivå på alla sidor. */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[19px] font-bold leading-tight">{title}</h1>
          <p
            className={cn("truncate text-xs text-muted-foreground", !subtitle && "invisible")}
            aria-hidden={!subtitle}
          >
            {subtitle ?? "\u00A0"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/sok"
            aria-label="Sök"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="h-[17px] w-[17px]" />
          </Link>
          <Link
            to="/notiser"
            aria-label="Notiser"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadNotifications}
              </span>
            )}
          </Link>
          <Link
            to="/profil"
            aria-label="Din profil"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <User className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Sidhuvud för desktop: sidtitel, underrubrik och snabbåtgärder.
 * Ersätter mobilens topbar, som är dold från lg och uppåt.
 */
function DesktopPageHeader({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  const { unreadNotifications } = useHander();
  return (
    <header className="hidden shrink-0 items-center gap-4 border-b border-border bg-background/90 px-7 py-4 backdrop-blur lg:flex">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[26px] font-extrabold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          to="/sok"
          aria-label="Sök"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="h-[19px] w-[19px]" />
        </Link>
        <Link
          to="/notiser"
          aria-label="Notiser"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="h-[19px] w-[19px]" />
          {unreadNotifications > 0 && (
            <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadNotifications}
            </span>
          )}
        </Link>
        <Link
          to="/profil"
          aria-label="Din profil"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <User className="h-[19px] w-[19px]" />
        </Link>
      </div>
    </header>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        aria-label={label}
        className={cn(
          "hander-nav-item flex h-14 w-14 items-center justify-center rounded-full transition-colors",
          active ? "hander-nav-item--active" : "text-white/60 hover:text-white",
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={active ? 2.6 : 2} />
      </Link>
    </li>
  );
}

const isPathActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname.startsWith(to);

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) => isPathActive(pathname, to);

  return (
    <>
      <nav
        className="hander-bottom-nav absolute inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Huvudnavigation"
      >
        <ul className="flex items-center justify-around px-4 py-3">
          {NAV_LEFT.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} active={isActive(to)} />
          ))}
          <li className="flex items-center">
            <Link
              to="/skapa"
              aria-label="Skapa event"
              className="-mt-9 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#627BD8] text-white shadow-[0_8px_22px_-6px_rgba(98,123,216,0.55)] ring-[5px] ring-[#2A2421] transition-transform active:scale-95 hander-fab"
            >
              <Plus className="h-8 w-8" strokeWidth={2.6} />
            </Link>
          </li>
          {NAV_RIGHT.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} active={isActive(to)} />
          ))}
        </ul>
      </nav>
    </>
  );
}

/**
 * Vänsterkolumn på desktop: logotyp och vertikal navigation med etiketter,
 * i samma stil som Instagrams sidomeny.
 */
function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { unreadNotifications } = useHander();

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col bg-card px-3 pb-5 pt-6 lg:flex">
      <Link
        to="/"
        aria-label="Tagalong – till startsidan"
        className="mb-7 flex items-center gap-2.5 px-2.5"
      >
        <span className="hander-logo-placeholder h-10 w-10 shrink-0 rounded-full" aria-hidden />
        <span className="font-display text-[22px] font-extrabold leading-none tracking-tight">
          Tagalong
        </span>
      </Link>

      <nav aria-label="Huvudnavigation" className="flex flex-1 flex-col gap-0.5">
        {DESKTOP_NAV.map(({ to, label, icon: Icon }) => {
          const active = isPathActive(pathname, to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-[15px] transition-colors",
                active
                  ? "bg-secondary font-bold text-foreground"
                  : "font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.6 : 2} />
              <span className="truncate">{label}</span>
              {to === "/notiser" && unreadNotifications > 0 ? (
                <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {unreadNotifications}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-1.5 border-t border-border pt-4">
        <Link
          to="/planer"
          className="flex items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          Planer & inbjudningar
        </Link>
        <p className="px-3 pt-1 text-[11px] leading-relaxed text-muted-foreground">
          Hitta skoj i Stockholm idag – utan konto.
        </p>
      </div>
    </aside>
  );
}

/**
 * Högerkolumn på desktop: profil/inloggning, populära event och genvägar.
 * Visas bara på startsidan och först när det finns plats (≥1280px).
 */
function DesktopRail() {
  const { account, publicEvents, interestedCount } = useHander();
  const popular = publicEvents
    .filter((e) => !(e.sponsored || e.promoted))
    .sort((a, b) => interestedCount(b) - interestedCount(a))
    .slice(0, 5);

  return (
    <aside
      aria-label="Sidoinformation"
      className="hidden w-[300px] shrink-0 flex-col gap-6 overflow-y-auto py-8 pl-6 pr-1 xl:flex"
    >
      {account ? (
        <Link
          to="/profil"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-2xl"
            aria-hidden
          >
            {account.avatarEmoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{account.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              @{account.username}
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-primary">Profil</span>
        </Link>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold">Häng på det som händer</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Logga in för att spara event, bjuda in kompisar och skapa egna planer.
          </p>
          <Link
            to="/loggain"
            className="mt-3 flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Logga in
          </Link>
        </div>
      )}

      <section aria-labelledby="rail-popular">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2
            id="rail-popular"
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Populärt just nu
          </h2>
          <Link to="/sok" className="text-[11px] font-bold text-primary hover:underline">
            Se alla
          </Link>
        </div>
        <ul className="mt-2 space-y-0.5">
          {popular.map((event) => (
            <li key={event.id}>
              <Link
                to="/event/$id"
                params={{ id: event.id }}
                className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-secondary/60"
              >
                <EventCover event={event} className="h-11 w-11 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight">
                    {event.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{event.place}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {popular.length === 0 ? (
            <li className="px-1 py-2 text-xs text-muted-foreground">Inga event just nu.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-auto border-t border-border pt-4">
        <nav
          aria-label="Fler sidor"
          className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground"
        >
          <Link to="/planer" className="hover:text-foreground hover:underline">
            Planer
          </Link>
          <Link to="/arrangor" className="hover:text-foreground hover:underline">
            Arrangör
          </Link>
          <Link to="/skapa" className="hover:text-foreground hover:underline">
            Skapa event
          </Link>
          <Link to="/foljer" className="hover:text-foreground hover:underline">
            Följer
          </Link>
        </nav>
        <p className="mt-3 text-[11px] text-muted-foreground">© {new Date().getFullYear()} Tagalong</p>
      </section>
    </aside>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  bare,
  rail,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string | undefined;
  bare?: boolean;
  /** Visa högerkolumnen på desktop (startsidan). */
  rail?: boolean;
}) {
  const mainRef = useRef<HTMLElement | null>(null);

  // Ref-callbacken måste vara stabil. En inline-arrow får ny identitet vid VARJE
  // rendering, och då anropar React den igen (null följt av noden) – vilket
  // nollställde scrollen mitt i en interaktion, t.ex. när man skrev i ett fält.
  const setMainRef = useCallback((node: HTMLElement | null) => {
    mainRef.current = node;
  }, []);

  // Scrollen nollställs bara när sidan faktiskt byts (AppShell monteras om),
  // aldrig vid en vanlig omrendering. Kartan minns sin position.
  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;
    if (title === "Karta") {
      node.scrollTop = savedMapScrollTop;
      const remember = () => {
        savedMapScrollTop = node.scrollTop;
      };
      node.addEventListener("scroll", remember, { passive: true });
      return () => node.removeEventListener("scroll", remember);
    }
    node.scrollTop = 0;
    return undefined;
  }, [title]);

  return (
    <div className="relative mx-auto flex h-svh min-h-0 w-full max-w-md flex-col bg-background hander-phone">
      <DesktopSidebar />
      <div className="hander-notch lg:hidden" aria-hidden />
      {!bare && title ? (
        <div className="shrink-0 lg:hidden">
          <TopBar title={title} subtitle={subtitle} />
          {/* Fyrfärgslinje som avdelare mellan topbar och resten av appen. */}
          <div className="hander-lines h-[4px] shrink-0" aria-hidden />
        </div>
      ) : null}
      {/* Innehållskolumnen: sidhuvud + scrollande innehåll. På mobil är sidhuvudet
          dolt och kolumnen beter sig precis som tidigare. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!bare && title ? <DesktopPageHeader title={title} subtitle={subtitle} /> : null}
        <main
          ref={setMainRef}
          className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] lg:border-x lg:border-border lg:pb-10"
        >
          {/* På desktop hålls innehållet i en läsbar mittkolumn i stället för att
              sträckas ut över hela skärmen. Mobilvyn påverkas inte. */}
          <div className="lg:mx-auto lg:w-full lg:max-w-[920px]">{children}</div>
        </main>
      </div>
      <BottomNav />
      {rail ? <DesktopRail /> : null}
    </div>
  );
}
