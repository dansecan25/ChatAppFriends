import { computed, nextTick, ref, type Ref } from 'vue';
import { displayName } from '@/composables/useUserDisplay';
import type { Thread } from '@/services/crypto/keyring';
import { useAuthStore } from '@/stores/authStore';
import { membersOf, useChannelStore } from '@/stores/channelStore';
import { useDmStore } from '@/stores/dmStore';
import { useServerStore } from '@/stores/serverStore';
import { encodeMentions, mentionsToText, type MentionablePerson } from '@/utils/mentions';

export interface MentionOption {
  key: string;
  /** What gets typed into the message, including the `@` or `#`. */
  insert: string;
  label: string;
  detail: string | null;
}

const MAX_OPTIONS = 8;
const TRIGGER = /(?:^|[^\p{L}\p{N}_@#])([@#])([^\s@#]*)$/u;

/** Suggests people and channels while typing `@` or `#`, and turns them into mentions when sending. */
export function useMentionPicker(thread: Ref<Thread>, text: Ref<string>, input: Ref<HTMLTextAreaElement | undefined>) {
  const auth = useAuthStore();
  const servers = useServerStore();
  const channels = useChannelStore();
  const dms = useDmStore();

  const trigger = ref<{ symbol: string; query: string; start: number } | null>(null);
  const selected = ref(0);

  /** Those who can read this thread. A nickname someone else also uses falls back to the account name. */
  const people = computed<MentionablePerson[]>(() => {
    const current = thread.value;
    if (current.kind === 'dm') {
      const other = dms.dms.find((dm) => dm.id === current.id)?.otherUser;
      return other ? [{ id: other.id, name: other.username, username: other.username }] : [];
    }
    const channel = channels.findKnown(current.id);
    const members = channel ? membersOf(channel, servers.members) : [];
    const others = members.filter((member) => member.id !== auth.user?.id);
    const uses = (name: string) =>
      others.filter((member) => [member.username, member.nickname].some((used) => used?.toLowerCase() === name.toLowerCase())).length;
    return others.map((member) => ({
      id: member.id,
      name: uses(displayName(member)) > 1 ? member.username : displayName(member),
      username: member.username,
    }));
  });

  /** Channel names are only offered in channels, since a DM's other person may not see them. */
  const mentionableChannels = computed(() => (thread.value.kind === 'channel' ? channels.textChannels : []));

  const options = computed<MentionOption[]>(() => {
    if (!trigger.value) return [];
    const { symbol, query } = trigger.value;
    const matches = (name: string) => name.toLowerCase().includes(query);
    const found: MentionOption[] =
      symbol === '@'
        ? people.value
            .filter((person) => matches(person.name) || matches(person.username))
            .map((person) => ({
              key: `u${person.id}`,
              insert: `@${person.name}`,
              label: person.name,
              detail: person.name === person.username ? null : person.username,
            }))
        : mentionableChannels.value
            .filter((channel) => matches(channel.name))
            .map((channel) => ({ key: `c${channel.id}`, insert: `#${channel.name}`, label: `#${channel.name}`, detail: null }));
    return found.slice(0, MAX_OPTIONS);
  });

  const close = () => {
    trigger.value = null;
  };

  /** Works out from the caret whether a mention is being typed. */
  function sync(): void {
    const el = input.value;
    const caret = el?.selectionStart ?? 0;
    const match = el && caret === el.selectionEnd ? el.value.slice(0, caret).match(TRIGGER) : null;
    if (!match) return close();
    const next = { symbol: match[1], query: match[2].toLowerCase(), start: caret - match[2].length - 1 };
    if (next.query !== trigger.value?.query || next.start !== trigger.value?.start) selected.value = 0;
    trigger.value = next;
  }

  /** Replaces what was typed with the chosen person or channel. */
  async function choose(option: MentionOption): Promise<void> {
    const el = input.value;
    if (!el || !trigger.value) return;
    const inserted = `${option.insert} `;
    const caret = trigger.value.start + inserted.length;
    text.value = el.value.slice(0, trigger.value.start) + inserted + el.value.slice(el.selectionStart);
    close();
    await nextTick();
    el.focus();
    el.setSelectionRange(caret, caret);
  }

  /** Lets the open list use the keyboard. Returns true when it used the key. */
  function onKeydown(event: KeyboardEvent): boolean {
    const count = options.value.length;
    if (count === 0 || event.isComposing) return false;
    if (event.key === 'ArrowDown') selected.value = (selected.value + 1) % count;
    else if (event.key === 'ArrowUp') selected.value = (selected.value - 1 + count) % count;
    else if (event.key === 'Enter' || event.key === 'Tab') void choose(options.value[selected.value]);
    else if (event.key === 'Escape') close();
    else return false;
    event.preventDefault();
    return true;
  }

  /** Prepares typed text for sending. */
  const encode = (content: string) => encodeMentions(content, people.value, mentionableChannels.value);

  /** Turns a saved message back into what the author would type. A channel they can't see stays as it was. */
  const decode = (content: string) =>
    mentionsToText(
      content,
      (part) => `@${people.value.find((person) => person.id === part.id)?.name ?? part.name}`,
      (id) => {
        const channel = mentionableChannels.value.find((candidate) => candidate.id === id);
        return channel ? `#${channel.name}` : `<#${id}>`;
      },
    );

  return { options, selected, sync, close, choose, onKeydown, encode, decode };
}
