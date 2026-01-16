import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const gemini = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
});

export const geminiWithSearch = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  tools: [{ googleSearch: {} } as any],
});

export async function generateWithSearch(prompt: string): Promise<string> {
  const result = await geminiWithSearch.generateContent(prompt);
  return result.response.text();
}

export async function generate(prompt: string): Promise<string> {
  const result = await gemini.generateContent(prompt);
  return result.response.text();
}

export function parseJsonResponse<T>(text: string): T {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}
