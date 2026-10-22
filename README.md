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

Kopiera `.env.example` till `.env`. Lägg aldrig in riktiga API-nycklar i koden eller i
git – använd `.env` (gitignored).

| Variabel | Beskrivning |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase-projektets URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publik anon-nyckel (skyddas av RLS) |
| `VITE_APP_URL` | Appens publika bas-URL, används i inbjudnings- och bekräftelselänkar. Får inte vara `localhost` i produktion. |
| `VITE_SPONSOR_PRICE` | Sponsringspris i kronor (standard `99`) |
| `VITE_SPONSOR_SWISH` | Swish-nummer för sponsring (standard `0793045840`) |

## Supabase

Snabbaste vägen: klistra in **`supabase/APPLY-ALL.sql`** i SQL Editor och kör en gång.
Filen är alla migrationer i ordning, är idempotent och skriver ut kontrollfrågor på
slutet (förväntat: 8 tabeller, 7 funktioner, `sponsor_status` på `public_events`).

Har den körts halvvägs tidigare (t.ex. stoppat på ett fel), kör om **hela filen**
från början – inte bara resten. Den klarar också ett projekt där `public_events`
redan finns med den gamla kolumnen `sponsored`: flaggan flyttas över till
`sponsor_status` och kolumnen tas bort.

Alternativt, kör migrationerna i `supabase/migrations/` **i filnamnsordning**. De är
idempotenta (kan köras om) och skapar allt appen behöver:

1. `20260901144827_…sql` – `plans` + `plan_replies` (delade planer)
2. `20260930120000_auth_profiles.sql` – `profiles` med trigger som skapar en
   sökbar profil (namn + användarnamn) för varje nytt konto
3. `20261015090000_private_event_invites.sql` – `private_events` + RPC:er för
   inbjudningslänkar med token
4. `20261019090000_profiles_moderation_sponsorship.sql` – `username`,
   `is_moderator`, `follows`, `public_events` (status + sponsring) och RPC:erna
   `moderate_public_event` / `sponsor_public_event`
5. `20261020120000_event_interests_limits_delete.sql` – gästintressen, max 10
   deltagare, max 5 event per konto och `delete_event`
6. `20261022120000_visibility_views_sweden.sql` – inbjudnings-RPC:er med
   pgcrypto i `search_path`, tidsordning/Sverige-kontroller, vyn
   `visible_public_events` (3 h efter slut, annars 4 h efter start) och unika
   besökare i `event_views` + `record_event_view` / `event_view_counts`

Saknas `public.profiles` får appen inga sökträffar på personer alls – det är det
vanligaste tecknet på att steg 2 inte har körts. Kontrollera med:

```sql
select table_name from information_schema.tables where table_schema = 'public';
```

`supabase/SETUP-NYTT-PROJEKT.sql` är den äldre engångsfilen för plans + enkel
profil (utan användarnamn/moderering) – använd migrationerna ovan i stället.

Under **Authentication → URL Configuration** i Supabase-dashboarden:

- **Site URL**: appens publika bas-URL, samma värde som `VITE_APP_URL`.
- **Redirect URLs**: `<VITE_APP_URL>/auth/callback` (dit bekräftelsemejlet går och
som sedan visar tack-sidan `/valkommen`) samt `<VITE_APP_URL>/valkommen`.

Koden skickar `emailRedirectTo: <VITE_APP_URL>/auth/callback` vid registrering,
så `VITE_APP_URL` måste vara appens riktiga publika adress – aldrig `localhost`.

Moderatorrollen ligger i `public.moderators` och är pinnad på konto-id, inte på
användarnamn – den som registrerar "oliver" i efterhand får aldrig rollen.
Första körningen av migration 3 fångar de två konton som då heter `oliver` och
`william`. Kontrollera efteråt:

```sql
select p.username, p.is_moderator
from public.profiles p join public.moderators m on m.user_id = p.id;
```

Saknas någon av dem (t.ex. om kontot skapades efter migrationen) läggs id:t in
för hand – flaggan i `profiles` uppdateras automatiskt av en trigger:

```sql
insert into public.moderators (user_id)
select id from public.profiles where username = 'oliver'
on conflict (user_id) do nothing;
```

Sponsring har en egen status i databasen: `public_events.sponsor_status` är
`none` eller `sponsored` och sätts bara av RPC:n `sponsor_public_event` efter att
eventet godkänts.
