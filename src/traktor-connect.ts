/**
 * @fileoverview TraktorConnect - receives track metadata from Traktor Pro
 * via OGG Vorbis broadcast over TCP.
 *
 * Traktor Pro can be configured to broadcast its output as an OGG Vorbis stream.
 * This class creates a TCP server that Traktor connects to, decodes the stream,
 * and emits track metadata events.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { createServer, type Server, type Socket } from 'net';
import { OggDecoder } from './ogg-decoder.js';
import { VorbisDecoder } from './vorbis-decoder.js';
import type { TraktorConnectOptions, TraktorTrackData, Logger } from './types.js';
import { noopLogger } from './types.js';

/**
 * TraktorConnect creates a TCP server that receives OGG Vorbis broadcast
 * streams from Traktor Pro and extracts track metadata.
 *
 * @example
 * ```ts
 * const traktor = new TraktorConnect({ port: 8000 });
 *
 * traktor.on('track', (data) => {
 *   console.log(`Now playing: ${data.artist} - ${data.title}`);
 * });
 *
 * await traktor.start();
 * ```
 */
export class TraktorConnect extends EventEmitter {
  private _port: number;
  private skipFirstTrack: boolean;
  private log: Logger;
  private server: Server | null = null;
  private lastTrackHash: string = '';
  private connectedClients: Set<Socket> = new Set();

  constructor(options: TraktorConnectOptions = {}) {
    super();
    this._port = options.port ?? 8000;
    this.skipFirstTrack = options.skipFirstTrack ?? true;
    this.log = options.logger ?? noopLogger;
  }

  /** The port the server is configured to listen on */
  get port(): number {
    return this._port;
  }

  /**
   * Start the TCP server and begin listening for Traktor connections.
   */
  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.log.debug('Starting TraktorConnect...');
    this.server = this.createTcpServer();

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this._port, () => {
        this.server!.removeListener('error', reject);
        resolve();
      });
    });

    this.log.info(`Listening for Traktor on port ${this._port}`);
    this.emit('ready');
  }

  /**
   * Stop the TCP server and clean up all connections.
   */
  async stop(): Promise<void> {
    this.log.debug('Stopping TraktorConnect...');

    for (const client of this.connectedClients) {
      client.destroy();
    }
    this.connectedClients.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    this.lastTrackHash = '';
    this.log.debug('TraktorConnect stopped');
  }

  /**
   * Update the port at runtime. If the server is running, it will be
   * restarted on the new port.
   */
  async configure(options: { port?: number }): Promise<void> {
    if (options.port !== undefined && options.port !== this._port) {
      this._port = options.port;

      if (this.server) {
        await this.stop();
        await this.start();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private handleTrackData(data: TraktorTrackData): void {
    if (!data.artist && !data.title) {
      return;
    }

    const trackHash = createHash('md5')
      .update(`${data.artist}${data.title}`)
      .digest('hex');

    if (trackHash === this.lastTrackHash) {
      return;
    }

    // Skip first track if configured (store hash but don't emit)
    if (this.skipFirstTrack && !this.lastTrackHash) {
      this.lastTrackHash = trackHash;
      return;
    }

    this.lastTrackHash = trackHash;
    this.log.debug(`New track: ${data.artist} - ${data.title}`);
    this.emit('track', data);
  }

  private createOggVorbisHandler(): OggDecoder {
    const createVorbisDecoder = (): VorbisDecoder => {
      const decoder = new VorbisDecoder();
      decoder.on('track', (data: TraktorTrackData) => this.handleTrackData(data));
      return decoder;
    };

    const oggDecoder = new OggDecoder();
    let vorbisDecoder = createVorbisDecoder();
    let lastOggStream: number | null = null;

    oggDecoder.on('page', (page: { stream: number }) => {
      if (page.stream !== lastOggStream) {
        lastOggStream = page.stream;
        oggDecoder.unpipe(vorbisDecoder);
        vorbisDecoder = createVorbisDecoder();
        oggDecoder.pipe(vorbisDecoder);
      }
    });

    return oggDecoder;
  }

  private createTcpServer(): Server {
    const server = createServer((socket: Socket) => {
      this.log.info('Traktor connected');
      this.connectedClients.add(socket);
      this.emit('connected');

      const dataBuffer = Buffer.alloc(65536);
      let dataBufferIndex = 0;
      let headerComplete = false;

      const oggDecoder = this.createOggVorbisHandler();
      const linebreak = Buffer.from([13, 10]);

      socket.on('data', (data: Buffer) => {
        const copied = data.copy(dataBuffer, dataBufferIndex);
        dataBufferIndex += copied;

        if (!headerComplete) {
          let offset: number;
          while ((offset = dataBuffer.indexOf(linebreak)) !== -1) {
            const headerLine = dataBuffer.subarray(0, offset);

            if (headerLine.length === 0) {
              headerComplete = true;
              socket.write('HTTP/1.0 200 OK\r\n\r\n');
              socket.pipe(oggDecoder);
            }

            dataBuffer.copy(dataBuffer, 0, offset + 2);
            dataBufferIndex -= offset + 2;
          }
        }
      });

      socket.on('end', () => {
        this.log.info('Traktor ending connection');
        this.connectedClients.delete(socket);
      });

      socket.on('close', () => {
        this.log.info('Traktor disconnected');
        this.connectedClients.delete(socket);
        this.emit('disconnected');
      });

      socket.on('error', (error) => {
        this.log.error('Socket error:', error.message);
        this.connectedClients.delete(socket);
      });
    });

    server.on('error', (error) => {
      this.emit('error', error);
    });

    return server;
  }
}
