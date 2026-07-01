import "server-only";

// On-demand translation for the admin chat, backed by Gemini (Google AI Studio
// free tier). We ask the model to translate any language into French and to
// return the text unchanged when it's already French — so the same call covers
// detection + translation in one round-trip. Configured entirely via env so the
// model/key can change without touching code.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class TranslationError extends Error {}

export async function translateToFrench(text: string): Promise<string> {
  const input = text.trim();
  if (!input) return "";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new TranslationError("GEMINI_API_KEY manquante.");
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt =
    "Traduis le message suivant en français. " +
    "Si le texte est déjà en français, renvoie-le tel quel. " +
    "Conserve le ton et le sens, n'ajoute aucun commentaire ni guillemets : " +
    "renvoie uniquement la traduction.\n\n" +
    input;

  let res: Response;
  try {
    res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // Deterministic, no "thinking" budget needed for a translation.
          generationConfig: { temperature: 0 },
        }),
      },
    );
  } catch {
    throw new TranslationError("Service de traduction injoignable.");
  }

  if (!res.ok) {
    throw new TranslationError(`Échec de la traduction (${res.status}).`);
  }

  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p?.text ?? "")
    .join("")
    .trim();

  if (!out) throw new TranslationError("Réponse de traduction vide.");
  return out;
}
