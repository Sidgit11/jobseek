import { GoogleGenerativeAI } from '@google/generative-ai'

export const MODEL = 'gemini-2.5-flash'

function getClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')
  return new GoogleGenerativeAI(apiKey)
}

/** Drop-in helper that matches how we called Anthropic — returns plain text. */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: options.temperature ?? 0.5,
      maxOutputTokens: options.maxTokens ?? 1024,
    },
  })

  const result = await model.generateContent(userPrompt)
  return result.response.text().trim()
}
