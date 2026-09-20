# Händer – produktstruktur och riktning

## Kärna

Händer hjälper unga människor och kompisgäng att svara på frågan:

> **"Vad ska vi göra?"**

Händer är inte en traditionell eventkalender. Det är en kombination av:

- En modern social app
- Ett verktyg för att upptäcka saker att göra
- En interaktiv karta
- Ett enkelt sätt att planera med kompisar

## Kärnflödet

```text
Öppna Händer
  → Upptäck något
  → "Det där vill vi göra!"
  → Planera med kompisar
  → Skapa en plan
  → Dela länk i gruppchatten
  → Alla svarar (utan konto)
  → Händer visar vad som fungerar bäst
  → Planen bestäms
  → Vi kör!
```

## Produktprinciper

1. **Prioritera enkelhet.** Varje sida har ett tydligt huvudsyfte.
2. **Mobilen först.** Länkar delas i meddelandeappar och öppnas på mobilen.
3. **Ingen friktion för mottagaren.** Kompisar svarar på planer utan konto eller app.
4. **Befintlig data först.** Nya funktioner bygger på befintliga events/platser innan ny data hittas på.

## Designprincip

"Färgstark och energisk i detaljerna – ren och enkel i helheten."

Modern, ungdomlig, social, energisk, lekfull men stilren. Aldrig corporate.

## Sidans syften (en sida = ett syfte)

| Sida | Huvudsyfte |
| --- | --- |
| `/` Upptäck | Svara på "Vad ska vi göra?" – hitta något |
| `/karta` | Se var saker händer |
| `/planer` | Mitt gäng: aktiva och tidigare planer, "+ Ny plan" |
| `/skapa-plan` | Skapa plan på <30 sek, få delbar länk |
| `/plan/:id` | Skaparens översikt: svar, bästa alternativ, bestäm |
| `/p/:code`, `/plan/:code` | Mottagaren: förstå på <5 sek, svara utan konto |
| `/overraska` | "Vi vet inte vad" – låt Händer välja åt gänget |
| `/sparat`, `/profil` | Stödfunktioner |

## Mål för upplevelsen

- En användare hittar något roligt, skapar en plan och skickar den till kompisgänget på **< 30 sekunder**.
- En kompis som aldrig använt Händer öppnar länken och förstår vad den ska göra på **< 5 sekunder**.

## Kommande utveckling (riktning)

1. Förenkla Upptäck ytterligare – färre samtidiga sektioner, tydligare väg till planering.
2. Djupare koppling Överraska oss → Plan (även för platser utan event).
3. Notiser kopplade till plan-svar (idag generiska).
4. Riktig delningsförhandsvisning (og-bilder per plan).
