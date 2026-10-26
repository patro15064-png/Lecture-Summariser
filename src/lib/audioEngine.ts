/**
 * Client-Side Audio Processing Engine using Web Audio API
 * - Decodes audio and video tracks natively
 * - Downsamples to 16kHz mono PCM for transcription API efficiency
 * - Chunks long audio files (~10 mins with 5s overlap)
 * - Cuts real audio clips for spaced repetition flashcards with ~3-5s padding
 * - Encodes AudioBuffers to standard WAV Blobs
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('Web Audio API is only available in browser environments.');
  }
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

/**
 * Decodes any audio or video file/blob into an AudioBuffer using the browser's native codecs.
 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  // decodeAudioData consumes the arrayBuffer, so we pass a slice or clone if needed
  return await ctx.decodeAudioData(arrayBuffer);
}

/**
 * Downsamples an AudioBuffer to mono 16kHz PCM (optimal for Whisper and Gemini ASR).
 */
export async function downsampleToMono16kHz(buffer: AudioBuffer): Promise<AudioBuffer> {
  const targetSampleRate = 16000;
  const targetLength = Math.ceil(buffer.duration * targetSampleRate);

  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  // Interleave channels if stereo or take mono channel
  let samples: Float32Array;
  if (numChannels === 1) {
    samples = buffer.getChannelData(0);
  } else {
    // Downmix to mono
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      samples[i] = (left[i] + right[i]) / 2;
    }
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = 1 * bytesPerSample;
  const dataByteCount = samples.length * bytesPerSample;
  const bufferByteCount = 44 + dataByteCount;

  const arrayBuffer = new ArrayBuffer(bufferByteCount);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteCount, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteCount, true);

  // Write PCM audio samples (clamped 16-bit integers)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Cuts a real audio clip from the audio buffer with padding (e.g. ~3s before and after).
 * Clamps duration to max 120 seconds (2 minutes).
 */
export async function sliceAudioClip(
  sourceBuffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number,
  paddingSeconds = 3.0
): Promise<{
  blob: Blob;
  url: string;
  actualStart: number;
  actualEnd: number;
  duration: number;
}> {
  const actualStart = Math.max(0, startSeconds - paddingSeconds);
  const rawEnd = Math.min(sourceBuffer.duration, endSeconds + paddingSeconds);
  // Cap at 2 minutes (120 seconds)
  const actualEnd = Math.min(rawEnd, actualStart + 120);
  const clipDuration = actualEnd - actualStart;

  const sampleRate = sourceBuffer.sampleRate;
  const startOffset = Math.floor(actualStart * sampleRate);
  const endOffset = Math.floor(actualEnd * sampleRate);
  const frameCount = Math.max(1, endOffset - startOffset);

  const ctx = getAudioContext();
  const clipBuffer = ctx.createBuffer(
    sourceBuffer.numberOfChannels,
    frameCount,
    sampleRate
  );

  for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
    const sourceData = sourceBuffer.getChannelData(ch);
    const clipData = clipBuffer.getChannelData(ch);
    clipData.set(sourceData.subarray(startOffset, endOffset));
  }

  const blob = audioBufferToWavBlob(clipBuffer);
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    actualStart: Math.round(actualStart * 100) / 100,
    actualEnd: Math.round(actualEnd * 100) / 100,
    duration: Math.round(clipDuration * 100) / 100,
  };
}

/**
 * Slices long audio into ~10 minute chunks with 5s overlap for transcription providers.
 */
export async function chunkAudioForTranscription(
  audioBuffer: AudioBuffer,
  chunkDurationSeconds = 600, // 10 minutes
  overlapSeconds = 5
): Promise<Array<{ offsetSeconds: number; blob: Blob; durationSeconds: number }>> {
  const totalDuration = audioBuffer.duration;
  if (totalDuration <= chunkDurationSeconds) {
    // Single chunk fits completely
    const mono16k = await downsampleToMono16kHz(audioBuffer);
    const blob = audioBufferToWavBlob(mono16k);
    return [{ offsetSeconds: 0, blob, durationSeconds: totalDuration }];
  }

  const chunks: Array<{ offsetSeconds: number; blob: Blob; durationSeconds: number }> = [];
  let currentStart = 0;

  while (currentStart < totalDuration) {
    const currentEnd = Math.min(totalDuration, currentStart + chunkDurationSeconds);
    const chunkLength = currentEnd - currentStart;

    const sampleRate = audioBuffer.sampleRate;
    const startOffset = Math.floor(currentStart * sampleRate);
    const endOffset = Math.floor(currentEnd * sampleRate);
    const frameCount = endOffset - startOffset;

    const ctx = getAudioContext();
    const subBuffer = ctx.createBuffer(1, frameCount, sampleRate);
    const monoChannel = subBuffer.getChannelData(0);

    // Downmix to mono channel
    if (audioBuffer.numberOfChannels === 1) {
      monoChannel.set(audioBuffer.getChannelData(0).subarray(startOffset, endOffset));
    } else {
      const left = audioBuffer.getChannelData(0).subarray(startOffset, endOffset);
      const right = audioBuffer.getChannelData(1).subarray(startOffset, endOffset);
      for (let i = 0; i < frameCount; i++) {
        monoChannel[i] = (left[i] + right[i]) / 2;
      }
    }

    const resampled = await downsampleToMono16kHz(subBuffer);
    const blob = audioBufferToWavBlob(resampled);

    chunks.push({
      offsetSeconds: currentStart,
      blob,
      durationSeconds: chunkLength,
    });

    if (currentEnd >= totalDuration) {
      break;
    }
    // Advance with overlap
    currentStart += chunkDurationSeconds - overlapSeconds;
  }

  return chunks;
}
