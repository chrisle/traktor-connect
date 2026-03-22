/**
 * @fileoverview Vorbis comment decoder - extracts metadata from a Vorbis stream.
 * Parses Vorbis identification and comment headers to extract track metadata.
 */

import { Writable } from 'stream';
import type { TraktorTrackData } from './types.js';

/**
 * Vorbis comment decoder.
 * Accepts OGG page payloads and extracts Vorbis comment metadata.
 * Emits 'track' events with parsed TraktorTrackData.
 */
export class VorbisDecoder extends Writable {
  private currentStep = 0;
  private buffer = Buffer.alloc(131072, 0);
  private bufferPos = 0;

  _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
    if (this.currentStep < 2) {
      chunk.copy(this.buffer, this.bufferPos);
      this.bufferPos += chunk.length;
    }

    if (this.currentStep === 0 && this.bufferPos >= 30) {
      if (this.buffer.readUInt8(0) !== 1) {
        callback(new Error('Expected header 1'));
        return;
      }
      this.currentStep = 1;
      this.buffer.copy(this.buffer, 0, 30, this.buffer.length - 30);
      this.bufferPos -= 30;
    } else {
      const comments = this.readVorbisComment();
      if (comments) {
        this.emit('track', parseComments(comments));
        this.currentStep = 2;
      }
    }

    callback();
  }

  private readVorbisComment(): string[] | null {
    try {
      const vendorLength = this.buffer.readUInt32LE(7);
      const userCommentListLength = this.buffer.readUInt32LE(11 + vendorLength);
      const userComments: string[] = [];

      let currentPos = 15 + vendorLength;

      for (let i = 0; i < userCommentListLength; i++) {
        const commentLength = this.buffer.readUInt32LE(currentPos);
        const comment = this.buffer.toString('utf-8', currentPos + 4, currentPos + 4 + commentLength);
        userComments.push(comment);
        currentPos += 4 + commentLength;
      }

      if (currentPos > this.bufferPos) {
        return null;
      }

      const framingBit = this.buffer.readUInt8(currentPos);
      if (framingBit !== 1) {
        return null;
      }

      if (this.buffer.readUInt8(0) !== 3 || this.buffer.toString('utf-8', 1, 7) !== 'vorbis') {
        return null;
      }

      return userComments;
    } catch {
      return null;
    }
  }
}

/**
 * Parse Vorbis comments into track data object
 */
function parseComments(comments: string[]): TraktorTrackData {
  const result: Record<string, string> = {};

  for (const comment of comments) {
    const [key, ...valueParts] = comment.split('=');
    if (key) {
      result[key.toLowerCase()] = valueParts.join('=');
    }
  }

  return {
    encoder: result.encoder,
    artist: result.artist || '',
    title: result.title || '',
  };
}
