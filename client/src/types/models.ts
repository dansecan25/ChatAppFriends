import type { FilePayload } from '@/services/crypto/messageCrypto';
import type { ChannelType } from './dto';

export interface User {
  id: number;
  username: string;
}

export interface Profile extends User {
  isOwner: boolean;
}

export interface Channel {
  id: number;
  serverId: number;
  name: string;
  type: ChannelType;
  restricted: boolean;
  keyVersion: number;
  rotationPending: boolean;
  createdBy: number | null;
  roleIds: number[];
}

export interface MessageImage {
  /** Old images have a URL; encrypted ones are fetched and decrypted in the browser. */
  source: { kind: 'legacy'; url: string; downloadUrl: string } | { kind: 'encrypted'; attachmentId: string; file: FilePayload };
  filename: string;
  sizeLabel: string;
  /** Large images wait for a click so nobody downloads a gigabyte by accident. */
  loadsOnDemand: boolean;
}

/** How far a message's protection goes: `encrypted`, `legacy` from before encryption, or `locked` if unreadable. */
export type MessageProtection = 'encrypted' | 'legacy' | 'locked';

export interface Message {
  id: string;
  threadKey: string;
  author: User;
  content: string;
  image: MessageImage | null;
  protection: MessageProtection;
  createdAt: Date;
  timeLabel: string;
}

export interface VoiceParticipant {
  userId: number;
  username: string;
  muted: boolean;
  deafened: boolean;
}

export type VoiceStatus = 'idle' | 'connecting' | 'connected';
