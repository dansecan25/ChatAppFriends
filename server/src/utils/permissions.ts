/** What a role can allow. They're stored as bits in this order, so new ones only ever go at the end. */
export const PERMISSIONS = [
  'administrator',
  'manageServer',
  'manageChannels',
  'createChannels',
  'manageRoles',
  'removeMembers',
  'manageMessages',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permissionBit = (permission: Permission): number => 1 << PERMISSIONS.indexOf(permission);

export const ALL_PERMISSIONS = (1 << PERMISSIONS.length) - 1;
export const ADMINISTRATOR = permissionBit('administrator');

/** What every member can do before roles: rename the server and create channels, as before roles had permissions. */
export const DEFAULT_EVERYONE_PERMISSIONS = permissionBit('manageServer') | permissionBit('createChannels');

export const toPermissionBits = (names: readonly Permission[]): number =>
  names.reduce((bits, name) => bits | permissionBit(name), 0);

export const toPermissionNames = (bits: number): Permission[] =>
  PERMISSIONS.filter((permission) => (bits & permissionBit(permission)) !== 0);

/** Administrator includes every other permission. */
export const expandAdministrator = (bits: number): number => ((bits & ADMINISTRATOR) !== 0 ? ALL_PERMISSIONS : bits);

/** Tells whether someone holding `actor` may give or take away all of `target`. */
export const covers = (actor: number, target: number): boolean => (target & ~actor) === 0;
