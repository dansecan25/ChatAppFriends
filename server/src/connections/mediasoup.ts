import { createWorker, types } from 'mediasoup';
import { config } from '../config.js';

export interface MediaEngine {
  worker: types.Worker;
  router: types.Router;
  webRtcServer: types.WebRtcServer;
  audioLevelObserver: types.AudioLevelObserver;
}

let engine: MediaEngine | undefined;

/** Starts the voice worker; one is plenty for 20 audio-only participants. */
export async function connectMediasoup(): Promise<void> {
  const worker = await createWorker({ logLevel: 'warn' });
  worker.on('died', () => {
    console.error('mediasoup worker died, exiting so systemd can restart the service');
    process.exit(1);
  });

  const router = await worker.createRouter({
    mediaCodecs: [{ kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2, preferredPayloadType: 111 }],
  });
  const address = { ip: config.MEDIA_LISTEN_IP, port: config.MEDIA_PORT };
  const webRtcServer = await worker.createWebRtcServer({
    listenInfos: [
      { protocol: 'udp', ...address },
      { protocol: 'tcp', ...address },
    ],
  });
  const audioLevelObserver = await router.createAudioLevelObserver({
    maxEntries: config.MAX_USERS,
    threshold: -60,
    interval: 400,
  });

  engine = { worker, router, webRtcServer, audioLevelObserver };
}

/** Returns the running voice engine. */
export function getMediaEngine(): MediaEngine {
  if (!engine) throw new Error('mediasoup is not running');
  return engine;
}
