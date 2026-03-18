/**
 * NWC: Nostr Wallet Connect (NIP-47) - Login, PIN modal, payments
 *
 * Crypto/PIN logic moved to src/lib/crypto.ts
 */

import { nwc } from '@getalby/sdk';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { setAlias } from '../utils/nostr-service';
import { authState, finishLogin } from '../utils/auth';
import {
    hasStoredNwc, isLocked, decryptNwc, encryptNwc,
    createPin, verifyPin, clearNwcStorage
} from './crypto';

// ─── Auth error helper ────────────────────────────────────────────────

export function setAuthError(msg: string): void {
    const errorDisplay = document.getElementById('authError');
    if (errorDisplay) errorDisplay.textContent = msg;
}

// ─── PIN Modal ────────────────────────────────────────────────────────

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

// ─── NWC Login ────────────────────────────────────────────────────────

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

        await finishLogin();
    } catch (e: any) {
        console.error('[NWC Auto-Login] Failed:', e);
        setAuthError(`Error: ${e.message}`);
    }
}

// ─── Client payments ──────────────────────────────────────────────────

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

// ─── Signer restoration ───────────────────────────────────────────────

export function restoreSigner(nwcUrl: string): NDKPrivateKeySigner | null {
    const url = new URL(nwcUrl.replace('nostr+walletconnect:', 'http:'));
    const secret = url.searchParams.get('secret');
    return secret ? new NDKPrivateKeySigner(secret) : null;
}
