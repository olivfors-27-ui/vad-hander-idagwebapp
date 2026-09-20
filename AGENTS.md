# Händer – Va Händer Idag?

Social karta för events, fester och platser i Stockholm. Byggd med TanStack Start,
React, Tailwind CSS 4 och Vite. Pakethanterare: Bun (`bun.lock`).

## Utveckling

```bash
bun install
bun run dev          # dev-server på http://127.0.0.1:4173
bun run build        # produktionsbygge
```

## Projektstruktur

- `src/routes/` – TanStack Router-sidor (hem, karta, planer, vänner, sparat, profil m.m.)
- `src/components/hander/` – appens egna komponenter (karta, filter, toppbar m.m.)
- `src/lib/` – data, stores och API-integrationer (Visit Stockholm m.fl.)
- `src/integrations/supabase/` – Supabase-klienter (kräver env-variabler)

## Notera

- Kör inte `bun install` medan dev-servern körs.
- API-nycklar ska ligga i `.env` och aldrig committas.
