import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectMariadb, pool } from './connections/mariadb.js';
import { connectMediasoup } from './connections/mediasoup.js';
import { closeMongodb, connectMongodb } from './connections/mongodb.js';
import { createSocketServer } from './connections/socket.js';
import { registerSocketHandlers } from './controllers/socketController.js';
import { ensureSchema } from './models/schema.js';
import { initializeFileStorage } from './services/fileService.js';
import { syncDefinedServers } from './services/serverService.js';
import { startSpeakerDetection } from './services/voiceService.js';

const UPLOAD_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** Creates an HTTPS server when certificates are configured, otherwise HTTP for development. */
function createServer(app: ReturnType<typeof createApp>) {
  if (config.TLS_CERT_PATH && config.TLS_KEY_PATH) {
    return createHttpsServer(
      { cert: readFileSync(config.TLS_CERT_PATH), key: readFileSync(config.TLS_KEY_PATH) },
      app,
    );
  }
  return createHttpServer(app);
}

/** Connects dependencies and starts listening. */
async function main(): Promise<void> {
  await connectMariadb();
  await connectMongodb();
  await ensureSchema();
  await syncDefinedServers();
  await initializeFileStorage();
  await connectMediasoup();

  const server = createServer(createApp());
  server.requestTimeout = UPLOAD_TIMEOUT_MS;

  const io = createSocketServer(server);
  registerSocketHandlers(io);
  startSpeakerDetection();

  const shutdown = async () => {
    await io.close();
    await Promise.allSettled([pool.end(), closeMongodb()]);
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  server.listen(config.PORT, config.HOST, () => {
    console.log(`Server listening on ${config.HOST}:${config.PORT} (allowed origin: ${config.CLIENT_ORIGIN})`);
  });
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
