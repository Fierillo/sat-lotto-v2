import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { getNwcInfo } from '../utils/nwc-connect';

export const authState = {
    pubkey: null as string | null
};

export async function loginWithExtension(): Promise<void> {
    if (!(window as any).nostr) throw new Error('No se detectó extensión Nostr (Alby/Nos2x)');
    const signer = new NDKNip07Signer();
    await signer.blockUntilReady();
    const user = await signer.user();
    authState.pubkey = user.pubkey;
    updateAuthUI();
}

export async function loginWithNwc(nwcUrl: string): Promise<void> {
    if (!nwcUrl) throw new Error('NWC URL inválida');
    const { info } = await getNwcInfo(nwcUrl);
    if (!info.pubkey) throw new Error('La conexión NWC no devolvió un pubkey válido');
    authState.pubkey = info.pubkey;
    updateAuthUI();
}

export function autoLogin(onError?: (msg: string) => void): void {
    const showError = (msg: string) => {
        if (onError) onError(msg);
    };

    if ((window as any).nostr) {
        loginWithExtension().catch(e => showError(e.message));
        return;
    }

    window.location.href = 'nostrsigner:';
    setTimeout(() => {
        if (!authState.pubkey) showError('No se detectó extensión ni app móvil. Usá el login con NWC.');
    }, 2500);
}

export function updateAuthUI(): void {
    const loginBtn = document.getElementById('loginBtn');
    const modal = document.getElementById('loginModal');

    if (modal) modal.style.display = 'none';

    if (!loginBtn) return;

    if (authState.pubkey) {
        loginBtn.textContent = `${authState.pubkey.slice(0, 6)}...${authState.pubkey.slice(-4)}`;
        loginBtn.classList.add('logged-in');
    } else {
        loginBtn.textContent = 'ENTRAR';
        loginBtn.classList.remove('logged-in');
    }
}
