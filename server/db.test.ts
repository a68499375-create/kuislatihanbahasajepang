import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hashPassword, generateUID, mergeDatabases, getUsers, saveUsers } from './db';
import crypto from 'crypto';
import type { DbData, User } from './db';
import fs from 'fs';
import path from 'path';

vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
    }
  };
});

vi.mock('path', async () => {
  const actualPath = await vi.importActual<typeof import('path')>('path');
  return {
    default: {
      ...actualPath,
      join: (...args: string[]) => args.join('/'), // simplify path.join
      dirname: (p: string) => actualPath.dirname(p),
    }
  };
});

// Mock syncWithPeer so it doesn't try to fetch or run background tasks
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();
  return {
    ...actual,
    syncWithPeer: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Pure Functions in db.ts', () => {
  describe('hashPassword', () => {
    it('should correctly hash a password using sha256', () => {
      const password = 'mysecretpassword';
      const expectedHash = crypto.createHash('sha256').update(password).digest('hex');
      expect(hashPassword(password)).toBe(expectedHash);
    });

    it('should return different hashes for different passwords', () => {
      expect(hashPassword('pass1')).not.toBe(hashPassword('pass2'));
    });
  });

  describe('generateUID', () => {
    it('should start with "UID-"', () => {
      const uid = generateUID();
      expect(uid.startsWith('UID-')).toBe(true);
    });

    it('should be exactly 16 characters long', () => {
      // 'UID-' (4) + 6 bytes hex (12) = 16
      const uid = generateUID();
      expect(uid.length).toBe(16);
    });

    it('should generate uppercase hex after "UID-"', () => {
      const uid = generateUID();
      const hexPart = uid.substring(4);
      expect(/^[0-9A-F]{12}$/.test(hexPart)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const uid1 = generateUID();
      const uid2 = generateUID();
      expect(uid1).not.toBe(uid2);
    });
  });
});

describe('Database Merging Logic (mergeDatabases)', () => {
  const createEmptyDb = (): DbData => ({
    users: [],
    reports: [],
    chatMessages: [],
    tickets: [],
    bannedIps: [],
    bannedDevices: []
  });

  const createDummyUser = (uid: string, poin: number): User => ({
    uid,
    username: `user_${uid}`,
    email: `${uid}@test.com`,
    passwordHash: 'hash',
    displayName: `User ${uid}`,
    avatar: 'avatar.png',
    poin,
    xp: 0
  });

  it('should detect no changes for identical empty databases', () => {
    const local = createEmptyDb();
    const remote = createEmptyDb();
    const result = mergeDatabases(local, remote);
    expect(result.changed).toBe(false);
    expect(result.merged.users).toEqual([]);
  });

  it('should add a new user from remote and mark as changed', () => {
    const local = createEmptyDb();
    const remote = createEmptyDb();
    remote.users = [createDummyUser('1', 100)];

    const result = mergeDatabases(local, remote);
    expect(result.changed).toBe(true);
    expect(result.merged.users).toHaveLength(1);
    expect(result.merged.users[0].uid).toBe('1');
  });

  it('should prefer remote user data if remote score is higher', () => {
    const local = createEmptyDb();
    const remote = createEmptyDb();

    const localUser = createDummyUser('1', 50);
    const remoteUser = createDummyUser('1', 100);

    local.users = [localUser];
    remote.users = [remoteUser];

    const result = mergeDatabases(local, remote);
    expect(result.changed).toBe(true);
    expect(result.merged.users[0].poin).toBe(100);
  });

  it('should prefer remote user data if remote scoreUpdatedAt is newer', () => {
    const local = createEmptyDb();
    const remote = createEmptyDb();

    const localUser = createDummyUser('1', 50);
    localUser.scoreUpdatedAt = '2023-01-01T00:00:00Z';

    const remoteUser = createDummyUser('1', 50); // Same points
    remoteUser.scoreUpdatedAt = '2023-01-02T00:00:00Z'; // Newer

    local.users = [localUser];
    remote.users = [remoteUser];

    const result = mergeDatabases(local, remote);
    expect(result.changed).toBe(true);
    expect(result.merged.users[0].scoreUpdatedAt).toBe('2023-01-02T00:00:00Z');
  });

  it('should not update local if remote score is lower and no timestamps are provided', () => {
    const local = createEmptyDb();
    const remote = createEmptyDb();

    const localUser = createDummyUser('1', 100);
    const remoteUser = createDummyUser('1', 50);

    local.users = [localUser];
    remote.users = [remoteUser];

    const result = mergeDatabases(local, remote);
    expect(result.changed).toBe(false);
    expect(result.merged.users[0].poin).toBe(100); // Kept local
  });

  it('should detect metadata changes', () => {
    const local = createEmptyDb();
    const remote = createEmptyDb();

    const localUser = createDummyUser('1', 100);
    const remoteUser = createDummyUser('1', 100);
    remoteUser.displayName = "New Name"; // changed metadata

    local.users = [localUser];
    remote.users = [remoteUser];

    const result = mergeDatabases(local, remote);
    expect(result.changed).toBe(true);
    expect(result.merged.users[0].displayName).toBe("New Name");
  });
});

describe('Database File Operations (with mocked fs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default setup: mock that directories and files exist to prevent initializeDb from creating them by default
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getUsers', () => {
    it('should correctly parse users from db.json', () => {
      const mockUsers = [{ uid: '1', username: 'testuser', email: 'test@example.com' }];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ users: mockUsers }));

      const users = getUsers();
      expect(users).toHaveLength(1);
      expect(users[0].uid).toBe('1');
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should assign "dev" role to adminbaik users and trigger writeFileSync', () => {
      const mockUsers = [{ uid: '1', username: 'adminbaik', email: 'admin@test.com', role: 'user' }];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ users: mockUsers }));

      const users = getUsers();
      expect(users[0].role).toBe('dev');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle corrupt file context and return empty array', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('Corrupt file'); });
      const users = getUsers();
      expect(users).toEqual([]);
    });
  });

  describe('saveUsers', () => {
    it('should successfully stringify and write users to simulated file', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ users: [], reports: [] }));
      // Clear mock calls to ignore the write from initializeDb migration
      vi.mocked(fs.writeFileSync).mockClear();

      const newUsers = [{ uid: '2', username: 'newuser', email: 'new@example.com' } as User];

      saveUsers(newUsers);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[vi.mocked(fs.writeFileSync).mock.calls.length - 1];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.users).toHaveLength(1);
      expect(writtenData.users[0].uid).toBe('2');
    });

    it('should catch and log errors during write failure without crashing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ users: [] }));
      vi.mocked(fs.writeFileSync).mockImplementation(() => { throw new Error('Write failure'); });

      saveUsers([]);

      expect(consoleSpy).toHaveBeenCalledWith('Error writing to db.json (users):', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
