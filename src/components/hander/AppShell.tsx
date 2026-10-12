import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Bookmark, CalendarPlus, Home, Map, Plus, Search, User, Users } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
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

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <>
      <nav
        className="hander-bottom-nav absolute inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
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

export function AppShell({
  children,
  title,
  subtitle,
  bare,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string | undefined;
  bare?: boolean;
}) {
  return (
    <div className="relative mx-auto flex h-screen min-h-0 w-full max-w-md flex-col bg-background hander-phone">
      <div className="hander-notch" aria-hidden />
      {!bare && title ? (
        <>
          <TopBar title={title} subtitle={subtitle} />
          {/* Fyrfärgslinje som avdelare mellan topbar och resten av appen. */}
          <div className="hander-lines h-[4px] shrink-0" aria-hidden />
        </>
      ) : null}
      <main
        ref={(node) => {
          if (!node) return;
          if (title === "Karta") {
            node.scrollTop = savedMapScrollTop;
            node.onscroll = () => {
              savedMapScrollTop = node.scrollTop;
            };
          } else {
            node.scrollTop = 0;
          }
        }}
        className="relative z-10 flex-1 pb-[102px]"
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
