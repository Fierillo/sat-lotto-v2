import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TEST_NWC = 'nostr+walletconnect://abcdef123456?secret=supersecret&relay=wss://relay.example.com';
const TEST_PIN = '1234';

const localStorageMock = {
    data: new Map<string, string>(),
    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
        this.data.set(key, value);
    },
    removeItem(key: string): void {
        this.data.delete(key);
    },
    clear(): void {
        this.data.clear();
    },
};

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

Object.defineProperty(globalThis, 'crypto', {
    value: {
        subtle: globalThis.crypto?.subtle,
        getRandomValues: (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
    },
    writable: true,
});

vi.mock('argon2-browser', () => ({
    default: {
        hash: vi.fn().mockRejectedValue(new Error('WASM not available in Node')),
        argon2id: 2,
    },
    ArgonType: {
        Argon2d: 0,
        Argon2i: 1,
        Argon2id: 2,
    },
}));

describe('crypto module', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.resetModules();
    });

    describe('encryptNwc and decryptNwc', () => {
        it('should encrypt and decrypt NWC URL successfully (PBKDF2 fallback)', async () => {
            const { encryptNwc, decryptNwc, createPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            await encryptNwc(TEST_NWC, TEST_PIN);
            
            const decrypted = await decryptNwc(TEST_PIN);
            expect(decrypted).toBe(TEST_NWC);
        });

        it('should fail to decrypt with wrong PIN', async () => {
            const { encryptNwc, decryptNwc, createPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            await encryptNwc(TEST_NWC, TEST_PIN);
            
            const decrypted = await decryptNwc('0000');
            expect(decrypted).toBeNull();
        });

        it('should produce different ciphertext for same PIN (random salt/IV)', async () => {
            const { encryptNwc, decryptNwc, createPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            await encryptNwc(TEST_NWC, TEST_PIN);
            
            const stored1 = localStorage.getItem('satlotto_nwc_encrypted');
            
            localStorage.removeItem('satlotto_nwc_encrypted');
            await encryptNwc(TEST_NWC, TEST_PIN);
            
            const stored2 = localStorage.getItem('satlotto_nwc_encrypted');
            
            expect(stored1).not.toBe(stored2);
        });
    });

    describe('PIN management', () => {
        it('should create and verify PIN correctly', async () => {
            const { createPin, verifyPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            const result = await verifyPin(TEST_PIN);
            
            expect(result.success).toBe(true);
            expect(result.locked).toBe(false);
        });

        it('should reject wrong PIN', async () => {
            const { createPin, verifyPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            const result = await verifyPin('0000');
            
            expect(result.success).toBe(false);
        });

        it('should lock after 3 failed attempts', async () => {
            const { createPin, verifyPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            
            await verifyPin('0000');
            await verifyPin('0000');
            const result = await verifyPin('0000');
            
            expect(result.locked).toBe(true);
        });
    });

    describe('storage management', () => {
        it('should clear all NWC storage on lock', async () => {
            const { createPin, verifyPin, hasStoredNwc, hasPin } = await import('../../src/lib/crypto');
            
            await createPin(TEST_PIN);
            const { encryptNwc } = await import('../../src/lib/crypto');
            await encryptNwc(TEST_NWC, TEST_PIN);
            
            expect(await hasStoredNwc()).toBe(true);
            expect(await hasPin()).toBe(true);
            
            await verifyPin('0000');
            await verifyPin('0000');
            await verifyPin('0000');
            
            expect(await hasStoredNwc()).toBe(false);
            expect(await hasPin()).toBe(false);
        });
    });
});