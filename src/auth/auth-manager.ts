import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { resolveName, setAlias } from '../utils/nostr-service';
import { fetchIdentity } from '../utils/game-api';
import { authState, logRemote } from './auth-state';
import { getOrCreateLocalSigner } from './auth-utils';
import { setAuthError } from './login-handlers';

export function logout(): void {
    ['amber', 'nwc', 'bunker', 'extension'].forEach(k => localStorage.removeItem(`satlotto_${k}`));
    authState.pubkey = authState.signer = authState.nwcUrl = authState.bunkerTarget = authState.nip05 = null;
    updateAuthUI();
    (window as any).updateUI?.();
}

export function checkExternalLogin(): void {
    const fullUrl = window.location.href;
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
    
    const pub = params.get('pubkey') || params.get('result');
    const sig = params.get('signature');
    const ev = params.get('event');

    logRemote({ 
        msg: 'CHECK_EXTERNAL_LOGIN', 
        hasParams: { pub: !!pub, sig: !!sig, ev: !!ev },
        url: fullUrl 
    });

    if (pub && !sig && !ev) { 
        sessionStorage.removeItem('login_pending');
        authState.pubkey = pub; 
        authState.loginMethod = 'amber';
        localStorage.setItem('satlotto_login_method', 'amber');
        logRemote({ msg: 'EXTERNAL_LOGIN_DETECTED', pubkey: pub.substring(0, 16) + '...', loginMethod: 'amber' });
        finishLogin(); 
    }
    
    if (sig && ev) { 
        // This is a sign_event return
        try {
            const obj = JSON.parse(ev);
            obj.sig = sig;
            (window as any).lastExternalSig = obj;
            // Ensure pubkey is set if returning from a sign_event without prior session
            if (obj.pubkey && !authState.pubkey) {
                sessionStorage.removeItem('login_pending');
                authState.pubkey = obj.pubkey;
                logRemote({ msg: 'EXTERNAL_SIGN_DETECTED', pubkey: obj.pubkey.substring(0, 16) + '...' });
                finishLogin();
            }
        } catch (e) {
            console.error('[checkExternalLogin] Error parsing event:', e);
        }
    }
    
    if (pub || (sig && ev)) {
        window.history.replaceState({}, '', window.location.origin + window.location.pathname);
    }
}

export async function finishLogin(): Promise<void> {
    if (!authState.pubkey) return;
    localStorage.setItem('satlotto_pubkey', authState.pubkey);
    if (authState.bunkerTarget) localStorage.setItem('satlotto_bunker', authState.bunkerTarget);

    updateAuthUI();

    if (!authState.signer) {
        if (authState.bunkerTarget) {
            const signer = new NDKNip46Signer(ndk, authState.bunkerTarget, getOrCreateLocalSigner());
            (signer as any).ndk = ndk;
            // Iniciamos el handshake en segundo plano sin await para no trabar la UI
            signer.blockUntilReady().then(() => {
                console.log('[Bunker] Signer is ready for action');
            }).catch(e => {
                console.error('[Bunker] Handshake failed during login:', e);
            });
            authState.signer = signer;
        } else if (authState.nwcUrl) {
            const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
            const secret = url.searchParams.get('secret');
            if (secret) authState.signer = new NDKPrivateKeySigner(secret);
        } else if ((window as any).nostr) {
            authState.signer = new NDKNip07Signer();
        }
    }

    // Resolve identity (Future-proof: this is our only update factor)
    const res = await fetch(`/api/identity/${authState.pubkey}`);
    const data = res.ok ? await res.json() : { alias: null, lastCelebrated: 0 };
    authState.lastCelebratedBlock = data.lastCelebrated || 0;
    
    const apiAliasResp = await fetchIdentity(authState.pubkey);
    const apiAlias = data.alias || apiAliasResp?.alias;
    const user = ndk.getUser({ pubkey: authState.pubkey });
    const profile = await user.fetchProfile();
    const ndkAlias = profile?.nip05 || null;
    
    // Securely verify identity on server using the signed event (Kind 0)
    ndk.fetchEvent({ kinds: [0], authors: [authState.pubkey] }).then(ev => {
        if (ev) {
            const raw = ev.rawEvent();
            authState.loginEvent = raw; // Guardamos el pasaporte para festejos
            fetch(`/api/identity/${authState.pubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: raw })
            }).catch(() => {});
        }
    });
    
    // Preserve existing nip05 (like from NWC) if both lookups fail
    authState.nip05 = ndkAlias || apiAlias || authState.nip05 || null;
    if (authState.nip05) {
        localStorage.setItem('satlotto_alias', authState.nip05);
        setAlias(authState.pubkey, authState.nip05);
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

        // Update login method badge
        const badge = document.getElementById('loginMethodBadge');
        if (badge && authState.loginMethod) {
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const method = authState.loginMethod;
            badge.textContent = method === 'extension' && isMobile ? 'mobile+ext' : method;
            badge.style.display = 'block';
        }
    } else {
        if (profile) profile.style.display = 'none';
        document.body.classList.add('logged-out');
    }
    (window as any).updateCenterButton?.();
}

export async function showLoginModal(): Promise<void> {
    const modal = document.getElementById('loginModal');
    if (modal) {
        setAuthError('');
        modal.style.display = 'flex';
        
        // Reset NWC button and input
        const nwcBtn = modal.querySelector('#nwcBtn') as HTMLButtonElement;
        const nwcInput = modal.querySelector('#nwcInput') as HTMLInputElement;
        if (nwcBtn) {
            nwcBtn.textContent = 'Conectar Wallet';
            nwcBtn.disabled = false;
        }
        if (nwcInput) nwcInput.value = '';

        (window as any).initNostrConnect?.();

        // Auto-PIN Flow
        import('./nwc-storage').then(async ({ hasStoredNwc, isLocked }) => {
            const hasNwc = await hasStoredNwc();
            const locked = isLocked();

            if (hasNwc && !locked) {
                const { handleNwcLoginAutoPin } = await import('./login-handlers');
                handleNwcLoginAutoPin();
            }
        });
    }
}
