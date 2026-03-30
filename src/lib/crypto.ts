/**
 * Crypto: PIN management + AES-GCM + Argon2/PBKDF2 encryption
 *
 * Used for encrypting/decrypting NWC URLs with a 4-digit PIN.
 * Uses Argon2id (via WASM) for key derivation with PBKDF2 fallback.
 * Separated from NWC protocol logic (src/lib/nwc.ts).
 */

import argon2, { ArgonType } from 'argon2-browser';

const PIN_KEY = 'satlotto_pin_hash';
const ATTEMPTS_KEY = 'satlotto_pin_attempts';
const NWC_ENCRYPTED_KEY = 'satlotto_nwc_encrypted';
const MAX_ATTEMPTS = 3;
const PBKDF2_ITERATIONS = 1000000;

let argon2Available: boolean | null = null;

async function checkArgon2Available(): Promise<boolean> {
    if (argon2Available !== null) return argon2Available;
    try {
        await argon2.hash({ pass: 'test', salt: 'test', type: ArgonType.Argon2id });
        argon2Available = true;
    } catch {
        argon2Available = false;
    }
    return argon2Available;
}

async function deriveKeyArgon2(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const hash = await argon2.hash({
        pass: pin,
        salt: salt,
        type: ArgonType.Argon2id,
        mem: 65536,
        time: 1,
        parallelism: 1,
        hashLen: 32,
    });
    const hashBuffer = hash.hash.buffer.slice(hash.hash.byteOffset, hash.hash.byteOffset + hash.hash.byteLength) as ArrayBuffer;
    return crypto.subtle.importKey('raw', hashBuffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function deriveKeyPBKDF2(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    const saltBuffer = new Uint8Array(salt).buffer;
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
}

async function getKey(pin: string, salt: Uint8Array): Promise<CryptoKey | null> {
    if (!crypto.subtle) return null;
    
    if (await checkArgon2Available()) {
        try {
            return await deriveKeyArgon2(pin, salt);
        } catch (e) {
            console.warn('[Crypto] Argon2 failed, falling back to PBKDF2:', e);
        }
    }
    
    return deriveKeyPBKDF2(pin, salt);
}

async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);

    if (crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        const char = pin.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function hasPin(): Promise<boolean> {
    return !!localStorage.getItem(PIN_KEY);
}

export async function hasStoredNwc(): Promise<boolean> {
    return !!localStorage.getItem(NWC_ENCRYPTED_KEY);
}

export async function createPin(pin: string): Promise<void> {
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        throw new Error('PIN debe ser de 4 dígitos');
    }
    const hash = await hashPin(pin);
    localStorage.setItem(PIN_KEY, hash);
    localStorage.setItem(ATTEMPTS_KEY, '0');
}

export async function verifyPin(pin: string): Promise<{ success: boolean; locked: boolean; attemptsLeft: number }> {
    const storedHash = localStorage.getItem(PIN_KEY);
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');

    if (attempts >= MAX_ATTEMPTS) {
        return { success: false, locked: true, attemptsLeft: 0 };
    }

    const inputHash = await hashPin(pin);

    if (inputHash === storedHash) {
        localStorage.setItem(ATTEMPTS_KEY, '0');
        return { success: true, locked: false, attemptsLeft: MAX_ATTEMPTS };
    }

    const newAttempts = attempts + 1;
    localStorage.setItem(ATTEMPTS_KEY, newAttempts.toString());

    if (newAttempts >= MAX_ATTEMPTS) {
        clearNwcStorage();
        return { success: false, locked: true, attemptsLeft: 0 };
    }

    return { success: false, locked: false, attemptsLeft: MAX_ATTEMPTS - newAttempts };
}

export async function encryptNwc(nwcUri: string, pin: string): Promise<void> {
    if (!crypto.subtle) {
        throw new Error('Criptografía no disponible. Por seguridad, usá HTTPS o localhost para conectar tu wallet.');
    }
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getKey(pin, salt);
    if (!key) throw new Error('Error de criptografía');

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key, encoder.encode(nwcUri)
    );

    localStorage.setItem(NWC_ENCRYPTED_KEY, JSON.stringify({
        salt: Array.from(salt),
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(ciphertext))
    }));
}

export async function decryptNwc(pin: string): Promise<string | null> {
    if (!crypto.subtle) return null;
    const encryptedStr = localStorage.getItem(NWC_ENCRYPTED_KEY);
    if (!encryptedStr || !pin) return null;

    try {
        const { salt, iv, data } = JSON.parse(encryptedStr);
        const key = await getKey(pin, new Uint8Array(salt));
        if (!key) return null;
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key, new Uint8Array(data)
        );
        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
}

export function clearNwcStorage(): void {
    localStorage.removeItem(NWC_ENCRYPTED_KEY);
    localStorage.removeItem(PIN_KEY);
    localStorage.setItem(ATTEMPTS_KEY, '0');
    localStorage.removeItem('satlotto_pubkey');
    localStorage.removeItem('satlotto_login_method');
}

export function getAttemptsLeft(): number {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    return Math.max(0, MAX_ATTEMPTS - attempts);
}

export function isLocked(): boolean {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    return attempts >= MAX_ATTEMPTS;
}