/**
 * @fileoverview Unit tests for TraktorConnect.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { TraktorConnect } from '../src/traktor-connect.js';

describe('TraktorConnect', () => {
  let traktor: TraktorConnect | null = null;

  afterEach(async () => {
    if (traktor) {
      await traktor.stop();
      traktor = null;
    }
  });

  describe('constructor', () => {
    it('uses default port 8000', () => {
      traktor = new TraktorConnect();
      expect(traktor.port).toBe(8000);
    });

    it('accepts custom port', () => {
      traktor = new TraktorConnect({ port: 9999 });
      expect(traktor.port).toBe(9999);
    });

    it('accepts a logger', () => {
      const logger = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      traktor = new TraktorConnect({ logger });
      expect(traktor.port).toBe(8000);
    });
  });

  describe('start/stop lifecycle', () => {
    it('emits ready event on start', async () => {
      traktor = new TraktorConnect({ port: 0 }); // port 0 = random available port
      const readyPromise = new Promise<void>((resolve) => {
        traktor!.on('ready', resolve);
      });

      await traktor.start();
      await readyPromise;
    });

    it('can be stopped when not started', async () => {
      traktor = new TraktorConnect();
      await expect(traktor.stop()).resolves.toBeUndefined();
    });

    it('can start and stop cleanly', async () => {
      traktor = new TraktorConnect({ port: 0 });
      await traktor.start();
      await traktor.stop();
    });

    it('is idempotent when already started', async () => {
      traktor = new TraktorConnect({ port: 0 });
      await traktor.start();
      await traktor.start(); // should not throw
    });
  });

  describe('configure', () => {
    it('updates port when not running', async () => {
      traktor = new TraktorConnect({ port: 8000 });
      await traktor.configure({ port: 9000 });
      expect(traktor.port).toBe(9000);
    });
  });

  describe('event emitter', () => {
    it('is an EventEmitter', () => {
      traktor = new TraktorConnect();
      expect(typeof traktor.on).toBe('function');
      expect(typeof traktor.emit).toBe('function');
    });

    it('can subscribe to track events', () => {
      traktor = new TraktorConnect();
      traktor.on('track', () => {});
    });

    it('can subscribe to error events', () => {
      traktor = new TraktorConnect();
      traktor.on('error', () => {});
    });

    it('can subscribe to connected/disconnected events', () => {
      traktor = new TraktorConnect();
      traktor.on('connected', () => {});
      traktor.on('disconnected', () => {});
    });
  });
});
