import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { resolveName, setAlias } from '../utils/nostr-service';
import { fetchIdentity } from '../utils/game-api';
import { authState, logRemote } from './auth-state';
import { getOrCreateLocalSigner } from './auth-utils';
import { setAuthError, NWC, handleNwcLogin, handleNwcLoginAutoPin, restoreSigner, clearNwcStorage } from '../lib/nwc';
import { NIP07 } from '../lib/nip07';
import { NIP55 } from '../lib/nip55';

// ─── Logout ─────────────────────────────────────────────────────────

export function logout(): void {
    NWC.disconnect();

    // Limpiar TODA la data de autenticación de localStorage
    [
        'satlotto_pubkey',
        'satlotto_login_method',
        'satlotto_bunker',
        'satlotto_alias',
        'satlotto_amber',
        'satlotto_nwc',
        'satlotto_extension',
    ].forEach(k => localStorage.removeItem(k));

    clearNwcStorage();

    // Recargar la página para resetear TODA la memoria:
    // authState singleton, NDK instance, signers, NDK connections
    window.location.reload();
}

// ─── External login detection ───────────────────────────────────────

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
        try {
            const obj = JSON.parse(ev);
            obj.sig = sig;
            (window as any).lastExternalSig = obj;
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

// ─── Login handlers ─────────────────────────────────────────────────

export async function handleAutoLogin(): Promise<void> {
    setAuthError('');

    if (NIP07.isAvailable()) {
        try {
            const signer = new NDKNip07Signer();
            await signer.blockUntilReady();
            const user = await signer.user();
            authState.pubkey = user.pubkey;
            authState.signer = signer;
            authState.loginMethod = 'extension';
            localStorage.setItem('satlotto_login_method', 'extension');
            await finishLogin();
            return;
        } catch (e: any) {
            setAuthError(`No se pudo conectar con la extensión: ${e.message}. Asegúrate de que tu extensión (Alby/Nos2x) esté desbloqueada.`);
            return;
        }
    }

    if (NIP55.isAvailable()) {
        const root = window.location.origin + window.location.pathname;
        const callbackWithParam = root + '?result=';

        sessionStorage.setItem('login_pending', JSON.stringify({
            timestamp: Date.now(),
            callbackUrl: callbackWithParam
        }));

        logRemote({ msg: 'REDIRECT_TO_MOBILE_SIGNER', callbackUrl: callbackWithParam });
        window.location.href = NIP55.getPublicKey(callbackWithParam);
        return;
    }

    setAuthError('No se detectó ninguna extensión de Nostr. Instalá Alby o usá una URL de NWC/Bunker para continuar.');
}

export async function handleBunkerLogin(): Promise<void> {
    const btn = document.getElementById('bunkerLogin') as HTMLButtonElement;
    const input = document.getElementById('bunkerInput') as HTMLInputElement;
    try {
        setAuthError('');
        const target = input?.value || '';
        if (!target) throw new Error('Bunker URL o NIP-05 requerido');

        if (btn) { btn.textContent = 'Conectando...'; btn.disabled = true; }
        logRemote({ msg: 'Iniciando Bunker manual', target });

        if (target.startsWith('bunker://')) {
            const relays = new URL(target).searchParams.getAll('relay');
            relays.forEach(r => ndk.addExplicitRelay(r));
        }

        const signer = new NDKNip46Signer(ndk, target, getOrCreateLocalSigner());
        signer.on('authUrl', (url: string) => {
            logRemote({ msg: 'Bunker requiere autorización', url });
            window.open(url, '_blank', 'width=400,height=600');
        });

        await signer.blockUntilReady();
        const user = await signer.user();
        authState.pubkey = user.pubkey;
        authState.signer = signer;
        authState.bunkerTarget = target;
        authState.loginMethod = 'bunker';
        localStorage.setItem('satlotto_login_method', 'bunker');
        await finishLogin();
    } catch (e: any) {
        logRemote({ msg: 'Fallo Bunker manual', err: e.message });
        setAuthError(`Error de conexión Bunker: ${e.message}. Verificá el handle o la URI y asegurate de autorizar la conexión en tu app.`);
    } finally {
        if (btn) { btn.textContent = 'Conectar Bunker manual'; btn.disabled = false; }
    }
}

export async function initNostrConnect(): Promise<void> {
    const qr = document.getElementById('qrContainer');
    const uri = document.getElementById('connectUri') as HTMLElement;
    if (!qr || !uri) return;

    try {
        qr.innerHTML = '<div class="qr-placeholder">Generando...</div>';
        const signer = getOrCreateLocalSigner();
        const pubkey = (await signer.user()).pubkey;
        const secret = Math.random().toString(36).substring(7);
        const connectUri = `nostrconnect://${pubkey}?relay=wss://relay.nsec.app&relay=wss://relay.damus.io&secret=${secret}&name=SatLotto`;

        uri.dataset.full = connectUri;
        uri.textContent = connectUri.length > 50 ? connectUri.substring(0, 50) + '...' : connectUri;
        qr.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(connectUri)}" alt="QR" />`;

        const confirmedPubkey = await new Promise<string>((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('Timeout (60s)')), 60000);
            ndk.subscribe({ kinds: [24133 as any], "#p": [pubkey] }, { closeOnEose: false }).on('event', async (ev) => {
                try {
                    const decrypted = await signer.decrypt(ndk.getUser({ pubkey: ev.pubkey }), ev.content);
                    if (JSON.parse(decrypted).result === secret) { clearTimeout(t); resolve(ev.pubkey); }
                } catch {}
            });
        });

        logRemote({ msg: 'Confirmado desde NostrConnect', pubkey: confirmedPubkey });
        authState.pubkey = confirmedPubkey;
        authState.bunkerTarget = confirmedPubkey;
        await finishLogin();
    } catch (e: any) {
        logRemote({ msg: 'Fallo en Nostr Connect', err: e.message });
        const errDiv = document.createElement('div');
        errDiv.className = 'qr-placeholder text-error';
        errDiv.textContent = e.message;
        qr.innerHTML = '';
        qr.appendChild(errDiv);
    }
}

// ─── Core auth functions ────────────────────────────────────────────

export async function finishLogin(): Promise<void> {
    if (!authState.pubkey) return;
    localStorage.setItem('satlotto_pubkey', authState.pubkey);
    if (authState.bunkerTarget) localStorage.setItem('satlotto_bunker', authState.bunkerTarget);

    updateAuthUI();

    if (!authState.signer) {
        if (authState.bunkerTarget) {
            const signer = new NDKNip46Signer(ndk, authState.bunkerTarget, getOrCreateLocalSigner());
            (signer as any).ndk = ndk;
            signer.blockUntilReady().then(() => {
                console.log('[Bunker] Signer is ready for action');
            }).catch(e => {
                console.error('[Bunker] Handshake failed during login:', e);
            });
            authState.signer = signer;
        } else if (authState.nwcUrl) {
            authState.signer = restoreSigner(authState.nwcUrl);
        } else if (NIP07.isAvailable()) {
            authState.signer = new NDKNip07Signer();
        }
    }

    const res = await fetch(`/api/identity/${authState.pubkey}`);
    const data = res.ok ? await res.json() : { alias: null, lastCelebrated: 0 };
    authState.lastCelebratedBlock = data.lastCelebrated || 0;

    const apiAliasResp = await fetchIdentity(authState.pubkey);
    const apiAlias = data.alias || apiAliasResp?.alias;
    const user = ndk.getUser({ pubkey: authState.pubkey });
    const profile = await user.fetchProfile();
    const ndkAlias = profile?.nip05 || null;

    ndk.fetchEvent({ kinds: [0], authors: [authState.pubkey] }).then(ev => {
        if (ev) {
            const raw = ev.rawEvent();
            authState.loginEvent = raw;
            fetch(`/api/identity/${authState.pubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: raw })
            }).catch(() => {});
        }
    });

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

        const badge = document.getElementById('loginMethodBadge');
        if (badge && authState.loginMethod) {
            const method = authState.loginMethod;
            const labels: Record<string, string> = { amber: 'MOBILE', nwc: 'NWC', bunker: 'BUNKER', extension: 'EXTENSION' };
            badge.textContent = labels[method] || method;
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

        const nwcBtn = modal.querySelector('#nwcBtn') as HTMLButtonElement;
        const nwcInput = modal.querySelector('#nwcInput') as HTMLInputElement;
        if (nwcBtn) { nwcBtn.textContent = 'Conectar Wallet'; nwcBtn.disabled = false; }
        if (nwcInput) nwcInput.value = '';

        (window as any).initNostrConnect?.();

        const { hasStoredNwc, isLocked } = await import('../lib/nwc');
        const hasNwc = await hasStoredNwc();
        const locked = isLocked();
        if (hasNwc && !locked) handleNwcLoginAutoPin();
    }
}
