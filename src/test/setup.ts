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
    postMessage(data: unknown) {
      if (typeof data === 'string') {
        const cmd = data.trim();
        if (cmd === 'uci') {
          setTimeout(() => {
            this.onmessage?.({ data: 'uciok' } as MessageEvent);
          }, 0);
        } else if (cmd === 'isready') {
          setTimeout(() => {
            this.onmessage?.({ data: 'readyok' } as MessageEvent);
          }, 0);
        } else if (cmd.startsWith('go')) {
          setTimeout(() => {
            this.onmessage?.({ data: 'info depth 8 score cp 20 pv e2e4 e7e5' } as MessageEvent);
            this.onmessage?.({ data: 'bestmove e2e4' } as MessageEvent);
          }, 0);
        } else if (cmd === 'stop') {
          setTimeout(() => {
            this.onmessage?.({ data: 'bestmove (none)' } as MessageEvent);
          }, 0);
        }
      }
    }
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }
  // @ts-expect-error mock worker
  window.Worker = MockWorker;
}
