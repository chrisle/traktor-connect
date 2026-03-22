/**
 * @fileoverview Types for traktor-connect.
 */

export interface TraktorConnectOptions {
  /** TCP port to listen on for Traktor broadcast connections (default: 8000) */
  port?: number;
  /** Whether to skip emitting the first track (Traktor sends current track on connect) (default: true) */
  skipFirstTrack?: boolean;
  /** Logger implementation (default: noopLogger) */
  logger?: Logger;
}

export interface TraktorTrackData {
  artist: string;
  title: string;
  encoder?: string;
}

export interface TraktorConnectEvents {
  track: (data: TraktorTrackData) => void;
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  ready: () => void;
}

export interface Logger {
  trace(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export const noopLogger: Logger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
};
