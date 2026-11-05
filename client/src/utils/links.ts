export type TextOrLink = { kind: 'text'; text: string } | { kind: 'link'; url: string };

export type Embed = { kind: 'youtube'; id: string; start: number } | { kind: 'tweet'; id: string };

const URL_PATTERN = /https?:\/\/[^\s<>]+/g;
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]+$/;
const MAX_EMBEDS = 3;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
const X_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);
const VIDEO_ID = /^[\w-]{11}$/;
const VIDEO_PATH = /^\/(?:shorts|embed|live)\/([\w-]{11})/;
const POST_PATH = /^\/\w{1,15}\/status(?:es)?\/(\d{1,20})/;
const TIMESTAMP = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;

/** Splits text into plain parts and web links. Only http and https links count. */
export function splitLinks(text: string): TextOrLink[] {
  const parts: TextOrLink[] = [];
  let position = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING_PUNCTUATION, '');
    if (match.index > position) parts.push({ kind: 'text', text: text.slice(position, match.index) });
    parts.push({ kind: 'link', url });
    position = match.index + url.length;
  }
  if (position < text.length) parts.push({ kind: 'text', text: text.slice(position) });
  return parts;
}

/** Reads a YouTube start time such as `90`, `90s` or `1m30s`. */
function startSeconds(value: string | null): number {
  const match = value?.match(TIMESTAMP);
  if (!match) return 0;
  const [, hours = 0, minutes = 0, seconds = 0] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** Recognises a YouTube video or an X post. */
export function embedOf(link: string): Embed | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const id =
      url.hostname === 'youtu.be' ? url.pathname.slice(1) : (url.searchParams.get('v') ?? url.pathname.match(VIDEO_PATH)?.[1]);
    const start = startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
    return id && VIDEO_ID.test(id) ? { kind: 'youtube', id, start } : null;
  }
  const postId = X_HOSTS.has(url.hostname) ? url.pathname.match(POST_PATH)?.[1] : undefined;
  return postId ? { kind: 'tweet', id: postId } : null;
}

/** Lists the previews for a message's links, each video or post once. */
export function findEmbeds(text: string): Embed[] {
  const embeds = new Map<string, Embed>();
  for (const part of splitLinks(text)) {
    const embed = part.kind === 'link' ? embedOf(part.url) : null;
    if (embed) embeds.set(`${embed.kind}:${embed.id}`, embed);
  }
  return [...embeds.values()].slice(0, MAX_EMBEDS);
}
