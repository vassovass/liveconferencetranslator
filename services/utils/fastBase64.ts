/**
 * Fast Base64 encoding utilities
 *
 * Optimized for audio chunk encoding - uses chunk-based processing
 * instead of character-by-character string concatenation (O(n) vs O(n²))
 */

/**
 * Convert Uint8Array to Base64 string efficiently
 * Uses chunked processing to avoid string allocation overhead
 */
export function uint8ToBase64Fast(uint8: Uint8Array): string {
  // Process in 32KB chunks to avoid call stack limits with spread operator
  const CHUNK_SIZE = 0x8000;

  if (uint8.length <= CHUNK_SIZE) {
    // Small buffer - direct conversion
    return btoa(String.fromCharCode.apply(null, uint8 as unknown as number[]));
  }

  // Large buffer - chunked processing
  const chunks: string[] = [];
  for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
    const chunk = uint8.subarray(i, Math.min(i + CHUNK_SIZE, uint8.length));
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(chunks.join(''));
}

/**
 * Convert Int16Array to Base64 string efficiently
 * Handles the Int16 -> Uint8 view conversion internally
 */
export function int16ToBase64Fast(int16: Int16Array): string {
  const uint8 = new Uint8Array(int16.buffer);
  return uint8ToBase64Fast(uint8);
}

/**
 * Resample audio from source sample rate to 16kHz
 * Uses linear interpolation for simplicity
 */
export function resampleTo16k(
  input: Float32Array,
  inputSampleRate: number
): Float32Array {
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

/**
 * Convert Float32 audio samples to Int16 PCM
 */
export function float32ToInt16(input: Float32Array): Int16Array {
  const int16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}
