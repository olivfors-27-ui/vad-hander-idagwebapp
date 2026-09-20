# Händer – Va Händer Idag?

En social app för att hitta events, fester och platser i Stockholm – på en karta
eller i lista – tillsammans med vänner.

## Teknik

- TanStack Start + TanStack Router (React 19)
- Tailwind CSS 4 + Vite 8
- Bun som pakethanterare (`bun.lock`)
- Live-data från Visit Stockholms publika event-API

## Kom igång

```bash
bun install
bun run dev
```

Dev-servern startar på `http://127.0.0.1:4173` (öppna `/karta` för eventkartan).

## Skript

| Kommando | Beskrivning |
| --- | --- |
| `bun run dev` | Starta utvecklingsserver |
| `bun run build` | Produktionsbygge |
| `bun run preview` | Förhandsgranska produktionsbygget |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Miljövariabler

Kopiera `.env` vid behov. Lägg aldrig in riktiga API-nycklar i koden eller i git –
använd `.env` (gitignored) och flytta i framtiden nycklar till en server/edge-funktion
så att de aldrig hamnar i klienten.
