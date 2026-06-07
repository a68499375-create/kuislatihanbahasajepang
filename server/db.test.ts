import { describe, it, expect } from 'vitest';
import { hashPassword } from './db';
import crypto from 'crypto';

describe('hashPassword', () => {
  it('should return a sha256 hash of the password', () => {
    const password = 'mySecretPassword123';
    const expectedHash = crypto.createHash('sha256').update(password).digest('hex');
    const result = hashPassword(password);
    expect(result).toBe(expectedHash);
  });

  it('should return different hashes for different passwords', () => {
    const hash1 = hashPassword('password123');
    const hash2 = hashPassword('Password123');
    expect(hash1).not.toBe(hash2);
  });

  it('should consistently return the same hash for the same password', () => {
    const password = 'consistentPassword';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);
    expect(hash1).toBe(hash2);
  });

  it('should handle empty strings', () => {
    const password = '';
    const expectedHash = crypto.createHash('sha256').update(password).digest('hex');
    const result = hashPassword(password);
    expect(result).toBe(expectedHash);
  });
});
