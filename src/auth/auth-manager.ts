import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { resolveName } from '../utils/nostr-service';
import { fetchIdentity } from '../utils/game-api';
import { authState, logRemote } from './auth-state';
import { getOrCreateLocalSigner } from './auth-utils';
import { setAuthError } from './login-handlers';

export function logout(): void {
    ['pubkey', 'nwc', 'bunker'].forEach(k => localStorage.removeItem(`satlotto_${k}`));
    authState.pubkey = authState.signer = authState.nwcUrl = authState.bunkerTarget = authState.nip05 = null;
    updateAuthUI();
    (window as any).updateUI?.();
}

export function checkExternalLogin(): void {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
    const pub = params.get('pubkey');
    const sig = params.get('signature');
    const ev = params.get('event');

    if (pub) { authState.pubkey = pub; finishLogin(); }
    if (sig && ev) { 
        const obj = JSON.parse(ev);
        obj.sig = sig;
        (window as any).lastExternalSig = obj;
    }
    if (pub || (sig && ev)) window.history.replaceState({}, '', window.location.origin + window.location.pathname);
}

export async function finishLogin(): Promise<void> {
    if (!authState.pubkey) return;
    localStorage.setItem('satlotto_pubkey', authState.pubkey);
    if (authState.nwcUrl) localStorage.setItem('satlotto_nwc', authState.nwcUrl);
    if (authState.bunkerTarget) localStorage.setItem('satlotto_bunker', authState.bunkerTarget);

    updateAuthUI();

    if (!authState.signer) {
        if (authState.bunkerTarget) {
            const signer = new NDKNip46Signer(ndk, authState.bunkerTarget, getOrCreateLocalSigner());
            (signer as any).ndk = ndk;
            authState.signer = signer;
        } else if (authState.nwcUrl) {
            const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
            const secret = url.searchParams.get('secret');
            if (secret) authState.signer = new NDKPrivateKeySigner(secret);
        } else if ((window as any).nostr) {
            authState.signer = new NDKNip07Signer();
        }
    }

    if (!authState.nip05) {
        logRemote({ msg: 'Fetching identity...', pubkey: authState.pubkey });
        authState.nip05 = await fetchIdentity(authState.pubkey) || (await ndk.getUser({ pubkey: authState.pubkey }).fetchProfile())?.nip05 || null;
    }
    updateAuthUI();
}

export function updateAuthUI(): void {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';

    const profile = document.getElementById('userProfile');
    const alias = document.getElementById('userAlias');

    if (authState.pubkey) {
        if (alias) alias.textContent = authState.nip05 || resolveName(authState.pubkey);
        if (profile) profile.style.display = 'block';
        document.body.classList.remove('logged-out');
    } else {
        if (profile) profile.style.display = 'none';
        document.body.classList.add('logged-out');
    }
    (window as any).updateCenterButton?.();
}

export function showLoginModal(): void {
    const modal = document.getElementById('loginModal');
    if (modal) {
        setAuthError('');
        modal.style.display = 'flex';
        (window as any).initNostrConnect?.();
    }
}
