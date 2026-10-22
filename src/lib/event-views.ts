// Unika besökare per event.
//
// Varje person räknas en gång per event, oavsett hur många gånger eventet
// öppnas. Inloggade identifieras av sitt konto i databasen; utloggade av ett
// persistent id i localStorage (bästa möjliga approximation). Unikheten
// garanteras av primärnyckeln (event_id, viewer_key) i public.event_views.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VIEWER_STORAGE_KEY = "hander-viewer-id";

/** Stabilt id för den här webbläsaren. Skapas första gången det behövs. */
export function anonymousViewerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(VIEWER_STORAGE_KEY);
    if (stored && /^[0-9a-f-]{8,64}$/i.test(stored)) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(VIEWER_STORAGE_KEY, created);
    return created;
  } catch {
    // Privat läge utan localStorage: besöket kan inte identifieras och räknas
    // därför inte, i stället för att räknas om vid varje sidladdning.
    return null;
  }
}

/**
 * Loggar att någon öppnat eventet. Databasen dedupliserar, så det är ofarligt
 * att anropa den igen. Fel får aldrig störa sidan.
 */
export async function recordEventView(eventId: string): Promise<void> {
  try {
    await supabase.rpc("record_event_view", {
      p_event_id: eventId,
      p_anonymous_id: anonymousViewerId(),
    });
  } catch {
    /* statistik är inte värd att visa ett fel för besökaren */
  }
}

/** Antal unika besökare per event för inloggad arrangör. */
export async function fetchEventViewCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("event_view_counts");
  if (error) throw error;
  return (data ?? {}) as Record<string, number>;
}

/** Hämtar siffrorna en gång när panelen öppnas. */
export function useEventViewCounts(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    void fetchEventViewCounts()
      .then((next) => {
        if (active) setCounts(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return counts;
}
