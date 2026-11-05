export type ChannelType = 'text' | 'voice';

export interface UserDto {
  id: number;
  username: string;
}

export interface ProfileDto extends UserDto {
  isOwner: boolean;
  needsKeySetup: boolean;
}

export interface LoginDto {
  user: ProfileDto;
  keys: { kdfSalt: string; wrappedPrivateKey: string; publicKey: string } | null;
}

export interface RootKeyDto {
  version: number;
  key: string;
}

export interface ServerDto {
  id: number;
  name: string;
  rootKeyVersion: number;
  isAdmin: boolean;
  rootKeys: RootKeyDto[];
}

export interface MemberDto extends UserDto {
  publicKey: string | null;
  isOwner: boolean;
  roleIds: number[];
}

export interface RoleDto {
  id: number;
  serverId: number;
  name: string;
  isAdmin: boolean;
}

export interface ChannelDto {
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

export interface KeyEnvelopeDto {
  version: number;
  userId: number;
  wrappedKey: string;
}

export interface KeyWorkDto {
  grants: { channelId: number; version: number; userId: number }[];
  rotations: number[];
}

export interface DmDto {
  id: number;
  otherUser: UserDto & { publicKey: string | null };
  wrappedKey: string;
}

export interface AttachmentDto {
  id: string;
  encryptedSize: number;
}

export interface LegacyImageDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MessageDto {
  id: string;
  channelId: number | null;
  dmId: number | null;
  author: UserDto;
  encrypted: boolean;
  ciphertext: string | null;
  keyVersion: number;
  attachment: AttachmentDto | null;
  content: string | null;
  image: LegacyImageDto | null;
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
