export type ChannelType = 'text' | 'voice';

export interface UserDto {
  id: number;
  username: string;
}

export interface ChannelDto {
  id: number;
  name: string;
  type: ChannelType;
  createdBy: number | null;
}

export interface ImageDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MessageDto {
  id: string;
  channelId: number;
  author: UserDto;
  content: string;
  image: ImageDto | null;
  createdAt: string;
}

export interface VoiceParticipantDto {
  userId: number;
  username: string;
  muted: boolean;
  deafened: boolean;
}

export interface VoiceRosterDto {
  channelId: number;
  participants: VoiceParticipantDto[];
}
