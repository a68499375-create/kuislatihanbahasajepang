import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from './db';
import fs from 'fs';

vi.mock('fs');

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fs.existsSync to return true
    (fs.existsSync as any).mockReturnValue(true);

    // Mock fs.readFileSync to return an empty db state initially
    (fs.readFileSync as any).mockReturnValue(JSON.stringify({
      users: [],
      reports: [],
      chatMessages: [],
      tickets: [],
      bannedIps: [],
      bannedDevices: []
    }));

    // Mock fs.writeFileSync to just do nothing
    (fs.writeFileSync as any).mockImplementation(() => {});
  });

  it('creates a regular user with default properties', () => {
    const userInfo = {
      email: 'user@example.com',
      username: 'normalUser',
      passwordHash: 'hash123',
      displayName: 'Normal User',
      avatar: 'avatar1.png'
    };

    const user = createUser(userInfo);

    expect(user).toMatchObject({
      email: userInfo.email,
      username: userInfo.username,
      passwordHash: userInfo.passwordHash,
      displayName: userInfo.displayName,
      avatar: userInfo.avatar,
      poin: 0,
      xp: 0,
      deskripsi: 'Halo! Saya sedang belajar Bahasa Jepang.',
      ttl: '-',
      role: 'user',
      termsAccepted: false
    });

    // Check that UID was generated
    expect(user.uid).toMatch(/^UID-[A-Z0-9]+$/);

    // Check that saveUsers called writeFileSync
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('creates an admin/dev user when username is admin baik', () => {
    const userInfo = {
      email: 'user2@example.com',
      username: 'admin baik',
      passwordHash: 'hash123',
      displayName: 'Admin User',
      avatar: 'avatar1.png'
    };

    const user = createUser(userInfo);

    expect(user.role).toBe('dev');
  });

  it('creates an admin/dev user when email includes specific identifier', () => {
    const userInfo = {
      email: 'test_a68499375@example.com',
      username: 'testadmin',
      passwordHash: 'hash123',
      displayName: 'Admin User',
      avatar: 'avatar1.png'
    };

    const user = createUser(userInfo);

    expect(user.role).toBe('dev');
  });

  it('creates an admin/dev user when displayName includes adminbaik', () => {
    const userInfo = {
      email: 'user3@example.com',
      username: 'testuser3',
      passwordHash: 'hash123',
      displayName: 'This is adminbaik',
      avatar: 'avatar1.png'
    };

    const user = createUser(userInfo);

    expect(user.role).toBe('dev');
  });
});
