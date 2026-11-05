export interface MentionablePerson {
  id: number;
  /** What the picker inserts: their nickname when it's unambiguous, otherwise their account name. */
  name: string;
  username: string;
}

export interface MentionableChannel {
  id: number;
  name: string;
}

export type MessagePart =
  | { kind: 'text'; text: string }
  | { kind: 'user'; id: number; name: string }
  | { kind: 'channel'; id: number };

/** Mentions are stored by id, so they survive renames. A person's name is the fallback for those who left. */
const TOKEN = /<@(\d+)\|([^<>|\n]{1,64})>|<#(\d+)>/g;
const MAX_NAME_LENGTH = 64;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const userToken = (person: MentionablePerson) => {
  const name = person.name.replace(/[<>|\n]/g, '').slice(0, MAX_NAME_LENGTH) || 'user';
  return `<@${person.id}|${name}>`;
};

/** Turns typed `@name` and `#channel` into mention tokens. Account names win when a nickname matches one. */
export function encodeMentions(
  text: string,
  people: MentionablePerson[],
  channels: MentionableChannel[],
): string {
  const tokens = new Map<string, string>();
  people.forEach((person) => tokens.set(`@${person.username.toLowerCase()}`, userToken(person)));
  people.forEach((person) => {
    const key = `@${person.name.toLowerCase()}`;
    if (!tokens.has(key)) tokens.set(key, userToken(person));
  });
  channels.forEach((channel) => tokens.set(`#${channel.name.toLowerCase()}`, `<#${channel.id}>`));
  if (tokens.size === 0) return text;

  const alternatives = [...tokens.keys()].toSorted((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_@#])(?:${alternatives})(?![\\p{L}\\p{N}_-])`, 'giu');
  return text.replace(pattern, (match) => tokens.get(match.toLowerCase()) ?? match);
}

/** Splits a message into text and mentions for showing it. */
export function parseMentions(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let position = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > position) parts.push({ kind: 'text', text: text.slice(position, match.index) });
    parts.push(
      match[1]
        ? { kind: 'user', id: Number(match[1]), name: match[2] }
        : { kind: 'channel', id: Number(match[3]) },
    );
    position = match.index + match[0].length;
  }
  if (position < text.length) parts.push({ kind: 'text', text: text.slice(position) });
  return parts;
}

/** Rebuilds a message's text, with the caller choosing how each mention reads. */
export const mentionsToText = (
  text: string,
  person: (part: Extract<MessagePart, { kind: 'user' }>) => string,
  channel: (id: number) => string,
): string =>
  parseMentions(text)
    .map((part) => (part.kind === 'text' ? part.text : part.kind === 'user' ? person(part) : channel(part.id)))
    .join('');

/** Tells whether a message mentions a person. */
export const mentionsUser = (text: string, userId: number): boolean =>
  parseMentions(text).some((part) => part.kind === 'user' && part.id === userId);

/** Lists the channels a message mentions. */
export const mentionedChannelIds = (text: string): number[] =>
  parseMentions(text).flatMap((part) => (part.kind === 'channel' ? [part.id] : []));
