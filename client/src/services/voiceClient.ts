import { Device, types } from 'mediasoup-client';
import { socket, socketRequest } from './socketClient';

interface RemoteProducer {
  producerId: string;
  userId: number;
}

interface JoinResponse {
  routerRtpCapabilities: types.RtpCapabilities;
  producers: RemoteProducer[];
}

interface RemoteAudio {
  consumer: types.Consumer;
  element: HTMLAudioElement;
}

const CONNECT_TIMEOUT_MS = 15_000;
const UNREACHABLE_MESSAGE = 'Could not reach the voice server. Check that you are connected to Tailscale.';

const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** Owns one voice session: the microphone, the WebRTC transports and remote playback. */
export class VoiceClient {
  private device?: Device;
  private micTrack?: MediaStreamTrack;
  private sendTransport?: types.Transport;
  private recvTransport?: types.Transport;
  private producer?: types.Producer;
  private readonly remoteAudio = new Map<string, RemoteAudio>();
  private readonly seenProducers = new Set<string>();
  private pendingProducers: RemoteProducer[] | null = [];
  private deafened = false;
  private closed = false;

  constructor(private readonly onFailure: (message: string) => void) {}

  /** Joins a voice channel and starts sending and receiving audio. */
  async connect(channelId: number): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    this.micTrack = stream.getAudioTracks()[0];
    this.assertOpen();

    socket.on('voice:newProducer', this.handleNewProducer);
    socket.on('voice:consumerClosed', this.handleConsumerClosed);

    const { routerRtpCapabilities, producers } = await socketRequest<JoinResponse>('voice:join', { channelId });
    this.assertOpen();

    const device = await Device.factory();
    await device.load({ routerRtpCapabilities });
    this.device = device;
    this.assertOpen();

    this.sendTransport = await this.createTransport('send');
    this.recvTransport = await this.createTransport('recv');
    this.assertOpen();

    this.producer = await this.sendTransport.produce({
      track: this.micTrack,
      stopTracks: false,
      codecOptions: { opusStereo: false, opusDtx: true },
    });
    this.assertOpen();
    await this.waitUntilConnected(this.sendTransport);
    this.assertOpen();

    const queued = [...producers, ...(this.pendingProducers ?? [])];
    this.pendingProducers = null;
    await Promise.all(queued.map((producer) => this.consume(producer)));
  }

  /** Mutes or unmutes the microphone. */
  setMuted(muted: boolean): void {
    if (muted) this.producer?.pause();
    else this.producer?.resume();
  }

  /** Silences or restores everyone else's audio. */
  setDeafened(deafened: boolean): void {
    this.deafened = deafened;
    this.remoteAudio.forEach(({ element }) => {
      element.muted = deafened;
    });
  }

  /** Releases the microphone, connections and audio elements. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    socket.off('voice:newProducer', this.handleNewProducer);
    socket.off('voice:consumerClosed', this.handleConsumerClosed);
    this.micTrack?.stop();
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.remoteAudio.forEach((_, consumerId) => this.removeRemoteAudio(consumerId));
  }

  private assertOpen(): void {
    if (this.closed) throw new DOMException('Voice session closed', 'AbortError');
  }

  private async createTransport(direction: 'send' | 'recv'): Promise<types.Transport> {
    const options = await socketRequest<types.TransportOptions>('voice:createTransport', { direction });
    const device = this.device as Device;
    const transport = direction === 'send' ? device.createSendTransport(options) : device.createRecvTransport(options);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socketRequest('voice:connectTransport', { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback);
    });
    transport.on('connectionstatechange', (state) => {
      if (state === 'failed' && !this.closed) this.onFailure(UNREACHABLE_MESSAGE);
    });
    if (direction === 'send') {
      transport.on('produce', ({ rtpParameters }, callback, errback) => {
        socketRequest<{ id: string }>('voice:produce', { transportId: transport.id, rtpParameters })
          .then(callback)
          .catch(errback);
      });
    }
    return transport;
  }

  /** Resolves once media can actually flow, so the UI never claims a connection it does not have. */
  private waitUntilConnected(transport: types.Transport): Promise<void> {
    if (transport.connectionState === 'connected') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(UNREACHABLE_MESSAGE)), CONNECT_TIMEOUT_MS);
      transport.on('connectionstatechange', (state) => {
        if (state === 'connected') {
          clearTimeout(timer);
          resolve();
        } else if (state === 'failed' || state === 'closed') {
          clearTimeout(timer);
          reject(new Error(UNREACHABLE_MESSAGE));
        }
      });
    });
  }

  private async consume({ producerId }: RemoteProducer): Promise<void> {
    if (this.closed || this.seenProducers.has(producerId)) return;
    this.seenProducers.add(producerId);

    const options = await socketRequest<types.ConsumerOptions>('voice:consume', {
      producerId,
      rtpCapabilities: (this.device as Device).rtpCapabilities,
    });
    const consumer = await (this.recvTransport as types.Transport).consume(options);
    if (this.closed) return;

    const element = new Audio();
    element.srcObject = new MediaStream([consumer.track]);
    element.muted = this.deafened;
    this.remoteAudio.set(consumer.id, { consumer, element });
    await socketRequest('voice:resume', { consumerId: consumer.id });
    await element.play().catch(() => undefined);
  }

  private removeRemoteAudio(consumerId: string): void {
    const remote = this.remoteAudio.get(consumerId);
    if (!remote) return;
    remote.element.srcObject = null;
    remote.consumer.close();
    this.remoteAudio.delete(consumerId);
  }

  private readonly handleNewProducer = (producer: RemoteProducer): void => {
    if (this.pendingProducers) {
      this.pendingProducers.push(producer);
      return;
    }
    this.consume(producer).catch((err) => console.error('Could not play a participant', err));
  };

  private readonly handleConsumerClosed = ({ consumerId }: { consumerId: string }): void => {
    this.removeRemoteAudio(consumerId);
  };
}
