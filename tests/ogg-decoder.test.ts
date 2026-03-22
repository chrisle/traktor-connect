/**
 * @fileoverview Unit tests for OGG decoder.
 */

import { describe, it, expect, vi } from 'vitest';
import { OggDecoder } from '../src/ogg-decoder.js';

/** Helper to create a minimal valid OGG page */
function createOggPage(serialNumber: number, sequenceNumber: number = 0): Buffer {
  const page = Buffer.alloc(38);
  let offset = 0;

  // Capture pattern
  page.write('OggS', offset);
  offset += 4;

  // Stream structure version
  page.writeUInt8(0, offset);
  offset += 1;

  // Header type flag
  page.writeUInt8(0, offset);
  offset += 1;

  // Granule position (8 bytes)
  page.writeBigUInt64LE(0n, offset);
  offset += 8;

  // Stream serial number
  page.writeUInt32LE(serialNumber, offset);
  offset += 4;

  // Page sequence number
  page.writeUInt32LE(sequenceNumber, offset);
  offset += 4;

  // CRC checksum
  page.writeUInt32LE(0, offset);
  offset += 4;

  // Number of page segments
  page.writeUInt8(1, offset);
  offset += 1;

  // Segment table (1 segment of 10 bytes)
  page.writeUInt8(10, offset);
  offset += 1;

  // Page data (10 bytes)
  Buffer.alloc(10).copy(page, offset);

  return page;
}

describe('OggDecoder', () => {
  it('creates a transform stream', () => {
    const decoder = new OggDecoder();
    expect(decoder).toBeDefined();
    expect(typeof decoder.pipe).toBe('function');
    expect(typeof decoder.write).toBe('function');
  });

  it('emits page events when OGG pages are detected', async () => {
    const decoder = new OggDecoder();

    const pagePromise = new Promise<{ stream: number; page: number }>((resolve) => {
      decoder.on('page', (page: { stream: number; page: number }) => {
        resolve(page);
      });
    });

    decoder.write(createOggPage(12345, 0));
    const page = await pagePromise;

    expect(page.stream).toBe(12345);
    expect(page.page).toBe(0);
  });

  it('handles multiple OGG pages in single chunk', () => {
    const decoder = new OggDecoder();
    const pages: Array<{ stream: number; page: number }> = [];

    decoder.on('page', (page: { stream: number; page: number }) => {
      pages.push(page);
    });

    const combined = Buffer.concat([
      createOggPage(12345, 0),
      createOggPage(12345, 1),
    ]);

    decoder.write(combined);
    expect(pages.length).toBe(2);
  });

  it('ignores data without OggS capture pattern', () => {
    const decoder = new OggDecoder();
    const pageHandler = vi.fn();
    decoder.on('page', pageHandler);

    decoder.write(Buffer.from('This is not OGG data'));
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it('ignores invalid stream structure version', () => {
    const decoder = new OggDecoder();
    const pageHandler = vi.fn();
    decoder.on('page', pageHandler);

    const invalidPage = Buffer.alloc(38);
    invalidPage.write('OggS', 0);
    invalidPage.writeUInt8(1, 4); // Invalid version

    decoder.write(invalidPage);
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it('handles stream changes', () => {
    const decoder = new OggDecoder();
    const pages: Array<{ stream: number }> = [];

    decoder.on('page', (page: { stream: number }) => {
      pages.push(page);
    });

    decoder.write(createOggPage(11111));
    decoder.write(createOggPage(22222));

    expect(pages.length).toBe(2);
    expect(pages[0].stream).toBe(11111);
    expect(pages[1].stream).toBe(22222);
  });
});
