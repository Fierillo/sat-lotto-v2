/**
 * NWC: Nostr Wallet Connect (NIP-47)
 * Absorbe: nwc-storage.ts + login functions + client payments
 *
 * Todo NWC en un solo lugar:
 * - Encriptación/decrypt con PIN (AES-GCM + PBKDF2)
 * - Modal de PIN (crear/verificar)
 * - Login con NWC URL + auto-PIN al entrar
 * - Pago de invoices via /api/pay (server-side)
 */

import { nwc } from '@getalby/sdk';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { setAlias } from '../utils/nostr-service';
import { authState } from '../auth/auth-state';

// ─── Auth error helper (shared with auth-manager) ───────────────────

export function setAuthError(msg: string): void {
    const errorDisplay = document.getElementById('authError');
    if (errorDisplay) errorDisplay.textContent = msg;
}

// ─── Storage constants (de nwc-storage.ts) ──────────────────────────

const PIN_KEY = 'satlotto_pin_hash';
const ATTEMPTS_KEY = 'satlotto_pin_attempts';
const NWC_ENCRYPTED_KEY = 'satlotto_nwc_encrypted';
const MAX_ATTEMPTS = 3;
const ITERATIONS = 100000;

// ─── Internal crypto helpers ────────────────────────────────────────

async function getKey(pin: string, salt: number[]): Promise<CryptoKey | null> {
    if (!crypto.subtle) return null;
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
        'raw', encoder.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: ITERATIONS, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
}

async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);

    if (crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback for non-secure contexts (local IP testing without HTTPS)
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        const char = pin.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─── Storage: public API (de nwc-storage.ts) ────────────────────────

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
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    const iv = Array.from(crypto.getRandomValues(new Uint8Array(12)));
    const key = await getKey(pin, salt);
    if (!key) throw new Error('Error de criptografía');

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key, encoder.encode(nwcUri)
    );

    localStorage.setItem(NWC_ENCRYPTED_KEY, JSON.stringify({
        salt, iv, data: Array.from(new Uint8Array(ciphertext))
    }));
}

export async function decryptNwc(pin: string): Promise<string | null> {
    if (!crypto.subtle) return null;
    const encryptedStr = localStorage.getItem(NWC_ENCRYPTED_KEY);
    if (!encryptedStr || !pin) return null;

    try {
        const { salt, iv, data } = JSON.parse(encryptedStr);
        const key = await getKey(pin, salt);
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

// ─── PIN Modal (de login-handlers.ts:askPinInModal) ─────────────────

export function askPinInModal(mode: 'create' | 'verify'): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = document.getElementById('loginModal');
        if (!modal) return resolve(null);

        const mainView = modal.querySelector('#login-main-view') as HTMLElement;
        const pinView = modal.querySelector('#pin-view') as HTMLElement;
        const pinTitle = modal.querySelector('#pinTitle') as HTMLElement;
        const pinDesc = modal.querySelector('#pinDesc') as HTMLElement;
        const pinError = modal.querySelector('#pinError') as HTMLElement;
        const digits = modal.querySelectorAll('.pin-digit') as NodeListOf<HTMLInputElement>;
        const confirmBtn = modal.querySelector('#confirmPinInModal') as HTMLButtonElement;
        const backBtn = modal.querySelector('#backToLogin') as HTMLButtonElement;

        if (!mainView || !pinView) return resolve(null);

        mainView.style.display = 'none';
        pinView.style.display = 'block';
        pinError.textContent = '';
        digits.forEach(d => { d.value = ''; d.disabled = false; });
        confirmBtn.disabled = false;
        setTimeout(() => digits[0].focus(), 50);

        if (mode === 'create') {
            pinTitle.textContent = 'Creá tu PIN';
            pinDesc.textContent = 'Este PIN de 4 dígitos protege tu wallet. Guardalo bien.';
            confirmBtn.textContent = 'Crear PIN';
        } else {
            pinTitle.textContent = 'Ingresá tu PIN';
            pinDesc.textContent = 'Ingresá el PIN de 4 dígitos para desbloquear tu wallet.';
            confirmBtn.textContent = 'Desbloquear';
        }

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            backBtn.removeEventListener('click', handleBack);
            document.removeEventListener('keydown', handleKeydown);
        };

        const handleConfirm = async () => {
            const pin = Array.from(digits).map(d => d.value).join('');
            if (pin.length !== 4 || !/^\d+$/.test(pin)) {
                pinError.textContent = 'Ingresá los 4 dígitos';
                return;
            }

            if (mode === 'create') {
                try {
                    await createPin(pin);
                    cleanup();
                    resolve(pin);
                } catch (e: any) {
                    pinError.textContent = e.message;
                }
            } else {
                const result = await verifyPin(pin);
                if (result.locked) {
                    cleanup();
                    pinError.textContent = 'Demasiados intentos. Tu wallet fue borrada del dispositivo por seguridad. Tocá "Volver" para conectar una nueva.';
                    confirmBtn.disabled = true;
                    digits.forEach(d => d.disabled = true);
                    return;
                }
                if (!result.success) {
                    pinError.textContent = `PIN incorrecto. Quedan ${result.attemptsLeft} intentos.`;
                    digits.forEach(d => d.value = '');
                    digits[0].focus();
                    return;
                }
                cleanup();
                resolve(pin);
            }
        };

        const handleBack = () => {
            cleanup();
            pinView.style.display = 'none';
            mainView.style.display = 'block';
            resolve(null);
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') handleBack();
        };

        confirmBtn.addEventListener('click', handleConfirm);
        backBtn.addEventListener('click', handleBack);
        document.addEventListener('keydown', handleKeydown);
    });
}

// ─── NWC Login functions (de login-handlers.ts) ─────────────────────

export async function handleNwcLogin(): Promise<void> {
    const btn = document.getElementById('nwcBtn') as HTMLButtonElement;
    const input = document.getElementById('nwcInput') as HTMLInputElement;
    const originalBtnText = btn?.textContent || 'Conectar Wallet';

    try {
        setAuthError('');
        const url = (input?.value || '').trim();
        if (!url || !url.startsWith('nostr+walletconnect://')) {
            throw new Error('URL inválida. Debe empezar con nostr+walletconnect://');
        }

        if (btn) {
            btn.textContent = 'Verificando Wallet...';
            btn.disabled = true;
        }

        const secret = new URL(url.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');
        if (!secret) throw new Error('La URL no contiene la clave secreta (secret)');

        const hasExistingNwc = await hasStoredNwc();
        const locked = isLocked();

        if (hasExistingNwc && !locked) {
            const pin = await askPinInModal('verify');
            if (!pin) return;
            const decryptedNwc = await decryptNwc(pin);
            if (!decryptedNwc) throw new Error('Error al desencriptar la wallet. Intentá nuevamente.');
            authState.nwcUrl = decryptedNwc;
        } else if (locked) {
            setAuthError('Tu NWC fue borrado por seguridad. Necesitás conectar uno nuevo.');
            const pin = await askPinInModal('create');
            if (!pin) return;
            authState.nwcUrl = url;
            await encryptNwc(url, pin);
        } else {
            const pin = await askPinInModal('create');
            if (!pin) return;
            authState.nwcUrl = url;
            await encryptNwc(url, pin);
        }

        const signer = new NDKPrivateKeySigner(secret);
        authState.signer = signer;
        const user = await signer.user();
        authState.pubkey = user.pubkey;
        authState.loginMethod = 'nwc';
        localStorage.setItem('satlotto_login_method', 'nwc');

        try {
            const profile = await user.fetchProfile();
            authState.nip05 = profile?.nip05 || null;
            if (authState.pubkey && authState.nip05) {
                setAlias(authState.pubkey, authState.nip05);
            }
        } catch (e) {
            console.log('[NWC Login] No se pudo obtener el perfil de Nostr');
        }

        // finishLogin is imported here to avoid circular dependency
        const { finishLogin } = await import('../auth/auth-manager');
        await finishLogin();
    } catch (e: any) {
        console.error('[NWC Login] Failed:', e);
        setAuthError(`Error: ${e.message}`);
    } finally {
        if (btn) {
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
    }
}

export async function handleNwcLoginAutoPin(): Promise<void> {
    try {
        const pin = await askPinInModal('verify');
        if (!pin) return;

        const decryptedNwc = await decryptNwc(pin);
        if (!decryptedNwc) {
            throw new Error('Error al desencriptar la wallet. Intentá nuevamente.');
        }

        authState.nwcUrl = decryptedNwc;
        const secret = new URL(decryptedNwc.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');
        if (!secret) throw new Error('Wallet guardada inválida.');

        const signer = new NDKPrivateKeySigner(secret);
        authState.signer = signer;
        const user = await signer.user();
        authState.pubkey = user.pubkey;

        try {
            const profile = await user.fetchProfile();
            authState.nip05 = profile?.nip05 || null;
            if (authState.pubkey && authState.nip05) {
                setAlias(authState.pubkey, authState.nip05);
            }
        } catch (e) {}

        const { finishLogin } = await import('../auth/auth-manager');
        await finishLogin();
    } catch (e: any) {
        console.error('[NWC Auto-Login] Failed:', e);
        setAuthError(`Error: ${e.message}`);
    }
}

// ─── Client payments (reemplaza payNwcInvoice de pay-invoice.ts) ────

let client: nwc.NWCClient | null = null;

function getClient(nwcUrl?: string): nwc.NWCClient {
    const url = nwcUrl || (typeof window !== 'undefined' ? localStorage.getItem('satlotto_nwc') : null);
    if (!url) throw new Error('No NWC URL configured');

    if (!client || client.getNostrWalletConnectUrl() !== url) {
        client?.close();
        client = new nwc.NWCClient({ nostrWalletConnectUrl: url });
    }
    return client;
}

export const NWC = {
    name: 'nwc' as const,
    canPay: true,

    getPublicKey(nwcUrl?: string): string {
        return getClient(nwcUrl).publicKey;
    },

    async getBalance(nwcUrl?: string): Promise<number> {
        const c = getClient(nwcUrl);
        const data = await c.getBalance();
        return Math.floor(data.balance / 1000);
    },

    async createInvoice(amountSats: number, description: string, nwcUrl?: string): Promise<{ paymentRequest: string; paymentHash: string }> {
        const c = getClient(nwcUrl);
        const tx = await c.makeInvoice({ amount: amountSats * 1000, description });
        return { paymentRequest: tx.invoice, paymentHash: tx.payment_hash };
    },

    async payInvoice(invoice: string): Promise<string> {
        const c = getClient(authState.nwcUrl || undefined);
        const result = await c.payInvoice({ invoice });
        return result?.preimage || '';
    },

    async lookupInvoice(hash: string, nwcUrl?: string): Promise<{ settled: boolean; preimage?: string }> {
        try {
            const tx = await getClient(nwcUrl).lookupInvoice({ payment_hash: hash });
            return { settled: tx.state === 'settled', preimage: tx.preimage || undefined };
        } catch {
            return { settled: false };
        }
    },

    disconnect(): void {
        client?.close();
        client = null;
    }
};

// ─── Signer restoration (para auth-manager.finishLogin) ─────────────

export function restoreSigner(nwcUrl: string): NDKPrivateKeySigner | null {
    const url = new URL(nwcUrl.replace('nostr+walletconnect:', 'http:'));
    const secret = url.searchParams.get('secret');
    return secret ? new NDKPrivateKeySigner(secret) : null;
}
