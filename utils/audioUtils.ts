// Minimal shape that matches the @google/genai Blob type to avoid importing
// the full package here (helps in environments where type resolution may fail).
type PCMBlob = { data: string; mimeType: string };

/**
 * Encodes a Float32Array of audio data into a base64 string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Creates a PCM Blob compatible with Gemini Live API from Float32 audio data.
 * Converts Float32 to Int16.
 */
export function createBlob(data: Float32Array): PCMBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] range before scaling to avoid wrapping
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Lightweight linear resampler to 16k for devices (especially mobile)
 * that run input audio contexts at 44.1k/48k.
 */
export function resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;

  const targetSampleRate = 16000;
  const sampleRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(input.length / sampleRatio);
  const output = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const sourceIndex = i * sampleRatio;
    const index0 = Math.floor(sourceIndex);
    const index1 = Math.min(index0 + 1, input.length - 1);
    const weight = sourceIndex - index0;
    output[i] = input[index0] * (1 - weight) + input[index1] * weight;
  }

  return output;
}
