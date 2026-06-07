import { describe, it, expect } from 'vitest';
import { mergeDatabases, DbData, User, Report, ChatMessage, Ticket } from './db';

describe('mergeDatabases', () => {
  const createBaseDb = (): DbData => ({
    users: [],
    reports: [],
    chatMessages: [],
    announcement: 'Selamat datang di Zenith Nihongo!',
    notification: 'Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸',
    tickets: [],
    bannedIps: [],
    bannedDevices: []
  });

  const createUser = (overrides: Partial<User>): User => ({
    uid: 'u1',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hash',
    displayName: 'Test User',
    avatar: 'avatar.png',
    poin: 0,
    xp: 0,
    ...overrides
  });

  const createReport = (overrides: Partial<Report>): Report => ({
    id: 'r1',
    uid: 'u1',
    username: 'testuser',
    category: 'bug',
    message: 'Test bug',
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...overrides
  });

  const createChatMessage = (overrides: Partial<ChatMessage>): ChatMessage => ({
    id: 'c1',
    uid: 'u1',
    username: 'testuser',
    displayName: 'Test User',
    avatar: 'avatar.png',
    text: 'Hello',
    createdAt: new Date().toISOString(),
    ...overrides
  });

  const createTicket = (overrides: Partial<Ticket>): Ticket => ({
    id: 't1',
    uid: 'u1',
    username: 'testuser',
    message: 'Help me',
    createdAt: new Date().toISOString(),
    status: 'open',
    messages: [],
    ...overrides
  });

  it('should return no changes when merging identical empty databases', () => {
    const local = createBaseDb();
    const remote = createBaseDb();
    const result = mergeDatabases(local, remote);

    expect(result.changed).toBe(false);
    expect(result.merged).toEqual(local);
  });

  // Users
  describe('Users', () => {
    it('should add a new user from remote', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const user = createUser({ uid: 'u1' });
      remote.users.push(user);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.users).toHaveLength(1);
      expect(result.merged.users[0]).toEqual(user);
    });

    it('should update user if remote has newer scoreUpdatedAt', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const user1 = createUser({ uid: 'u1', poin: 10, scoreUpdatedAt: '2023-01-01T00:00:00.000Z' });
      const user2 = createUser({ uid: 'u1', poin: 20, scoreUpdatedAt: '2023-01-02T00:00:00.000Z' });
      local.users.push(user1);
      remote.users.push(user2);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.users[0].poin).toBe(20);
    });

    it('should not update user if remote has older scoreUpdatedAt', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const user1 = createUser({ uid: 'u1', poin: 20, scoreUpdatedAt: '2023-01-02T00:00:00.000Z' });
      const user2 = createUser({ uid: 'u1', poin: 10, scoreUpdatedAt: '2023-01-01T00:00:00.000Z' });
      local.users.push(user1);
      remote.users.push(user2);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(false);
      expect(result.merged.users[0].poin).toBe(20);
    });

    it('should update user if remote has score change but no timestamp (fallback)', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const user1 = createUser({ uid: 'u1', poin: 10 });
      const user2 = createUser({ uid: 'u1', poin: 20 });
      local.users.push(user1);
      remote.users.push(user2);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.users[0].poin).toBe(20);
    });

    it('should update user if metadata changes (role, displayName, etc.)', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const user1 = createUser({ uid: 'u1', role: 'user', displayName: 'Old Name' });
      const user2 = createUser({ uid: 'u1', role: 'gold', displayName: 'New Name' });
      local.users.push(user1);
      remote.users.push(user2);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.users[0].role).toBe('gold');
      expect(result.merged.users[0].displayName).toBe('New Name');
    });
  });

  // Reports
  describe('Reports', () => {
    it('should add a new report from remote', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const report = createReport({ id: 'r1' });
      remote.reports.push(report);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.reports).toHaveLength(1);
      expect(result.merged.reports[0]).toEqual(report);
    });

    it('should update report status from remote', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const report1 = createReport({ id: 'r1', status: 'pending' });
      const report2 = createReport({ id: 'r1', status: 'resolved' });
      local.reports.push(report1);
      remote.reports.push(report2);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.reports[0].status).toBe('resolved');
    });
  });

  // Chat Messages
  describe('Chat Messages', () => {
    it('should add a new chat message from remote', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const msg = createChatMessage({ id: 'c1' });
      remote.chatMessages.push(msg);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.chatMessages).toHaveLength(1);
      expect(result.merged.chatMessages[0]).toEqual(msg);
    });

    it('should sort chat messages by date if there are changes', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const msg1 = createChatMessage({ id: 'c1', createdAt: '2023-01-02T00:00:00.000Z' });
      const msg2 = createChatMessage({ id: 'c2', createdAt: '2023-01-01T00:00:00.000Z' });
      local.chatMessages.push(msg1);
      remote.chatMessages.push(msg2); // Remote adds c2 which is older

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.chatMessages[0].id).toBe('c2'); // c2 should be first
      expect(result.merged.chatMessages[1].id).toBe('c1');
    });
  });

  // Tickets
  describe('Tickets', () => {
    it('should add a new ticket from remote', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const ticket = createTicket({ id: 't1' });
      remote.tickets.push(ticket);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.tickets).toHaveLength(1);
      expect(result.merged.tickets[0]).toEqual(ticket);
    });

    it('should update ticket if status changes or has more messages', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      const ticket1 = createTicket({ id: 't1', status: 'open', messages: [] });
      const ticket2 = createTicket({
        id: 't1',
        status: 'active',
        messages: [{ id: 'm1', senderUid: 'admin', senderName: 'Admin', text: 'Hi', createdAt: new Date().toISOString() }]
      });
      local.tickets.push(ticket1);
      remote.tickets.push(ticket2);

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.tickets[0].status).toBe('active');
      expect(result.merged.tickets[0].messages).toHaveLength(1);
    });
  });

  // General Configs & Bans
  describe('Announcements, Notifications, and Bans', () => {
    it('should update announcement from remote if different', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      local.announcement = 'Old Announce';
      remote.announcement = 'New Announce';

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.announcement).toBe('New Announce');
    });

    it('should update notification from remote if different', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      local.notification = 'Old Note';
      remote.notification = 'New Note';

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.notification).toBe('New Note');
    });

    it('should merge banned IPs', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      local.bannedIps = ['1.1.1.1'];
      remote.bannedIps = ['2.2.2.2'];

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.bannedIps).toContain('1.1.1.1');
      expect(result.merged.bannedIps).toContain('2.2.2.2');
    });

    it('should merge banned Devices', () => {
      const local = createBaseDb();
      const remote = createBaseDb();
      local.bannedDevices = ['dev1'];
      remote.bannedDevices = ['dev2'];

      const result = mergeDatabases(local, remote);

      expect(result.changed).toBe(true);
      expect(result.merged.bannedDevices).toContain('dev1');
      expect(result.merged.bannedDevices).toContain('dev2');
    });
  });
});
