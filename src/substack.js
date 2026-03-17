import { SubstackClient } from 'substack-api';
import config from './config.js';

const SUBSTACK_FEED_BASE = 'https://substack.com/api/v1';

/**
 * Build Substack note bodyJson (ProseMirror doc) for a single text block.
 */
function bodyJsonForText(text) {
  return {
    type: 'doc',
    attrs: { schemaVersion: 'v1' },
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: text || '' }],
      },
    ],
  };
}

function getFeedBase() {
  const pub = (config.substackPublicationUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return pub ? `https://${pub}/api/v1` : SUBSTACK_FEED_BASE;
}

/**
 * Post a reply (comment) to an existing note via Substack feed API.
 * Tries parent_comment_id (Substack may use snake_case) and both substack.com and publication API.
 * @param {number} parentNoteId - Id of the note to reply to (from publish response)
 * @param {string} replyText - Body of the reply (e.g. epic explanation)
 */
export async function postReplyToNote(parentNoteId, replyText) {
  if (!config.substackToken || !replyText?.trim()) {
    throw new Error('SUBSTACK_TOKEN and reply text are required');
  }
  const payload = {
    bodyJson: bodyJsonForText(replyText.trim()),
    tabId: 'for-you',
    surface: 'feed',
    replyMinimumRole: 'everyone',
    parent_comment_id: parentNoteId,
    parentCommentId: parentNoteId,
  };
  const headers = {
    Cookie: `substack.sid=${config.substackToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  };

  const pubBase = getFeedBase();
  const bases = pubBase !== SUBSTACK_FEED_BASE ? [pubBase, SUBSTACK_FEED_BASE] : [SUBSTACK_FEED_BASE];
  for (const base of bases) {
    const url = `${base}/comment/feed/`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return res.json();
    }
    const errText = await res.text();
    if (res.status >= 400 && res.status < 500) {
      let errBody;
      try {
        errBody = JSON.parse(errText);
      } catch (_) {
        errBody = { message: errText };
      }
      throw new Error(
        `Substack reply failed (HTTP ${res.status}): ${errBody?.message ?? errText}`
      );
    }
  }
  throw new Error('Substack reply failed on both API bases.');
}

/**
 * Publish a note to Substack: quote + attribution only (no chapter). No explanation in same note.
 * @param {{ quote: string, attribution?: string }} result - From getBestQuote
 * @param {string} bookLabel - Book title for the note
 * @returns {{ noteId: number }} - Id of the published note (use for postReplyToNote)
 */
export async function publishQuoteToSubstack(result, bookLabel) {
  if (!config.substackToken || !config.substackPublicationUrl) {
    throw new Error('SUBSTACK_TOKEN and SUBSTACK_PUBLICATION_URL must be set in .env');
  }

  const publicationUrl = config.substackPublicationUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const client = new SubstackClient({
    token: config.substackToken,
    publicationUrl,
  });

  let profile;
  try {
    profile = await client.ownProfile();
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = (typeof data === 'object' && data?.message) ? data.message : (data?.error ?? err.message ?? String(err));
    throw new Error(
      `Substack auth failed${status ? ` (HTTP ${status})` : ''}: ${msg}. ` +
      'Use a fresh substack.sid: log in at substack.com → DevTools → Application → Cookies → substack.com → copy the substack.sid value.'
    );
  }
  const attribution = result.attribution || bookLabel;
  const quoteBlock = `"${result.quote}"\n\n— ${attribution}`;

  const note = await profile.newNote().paragraph().text(quoteBlock).publish();
  return { noteId: note.id };
}

/**
 * Post a single note with just the explanation text (fallback when reply API fails).
 */
export async function postExplanationAsNote(explanationText) {
  if (!config.substackToken || !config.substackPublicationUrl || !explanationText?.trim()) {
    throw new Error('SUBSTACK_TOKEN, SUBSTACK_PUBLICATION_URL and text are required');
  }
  const publicationUrl = config.substackPublicationUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const client = new SubstackClient({
    token: config.substackToken,
    publicationUrl,
  });
  const profile = await client.ownProfile();
  const note = await profile.newNote().paragraph().text(explanationText.trim()).publish();
  return { noteId: note.id };
}
