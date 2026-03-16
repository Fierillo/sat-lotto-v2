const PIN_KEY = 'satlotto_pin_hash';
const ATTEMPTS_KEY = 'satlotto_pin_attempts';
const NWC_ENCRYPTED_KEY = 'satlotto_nwc_encrypted';
const MAX_ATTEMPTS = 3;
const ITERATIONS = 100000;

async function getKey(pin: string, salt: number[]): Promise<CryptoKey | null> {
    if (!crypto.subtle) return null;
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
    
    // Check if crypto.subtle is available (it might not be in insecure contexts like non-HTTPS on mobile)
    if (crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
        // Fallback for non-secure contexts (e.g. local IP testing on mobile without HTTPS)
        // Note: This is a weak hash for testing purposes only. 
        // In production (HTTPS), crypto.subtle will always be used.
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
            const char = pin.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
}

export async function hasPin(): Promise<boolean> {
    return !!localStorage.getItem(PIN_KEY);
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
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    const iv = Array.from(crypto.getRandomValues(new Uint8Array(12)));
    const key = await getKey(pin, salt);
    if (!key) throw new Error('Error de criptografía');
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

export async function decryptNwc(pin: string): Promise<string | null> {
    if (!crypto.subtle) {
        console.error('Criptografía no disponible');
        return null;
    }
    const encryptedStr = localStorage.getItem(NWC_ENCRYPTED_KEY);
    
    if (!encryptedStr || !pin) {
        return null;
    }

    try {
        const { salt, iv, data } = JSON.parse(encryptedStr);
        const key = await getKey(pin, salt);
        if (!key) return null;
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
    localStorage.removeItem('satlotto_login_method');
    localStorage.removeItem('satlotto_pubkey');
}

export function getAttemptsLeft(): number {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    return Math.max(0, MAX_ATTEMPTS - attempts);
}

export function isLocked(): boolean {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
    return attempts >= MAX_ATTEMPTS;
}
