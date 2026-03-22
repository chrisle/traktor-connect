/**
 * @fileoverview OGG container decoder - extracts pages from an OGG stream.
 * Parses the OGG page structure and emits raw page data.
 */

import { Transform } from 'stream';

/**
 * OGG container decoder.
 * Transforms an OGG byte stream into individual page payloads.
 * Emits 'page' events with stream serial number and page sequence number.
 */
export class OggDecoder extends Transform {
  private bufferPos = 0;
  private pageBuffer = Buffer.alloc(131072, 0);

  _transform(chunk: Buffer, _encoding: string, callback: () => void): void {
    const copied = chunk.copy(this.pageBuffer, this.bufferPos);
    this.bufferPos += copied;

    let capturePatternPos = this.pageBuffer.indexOf('OggS');

    while (capturePatternPos !== -1) {
      const header = this.parseHeader(capturePatternPos);

      if (header && this.bufferPos >= capturePatternPos + this.pageLength(header)) {
        const packetFragmentLength = this.dataLength(header);
        const packetFragmentStart = capturePatternPos + 27 + header.pageSegments;

        const page = Buffer.alloc(packetFragmentLength);
        this.pageBuffer.copy(page, 0, packetFragmentStart, packetFragmentStart + packetFragmentLength);

        this.emit('page', { stream: header.streamSerialNumber, page: header.pageSequenceNumber });
        this.push(page);

        this.pageBuffer.copy(this.pageBuffer, 0, packetFragmentStart + packetFragmentLength);
        this.pageBuffer.fill(0, this.pageBuffer.length - (packetFragmentStart + packetFragmentLength));
        this.bufferPos -= packetFragmentStart + packetFragmentLength;

        capturePatternPos = this.pageBuffer.indexOf('OggS');
      } else {
        break;
      }
    }

    callback();
  }

  private dataLength(header: { segmentTable: Uint8Array }): number {
    return header.segmentTable.reduce((a, b) => a + b, 0);
  }

  private pageLength(header: { pageSegments: number; segmentTable: Uint8Array }): number {
    return 27 + header.pageSegments + this.dataLength(header);
  }

  private parseHeader(position: number): {
    streamSerialNumber: number;
    pageSequenceNumber: number;
    pageSegments: number;
    segmentTable: Uint8Array;
  } | null {
    const streamStructureVersion = this.pageBuffer.readUInt8(position + 4);
    if (streamStructureVersion !== 0) {
      return null;
    }

    const streamSerialNumber = this.pageBuffer.readUInt32LE(position + 14);
    const pageSequenceNumber = this.pageBuffer.readUInt32LE(position + 18);
    const pageSegments = this.pageBuffer.readUInt8(position + 26);
    const segmentTable = new Uint8Array(pageSegments);
    this.pageBuffer.copy(segmentTable, 0, position + 27, position + 27 + pageSegments);

    return { streamSerialNumber, pageSequenceNumber, pageSegments, segmentTable };
  }
}
