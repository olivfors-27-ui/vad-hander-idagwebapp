# Tagalong – Va Tagalong Idag?

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

## Design

Den befintliga identiteten är låst och ska bevaras vid varje ändring: varma
Stockholmstoner (korall `#E57657`, röd `#E45048`, orange `#E7A057`, gul `#EAB24F`,
periwinkle `#627BD8`, blå `#465BC4`), Montserrat, rundade kort, de sex
tunnelbanelinjerna, handritade squiggles och den extruderade 3d-kanten. Lägg till –
byt inte ut.

När nytt gränssnitt byggs ska det kännas avsiktligt designat, inte som generisk
AI-estetik:

- Typografi: behåll appens typsnitt; var noggrann med vikt, storlek och
  radavstånd i stället för att byta familj. Undvik Inter, Roboto och Arial.
- Färg: en dominerande varm yta med skarpa accenter ur paletten. Inga lila
  gradienter på vit bakgrund, ingen jämnt utsmetad regnbågspalett.
- Rörelse: få men välorkestrerade moment (staggered reveal vid sidladdning,
  hover-lyft, tryckfeedback). CSS först; respektera `prefers-reduced-motion`.
- Bakgrund: lager av mjuka gradienter och subtila mönster som ger djup, aldrig
  platta standardytor.
- Undvik färdiga komponentmönster som inte hör till kontexten. Variera mellan
  ljust och mörkt där det passar, men håll appens varma grundton.
