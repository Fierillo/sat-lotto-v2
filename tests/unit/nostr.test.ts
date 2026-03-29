import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getBotPubkey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should return null if NOSTR_PRIVKEY is not configured', async () => {
        delete process.env.NOSTR_PRIVKEY;
        process.env.NOSTR_ENABLED = 'false';
        const { getBotPubkey } = await import('../../src/lib/nostr');
        expect(getBotPubkey()).toBeNull();
    });

    it('should return null if NOSTR_PRIVKEY is empty string', async () => {
        process.env.NOSTR_PRIVKEY = '';
        process.env.NOSTR_ENABLED = 'false';
        const { getBotPubkey } = await import('../../src/lib/nostr');
        expect(getBotPubkey()).toBeNull();
    });
});

describe('ensureNdkConnected', () => {
    it('should return a boolean when NOSTR_ENABLED is false', async () => {
        const originalEnv = process.env;
        process.env.NOSTR_ENABLED = 'false';
        process.env.NOSTR_PRIVKEY = '';
        const { ensureNdkConnected } = await import('../../src/lib/nostr');
        const result = await ensureNdkConnected();
        process.env = originalEnv;
        expect(typeof result).toBe('boolean');
    });
});

describe('nostr module', () => {
    it('should export botNdk', async () => {
        const originalEnv = process.env;
        process.env.NOSTR_ENABLED = 'false';
        process.env.NOSTR_PRIVKEY = '';
        const { botNdk } = await import('../../src/lib/nostr');
        expect(botNdk).toBeDefined();
    });

    it('should export ensureNdkConnected', async () => {
        const originalEnv = process.env;
        process.env.NOSTR_ENABLED = 'false';
        process.env.NOSTR_PRIVKEY = '';
        const { ensureNdkConnected } = await import('../../src/lib/nostr');
        expect(typeof ensureNdkConnected).toBe('function');
    });

    it('should export sendDM', async () => {
        const originalEnv = process.env;
        process.env.NOSTR_ENABLED = 'false';
        process.env.NOSTR_PRIVKEY = '';
        const { sendDM } = await import('../../src/lib/nostr');
        expect(typeof sendDM).toBe('function');
    });

    it('should export publishRoundResult', async () => {
        const originalEnv = process.env;
        process.env.NOSTR_ENABLED = 'false';
        process.env.NOSTR_PRIVKEY = '';
        const { publishRoundResult } = await import('../../src/lib/nostr');
        expect(typeof publishRoundResult).toBe('function');
    });
});
