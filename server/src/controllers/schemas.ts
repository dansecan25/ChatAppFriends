import { z } from 'zod';

export const idSchema = z.coerce.number({ error: 'Invalid id' }).int('Invalid id').positive('Invalid id');
/** Encrypted data and keys, which the server stores without reading. */
export const opaqueSchema = z.string().min(1).max(8192);
export const hexKeySchema = z.string().regex(/^[a-f\d]{64}$/i);

export const envelopeSchema = z.object({
  version: z.number().int().min(0),
  userId: z.number().int().positive(),
  wrappedKey: opaqueSchema,
});
export const envelopesSchema = z.array(envelopeSchema).max(500);

export const inviteCodeSchema = z.string().trim().min(1, 'Enter an invite code').max(200);
