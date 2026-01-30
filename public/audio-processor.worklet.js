/**
 * AudioWorklet Processor for Low-Latency Audio Capture
 *
 * Runs on a separate audio thread for minimal latency.
 * Accumulates 512 samples (~32ms at 16kHz) before sending to main thread.
 * Converts Float32 to Int16 PCM inline for efficiency.
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Buffer to accumulate samples (target: 512 samples = ~32ms at 16kHz)
    this.buffer = new Float32Array(512);
    this.bufferIndex = 0;

    // Track if we should be processing
    this.isActive = true;

    // Listen for control messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.isActive = false;
      } else if (event.data.type === 'start') {
        this.isActive = true;
      }
    };
  }

  /**
   * Process audio frames - called ~375 times/sec with 128 samples each
   */
  process(inputs, outputs, parameters) {
    if (!this.isActive) return true;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];

    // Calculate RMS volume for this frame
    let sum = 0;
    for (let i = 0; i < inputChannel.length; i++) {
      sum += inputChannel[i] * inputChannel[i];
    }
    const rms = Math.sqrt(sum / inputChannel.length);

    // Accumulate samples into buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      // When buffer is full, send to main thread
      if (this.bufferIndex >= this.buffer.length) {
        this.sendBuffer(rms);
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  /**
   * Convert Float32 buffer to Int16 PCM and send to main thread
   */
  sendBuffer(volume) {
    // Convert Float32 to Int16 PCM
    const int16 = new Int16Array(this.buffer.length);
    for (let i = 0; i < this.buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send to main thread with volume info
    this.port.postMessage({
      type: 'audio',
      samples: int16.buffer,
      volume: Math.min(volume * 5, 1) // Normalized volume
    }, [int16.buffer]); // Transfer buffer for zero-copy

    // Recreate buffer after transfer
    this.buffer = new Float32Array(512);
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
