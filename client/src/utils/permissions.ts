/** Permission names, matching the server's `utils/permissions.ts`. */
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

export const PERMISSION_DETAILS: Record<Permission, { label: string; description: string }> = {
  administrator: {
    label: 'Administrator',
    description: "Every permission below. Restricted channels still only open to their roles, since their keys can't be forced.",
  },
  manageServer: { label: 'Rename server', description: 'Change the server name.' },
  manageChannels: {
    label: 'Manage channels',
    description: 'Create, rename and delete any channel, and choose who can use restricted ones.',
  },
  createChannels: { label: 'Create channels', description: 'Create channels, and rename or delete their own.' },
  manageRoles: {
    label: 'Manage roles',
    description: 'Create, edit and give out roles, but only with permissions they have themselves.',
  },
  removeMembers: { label: 'Remove members', description: 'Remove people who have fewer permissions than them.' },
  manageMessages: { label: 'Delete messages', description: "Delete anyone's messages in channels. Never in DMs." },
};

/** Tells whether someone with `actor` may give or take away all of `target`. */
export const covers = (actor: ReadonlySet<Permission>, target: readonly Permission[]): boolean =>
  target.every((permission) => actor.has(permission));
