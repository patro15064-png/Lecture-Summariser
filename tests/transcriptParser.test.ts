import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseSRT,
  parseVTT,
  parseTimestampToSeconds,
  formatTime,
  formatTimeRange,
  stitchOverlappingChunks,
} from '../src/lib/transcriptParser';

describe('Transcript Parser & Formatter', () => {
  it('parses timestamps into precise seconds', () => {
    assert.strictEqual(parseTimestampToSeconds('00:01:23.456'), 83.456);
    assert.strictEqual(parseTimestampToSeconds('01:23,500'), 83.5);
    assert.strictEqual(parseTimestampToSeconds('01:00:00.000'), 3600);
  });

  it('formats time and ranges cleanly', () => {
    assert.strictEqual(formatTime(83), '01:23');
    assert.strictEqual(formatTime(3665), '1:01:05');
    assert.strictEqual(formatTimeRange(140, 170), '02:20-02:50');
  });

  it('parses SubRip (.srt) content into segments', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,500
Hello and welcome to multivariable calculus.

2
00:00:05,000 --> 00:00:09,200
Today we examine directional derivatives and gradients.`;

    const segments = parseSRT(srt);
    assert.strictEqual(segments.length, 2);
    assert.strictEqual(segments[0].start, 1);
    assert.strictEqual(segments[0].end, 4.5);
    assert.strictEqual(segments[0].text, 'Hello and welcome to multivariable calculus.');
    assert.strictEqual(segments[1].start, 5);
  });

  it('parses WebVTT (.vtt) content into segments', () => {
    const vtt = `WEBVTT - Sample

00:01:00.000 --> 00:01:05.500
The gradient vector points in the direction of steepest ascent.

00:01:06.000 --> 00:01:10.000
It is perpendicular to level sets.`;

    const segments = parseVTT(vtt);
    assert.strictEqual(segments.length, 2);
    assert.strictEqual(segments[0].start, 60);
    assert.strictEqual(segments[0].end, 65.5);
    assert.strictEqual(segments[1].start, 66);
  });

  it('stitches overlapping chunks and deduplicates overlap boundaries', () => {
    const chunk1 = {
      offsetSeconds: 0,
      segments: [
        { id: 'c1-1', start: 0, end: 10, text: 'First segment of lecture.' },
        { id: 'c1-2', start: 595, end: 602, text: 'Boundary sentence spanning chunks.' },
      ],
    };

    const chunk2 = {
      offsetSeconds: 595,
      segments: [
        { id: 'c2-1', start: 0, end: 7, text: 'Boundary sentence spanning chunks.' }, // Duplicate of c1-2 with offset
        { id: 'c2-2', start: 10, end: 20, text: 'Second chunk continuation.' },
      ],
    };

    const stitched = stitchOverlappingChunks([chunk1, chunk2]);
    assert.strictEqual(stitched.length, 3);
    assert.strictEqual(stitched[0].start, 0);
    assert.strictEqual(stitched[1].start, 595);
    assert.strictEqual(stitched[2].start, 605);
  });
});
