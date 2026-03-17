import OpenAI from 'openai';
import config from './config.js';

/**
 * Ask the LLM to pick the single best quote from a chapter and return only that quote (and optional attribution).
 * @param {string} chapterText - Full chapter text
 * @param {string} bookLabel - e.g. "The Myth of Sisyphus"
 * @param {number} chapterNumber - 1-based chapter number
 * @returns {{ quote: string, attribution?: string }}
 */
export async function getBestQuote(chapterText, bookLabel, chapterNumber) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const openai = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
  });

  const systemPrompt = `You are a literary expert. Given a chapter from a book, choose the single best quote: the most striking, memorable, or insightful sentence or short passage (1-3 sentences max). Return only the quote and optional brief attribution. Be faithful to the text; do not paraphrase.`;

  const userPrompt = `Book: ${bookLabel}\nChapter: ${chapterNumber}\n\nChapter text:\n\n${chapterText.slice(0, 12000)}\n\nProvide the single best quote from this chapter. Reply in this exact JSON format only, no other text:\n{"quote": "the exact quote from the text", "attribution": "Author, Book (optional)"}`;

  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices?.[0]?.message?.content?.trim() || '';
  try {
    const parsed = JSON.parse(content);
    const quote = typeof parsed.quote === 'string' ? parsed.quote.trim() : '';
    const attribution = typeof parsed.attribution === 'string' ? parsed.attribution.trim() : bookLabel;
    return { quote: quote || content, attribution: attribution || bookLabel };
  } catch (_) {
    return { quote: content || 'No quote extracted.', attribution: bookLabel };
  }
}

/**
 * Generate a very epic 5-line explanation of the quote using the LLM.
 * @param {string} quote - The quote to explain
 * @param {string} attribution - e.g. "Camus, The Myth of Sisyphus"
 * @returns {Promise<string>} - Exactly 5 lines of epic explanation
 */
export async function getEpicExplanation(quote, attribution) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const openai = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
  });

  const systemPrompt = `You are a philosopher and poet. You explain quotes in a grand, epic, and memorable way. Your tone is soaring, profound, and vivid. You write exactly 5 short lines—no more, no less. Each line can be one sentence. No bullet points, no numbering. Pure prose.`;

  const userPrompt = `Explain this quote very epically in exactly 5 lines:\n\n"${quote}"\n— ${attribution}\n\nReply with only the 5 lines of epic explanation, nothing else. No intro, no "Here's why," no conclusion. Just the five lines.`;

  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 400,
  });

  const content = (response.choices?.[0]?.message?.content ?? '').trim();
  const lines = content.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const five = lines.slice(0, 5);
  return five.length ? five.join('\n') : content || '—';
}
