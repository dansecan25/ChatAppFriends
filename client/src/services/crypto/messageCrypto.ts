import { openText, sealText } from './primitives';
import { readKey, threadKeyOf, writeKey, type Thread } from './keyring';

/** The file details only members can see. */
export interface FilePayload {
  filename: string;
  mimeType: string;
  size: number;
  key: string;
  chunkSize: number;
}

export interface MessagePayload {
  text: string;
  file: FilePayload | null;
}

/** Binds a message to its place and author, so the server can't move it or change who sent it. */
const contextOf = (thread: Thread, authorId: number, version: number) =>
  `${threadKeyOf(thread)}|${authorId}|${version}`;

/** Encrypts a message for a thread. */
export async function encryptMessage(thread: Thread, authorId: number, payload: MessagePayload) {
  const { key, version } = await writeKey(thread);
  const sealed = await sealText(key, JSON.stringify(payload), contextOf(thread, authorId, version));
  return { ciphertext: sealed, keyVersion: version };
}

/** Decrypts a message. Throws when it can't be opened or was tampered with. */
export async function decryptMessage(
  thread: Thread,
  authorId: number,
  version: number,
  ciphertext: string,
): Promise<MessagePayload> {
  const key = await readKey(thread, version);
  return JSON.parse(await openText(key, ciphertext, contextOf(thread, authorId, version)));
}
