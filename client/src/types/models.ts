import type { ChannelType } from './dto';

export interface User {
  id: number;
  username: string;
}

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  createdBy: number | null;
}

export interface MessageImage {
  id: string;
  filename: string;
  size: number;
  sizeLabel: string;
  url: string;
  downloadUrl: string;
  /** Large images wait for a click so nobody downloads a gigabyte by accident. */
  loadsOnDemand: boolean;
}

export interface Message {
  id: string;
  channelId: number;
  author: User;
  content: string;
  image: MessageImage | null;
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
