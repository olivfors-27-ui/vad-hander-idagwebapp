/**
 * Text-hjälp för visning. Beskrivningar sparas alltid i sin helhet – det är
 * bara på skärmen de kortas, och då vid en meningsgräns i stället för mitt i
 * ett ord.
 */

/** Ungefärligt antal tecken som visas innan beskrivningen kortas. */
export const DESCRIPTION_DISPLAY_LIMIT = 280;

/**
 * Kortar en beskrivning till `limit` tecken:
 *   1. vid sista meningsslutet (. ! ?) före gränsen,
 *   2. annars vid sista hela ordet, med "…" efter.
 * Texten som sparas påverkas aldrig.
 */
export function truncateDescription(
  text: string,
  limit = DESCRIPTION_DISPLAY_LIMIT,
): string {
  const clean = (text ?? "").trim();
  if (clean.length <= limit) return clean;

  // Sista meningsslutet som ligger inom gränsen.
  let sentenceEnd = -1;
  const sentence = /[.!?](?=\s|$)/g;
  for (let match = sentence.exec(clean); match; match = sentence.exec(clean)) {
    if (match.index >= limit) break;
    sentenceEnd = match.index + 1;
  }
  if (sentenceEnd > 0) return clean.slice(0, sentenceEnd).trimEnd();

  // Ingen meningsgräns: kapa vid sista hela ordet.
  const window = clean.slice(0, limit);
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window;
  return `${cut.trimEnd()}…`;
}
