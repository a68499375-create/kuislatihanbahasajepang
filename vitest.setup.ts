import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.speechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: vi.fn().mockReturnValue([]),
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
  writable: true,
});

// Mock SpeechSynthesisUtterance correctly as a class
class MockSpeechSynthesisUtterance {
  text: string;
  volume: number = 1;
  rate: number = 1;
  pitch: number = 1;
  lang: string = 'ja-JP';

  constructor(text: string) {
    this.text = text;
  }
}
(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// Mock Audio correctly as a class
class MockAudio {
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
}
(window as any).Audio = MockAudio;

// Mock AudioContext correctly as a class
class MockAudioContext {
  state = 'suspended';
  resume = vi.fn().mockResolvedValue(undefined);
}
(window as any).AudioContext = MockAudioContext;

// Mock ResizeObserver correctly as a class
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(window as any).ResizeObserver = MockResizeObserver;

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn();

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
  width: 100,
  height: 100,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
});
