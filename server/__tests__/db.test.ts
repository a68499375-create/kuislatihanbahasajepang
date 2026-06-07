import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { banIp } from '../db';

vi.mock('fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('fs')>();
  return {
    ...mod,
    default: {
      ...mod,
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('db', () => {
  describe('banIp', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Initialize db file exists
      vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should catch and log error if fs.readFileSync throws', () => {
      const error = new Error('Mock fs.readFileSync error');

      // We need to use fs.readFileSync from default export because it's imported that way in db.ts
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw error;
      });

      banIp('192.168.1.1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving banIp:', error);
    });
  });
});
