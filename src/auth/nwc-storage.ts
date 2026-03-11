const PIN_KEY = 'satlotto_pin_hash';
const ATTEMPTS_KEY = 'satlotto_pin_attempts';
const NWC_ENCRYPTED_KEY = 'satlotto_nwc_encrypted';
const MAX_ATTEMPTS = 3;
const ITERATIONS = 100000;

async function getKey(pin: string, salt: number[]): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hasPin(): Promise<boolean> {
    return !!localStorage.getItem(PIN_KEY);
}

export async function createPin(pin: string): Promise<void> {
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
        throw new Error('PIN debe ser de 6 dígitos');
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
    const encoder = new TextEncoder();
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    const iv = Array.from(crypto.getRandomValues(new Uint8Array(12)));
    const key = await getKey(pin, salt);
    const encoded = encoder.encode(nwcUri);

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        encoded
    );

    const bundle = {
        salt,
        iv,
        data: Array.from(new Uint8Array(ciphertext))
    };

    localStorage.setItem(NWC_ENCRYPTED_KEY, JSON.stringify(bundle));
}

export async function decryptNwc(): Promise<string | null> {
    const encryptedStr = localStorage.getItem(NWC_ENCRYPTED_KEY);
    
    if (!encryptedStr) {
        return null;
    }

    try {
        const { salt, iv, data } = JSON.parse(encryptedStr);
        const pin = localStorage.getItem(PIN_KEY);
        if (!pin) return null;

        const key = await getKey(pin, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            new Uint8Array(data)
        );
        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
}

export async function hasStoredNwc(): Promise<boolean> {
    return !!localStorage.getItem(NWC_ENCRYPTED_KEY);
}

export function clearNwcStorage(): void {
    localStorage.removeItem(NWC_ENCRYPTED_KEY);
    localStorage.removeItem(PIN_KEY);
    localStorage.setItem(ATTEMPTS_KEY, '0');
}

export function getAttemptsLeft(): number {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    return Math.max(0, MAX_ATTEMPTS - attempts);
}

export function isLocked(): boolean {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    return attempts >= MAX_ATTEMPTS;
}
