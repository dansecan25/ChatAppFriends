import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ApiError } from '@/api/http';
import * as messageApi from '@/api/messageApi';
import { toMessage } from '@/mappers/messageMapper';
import { forgetChannelKeys, refreshRootKeys, threadKeyOf, type Thread } from '@/services/crypto/keyring';
import { encryptMessage, type FilePayload } from '@/services/crypto/messageCrypto';
import type { MessageDto } from '@/types/dto';
import type { Message } from '@/types/models';
import { runKeyWork } from '@/services/keySharing';

interface ThreadMessages {
  messages: Message[];
  hasMore: boolean;
  loaded: boolean;
}

const KEY_CHANGED_STATUS = 409;

const emptyThread = (): ThreadMessages => ({ messages: [], hasMore: true, loaded: false });

export const useMessageStore = defineStore('messages', () => {
  const byThread = ref<Record<string, ThreadMessages>>({});

  const threadState = (threadKey: string): ThreadMessages => (byThread.value[threadKey] ??= emptyThread());

  const decryptPage = (page: MessageDto[], thread: Thread) => Promise.all(page.map((dto) => toMessage(dto, thread)));

  /** Loads a thread's newest page, replacing what is cached. */
  async function loadLatest(thread: Thread): Promise<void> {
    const page = await messageApi.fetchMessages(thread);
    byThread.value[threadKeyOf(thread)] = {
      messages: await decryptPage(page, thread),
      hasMore: page.length === messageApi.MESSAGE_PAGE_SIZE,
      loaded: true,
    };
  }

  /** Loads the page before the oldest cached message. */
  async function loadOlder(thread: Thread): Promise<void> {
    const state = threadState(threadKeyOf(thread));
    const oldest = state.messages[0];
    if (!oldest || !state.hasMore) return;
    const page = await messageApi.fetchMessages(thread, oldest.id);
    state.messages.unshift(...(await decryptPage(page, thread)));
    state.hasMore = page.length === messageApi.MESSAGE_PAGE_SIZE;
  }

  /** Adds a message once, whether it arrives by HTTP reply or socket event. */
  function addMessage(message: Message): void {
    const state = threadState(message.threadKey);
    if (!state.messages.some((existing) => existing.id === message.id)) state.messages.push(message);
  }

  /** Decrypts a message from the server and adds it. */
  async function receive(dto: MessageDto, thread: Thread): Promise<Message> {
    const message = await toMessage(dto, thread);
    addMessage(message);
    return message;
  }

  /** Runs an encrypted write. If the channel's key just changed, gets the new key and tries once more. */
  async function withCurrentKey(thread: Thread, write: () => Promise<MessageDto>): Promise<MessageDto> {
    try {
      return await write();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== KEY_CHANGED_STATUS || thread.kind !== 'channel') throw err;
      await runKeyWork(thread.serverId);
      forgetChannelKeys(thread.id);
      await refreshRootKeys(thread.serverId);
      return write();
    }
  }

  /** Encrypts and sends a message. */
  async function send(
    thread: Thread,
    authorId: number,
    text: string,
    attachment?: { uploadId: string; file: FilePayload },
  ): Promise<void> {
    const post = async () => {
      const sealed = await encryptMessage(thread, authorId, { text, file: attachment?.file ?? null });
      return messageApi.postMessage(thread, { ...sealed, uploadId: attachment?.uploadId });
    };
    await receive(await withCurrentKey(thread, post), thread);
  }

  /** Re-encrypts a message with new text, keeping its image. */
  async function edit(thread: Thread, message: Message, authorId: number, text: string): Promise<void> {
    const file = message.image?.source.kind === 'encrypted' ? message.image.source.file : null;
    const dto = await withCurrentKey(thread, async () =>
      messageApi.patchMessage(thread, message.id, await encryptMessage(thread, authorId, { text, file })),
    );
    await applyEdit(dto, thread);
  }

  /** Shows a new version of a cached message, ignoring one older than what's on screen. */
  async function applyEdit(dto: MessageDto, thread: Thread): Promise<void> {
    const key = threadKeyOf(thread);
    if (!threadState(key).messages.some((existing) => existing.id === dto.id)) return;
    const updated = await toMessage(dto, thread);
    const list = threadState(key).messages;
    const index = list.findIndex((existing) => existing.id === dto.id);
    if (index === -1) return;
    const shownEdit = list[index].editedAt?.getTime() ?? 0;
    if ((updated.editedAt?.getTime() ?? 0) >= shownEdit) list[index] = updated;
  }

  /** Deletes a message on the server and from view. */
  async function remove(thread: Thread, messageId: string): Promise<void> {
    await messageApi.deleteMessage(thread, messageId);
    removeMessage(threadKeyOf(thread), messageId);
  }

  /** Takes a deleted message out of view. */
  function removeMessage(threadKey: string, messageId: string): void {
    const state = threadState(threadKey);
    state.messages = state.messages.filter((existing) => existing.id !== messageId);
  }

  /** Drops the cache for a deleted channel. */
  function removeThread(threadKey: string): void {
    delete byThread.value[threadKey];
  }

  /** Clears everything on sign-out. */
  function reset(): void {
    byThread.value = {};
  }

  return {
    byThread,
    threadState,
    loadLatest,
    loadOlder,
    addMessage,
    receive,
    send,
    edit,
    applyEdit,
    remove,
    removeMessage,
    removeThread,
    reset,
  };
});
