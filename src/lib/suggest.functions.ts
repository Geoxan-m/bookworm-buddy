import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  history: z.array(z.object({ title: z.string(), author: z.string() })).max(50),
  lang: z.enum(["en", "el"]).default("el"),
});

export type AiSuggestion = { title: string; author: string; reason: string };

export const getAiSuggestions = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ suggestions: AiSuggestion[]; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { suggestions: [], error: "AI not configured" };

    const langInstruction =
      data.lang === "el"
        ? "Απάντησε στα ελληνικά. Οι τίτλοι παραμένουν στην αυθεντική γλώσσα τους."
        : "Respond in English.";

    const isEmpty = data.history.length === 0;
    const historyText = data.history
      .slice(0, 25)
      .map((b) => `- "${b.title}" by ${b.author}`)
      .join("\n");

    const systemPrompt = isEmpty
      ? `You are a literary recommender for Bookworm Buddy. The user has no reading history yet. Suggest 6 of the CURRENT global bestsellers across DIVERSE genres (literary fiction, fantasy/sci-fi, thriller/mystery, non-fiction, romance, biography/memoir). Prefer recent releases that are actually selling well right now. ${langInstruction}`
      : `You are a literary recommender for Bookworm Buddy. Suggest 6 books the reader will likely enjoy based on their library (read + want-to-read + to-buy). Infer their taste from genres, authors, and themes. Avoid books already in the list. ${langInstruction}`;

    const userPrompt = isEmpty
      ? `Suggest 6 current bestselling books across different genres for a brand new reader.`
      : `My library so far:\n${historyText}\n\nSuggest 6 books I should read next based on this taste.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_suggestions",
                description: "Return book recommendations.",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          author: { type: "string" },
                          reason: { type: "string", description: "One short sentence why." },
                        },
                        required: ["title", "author", "reason"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["suggestions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_suggestions" } },
        }),
      });

      if (!res.ok) {
        const status = res.status;
        if (status === 429) return { suggestions: [], error: "rate_limit" };
        if (status === 402) return { suggestions: [], error: "payment_required" };
        return { suggestions: [], error: `ai_error_${status}` };
      }
      const json = await res.json();
      const argStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argStr) return { suggestions: [], error: "no_tool_call" };
      const parsed = JSON.parse(argStr) as { suggestions: AiSuggestion[] };
      return { suggestions: parsed.suggestions ?? [] };
    } catch (e) {
      console.error("AI suggestions error", e);
      return { suggestions: [], error: "exception" };
    }
  });
