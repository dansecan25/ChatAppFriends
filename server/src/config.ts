import { z } from 'zod';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

const optionalPath = z.string().optional().transform((value) => value || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8443),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32),
  MASTER_INVITE_CODE: z.string().min(16),
  INVITE_CODE: z
    .string()
    .transform((value) => value.split(',').map((code) => code.trim()))
    .refine((codes) => codes.every((code) => code.length >= 6), 'Each code needs at least 6 characters'),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i, 'Must be 64 hex characters'),
  MAX_USERS: z.coerce.number().int().positive().default(20),
  MARIADB_HOST: z.string().default('127.0.0.1'),
  MARIADB_PORT: z.coerce.number().int().positive().default(3306),
  MARIADB_USER: z.string().min(1),
  MARIADB_PASSWORD: z.string().default(''),
  MARIADB_DATABASE: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  MONGODB_DATABASE: z.string().min(1),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(1024 ** 3),
  MEDIA_LISTEN_IP: z.string().default('127.0.0.1'),
  MEDIA_PORT: z.coerce.number().int().positive().default(40000),
  TLS_CERT_PATH: optionalPath,
  TLS_KEY_PATH: optionalPath,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === 'production';
