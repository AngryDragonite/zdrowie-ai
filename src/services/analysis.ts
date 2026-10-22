type GroqResponse = { choices?: Array<{ message?: { content?: string } }> };

const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
const groqKey = import.meta.env.VITE_GROQ_API_KEY;
const groqModel = import.meta.env.VITE_GROQ_MODEL || "openai/gpt-oss-20b";

const groqChatCompletionsUrl =
  "https://api.groq.com/openai/v1/chat/completions";

export async function analyseRecordings(blobs: Blob[]): Promise<string[]> {
  if (
    !elevenLabsKey ||
    !groqKey ||
    elevenLabsKey.includes("your_") ||
    groqKey.includes("your_")
  ) {
    throw new Error("API keys are not configured");
  }
  const transcripts = await Promise.all(
    blobs.map(async (blob, index) => {
      const formData = new FormData();
      formData.append("file", blob, `nagranie-${index + 1}.webm`);
      formData.append("model_id", "scribe_v1");
      const response = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text",
        {
          method: "POST",
          headers: { "xi-api-key": elevenLabsKey },
          body: formData,
        },
      );
      if (!response.ok)
        throw new Error(`ElevenLabs request failed: ${response.status}`);
      const result = (await response.json()) as { text?: string };
      return result.text ?? "";
    }),
  );
  const response = await fetch(groqChatCompletionsUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Wypisz najważniejsze problemy i obserwacje użytkownika w zrozumiałych, rzeczowych punktach dla lekarza psychiatry. Nie stawiaj diagnozy. Zwróć wyłącznie listę punktowaną. Nie roszerzaj problemów/obserwacji o hipotezy, całość opisz jak najzwięźlej jak się da",
        },
        { role: "user", content: transcripts.join("\n\n") },
      ],
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Groq request failed (${response.status}) for model ${groqModel}: ${details}`,
    );
  }
  const result = (await response.json()) as GroqResponse;
  return parseInsights(result.choices?.[0]?.message?.content ?? "");
}

function parseInsights(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}
