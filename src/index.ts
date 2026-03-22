/**
 * traktor-connect - Receive track metadata from Traktor Pro via OGG Vorbis broadcast.
 *
 * @module traktor-connect
 */

export { TraktorConnect } from './traktor-connect.js';
export { OggDecoder } from './ogg-decoder.js';
export { VorbisDecoder } from './vorbis-decoder.js';
export { noopLogger } from './types.js';
export type {
  TraktorConnectOptions,
  TraktorTrackData,
  TraktorConnectEvents,
  Logger,
} from './types.js';
