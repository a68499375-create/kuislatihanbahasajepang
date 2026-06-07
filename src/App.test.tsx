import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.HTMLElement.prototype.scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('App Component', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Yokoso! Selamat Datang/i)).toBeInTheDocument();
  });

  it('renders default kuis view content', () => {
    render(<App />);
    expect(screen.getByText(/Latihan Aksara Kana/i)).toBeInTheDocument();
  });

  it('opens auth modal when Buka Sesi is clicked', async () => {
    render(<App />);
    const startText = screen.getByText(/Buka Sesi/i);
    fireEvent.click(startText);

    // Check if the modal title "Autentikasi" or something related to Auth is present
    // Just dump the tree to see what's in the modal or wait for a known text
  });
});
