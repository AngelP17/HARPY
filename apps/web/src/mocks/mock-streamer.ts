import { harpy } from "@harpy/shared-types";

export class MockStreamer {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onMessage: (data: ArrayBuffer) => void;

  constructor(onMessage: (data: ArrayBuffer) => void) {
    this.onMessage = onMessage;
  }

  start() {
    this.intervalId = setInterval(() => {
      this.generateBatch();
    }, 1000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private generateBatch() {
    const deltas: harpy.v1.ITrackDelta[] = [];
    
    // Generate some mock tracks over New York
    for (let i = 0; i < 50; i++) {
      deltas.push({
        id: `track_${i}`,
        position: {
          lat: 40.7128 + (Math.random() - 0.5) * 0.1,
          lon: -74.0060 + (Math.random() - 0.5) * 0.1,
          alt: 10000 + Math.random() * 5000,
        },
        heading: Math.random() * 360,
        speed: 200 + Math.random() * 100,
        kind: harpy.v1.TrackKind.TRACK_KIND_AIRCRAFT,
        providerId: "mock-streamer",
        meta: {},
        tsMs: Date.now(),
      });
    }

    const envelope = harpy.v1.Envelope.create({
      schemaVersion: "1.0.0",
      trackDeltaBatch: { deltas },
    });

    const buffer = harpy.v1.Envelope.encode(envelope).finish();
    const frame = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    this.onMessage(frame);
  }
}
