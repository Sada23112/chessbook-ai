import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock Web Worker if not available in jsdom
if (typeof window !== 'undefined' && !window.Worker) {
  class MockWorker {
    url: string;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: ErrorEvent) => void) | null = null;
    constructor(stringUrl: string) {
      this.url = stringUrl;
    }
    postMessage(_data: unknown) {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }
  // @ts-expect-error mock worker
  window.Worker = MockWorker;
}
