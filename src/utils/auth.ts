import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { resolveName, setAlias } from './nostr-service';
import { fetchIdentity } from './game';
import { copyToClipboard } from './clipboard-utils';
import { clearNwcStorage } from '../lib/crypto';
import { setAuthError, NWC, handleNwcLogin, handleNwcLoginAutoPin, restoreSigner } from '../lib/nwc';
import { NIP07 } from '../lib/nip07';
import { NIP55 } from '../lib/nip55';
import type { LoginHandlers, LogRemoteData } from '../types';

// ─── Auth State ──────────────────────────────────────────────────────

export const authState = {
    pubkey: localStorage.getItem('satlotto_pubkey'),
    signer: null as any | null,
    nwcUrl: null as string | null,
    bunkerTarget: localStorage.getItem('satlotto_bunker'),
    localPrivkey: localStorage.getItem('satlotto_local_privkey'),
    nip05: localStorage.getItem('satlotto_alias'),
    loginEvent: null as any | null,
    lastCelebratedBlock: 0,
    loginMethod: localStorage.getItem('satlotto_login_method')
};

export const logRemote = (data: LogRemoteData) => {
    console.log('[SatLotto]', data);

    let devLog = document.getElementById('devLog');
    if (!devLog && document.body) {
        devLog = document.createElement('div');
        devLog.id = 'devLog';
        devLog.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);color:#0f0;font-size:10px;z-index:9999;max-height:150px;overflow:auto;padding:10px;pointer-events:none;font-family:monospace;border-bottom:1px solid rgba(0,255,0,0.5);text-shadow:0 0 5px #0f0;display:none;';
        document.body.appendChild(devLog);
    }
    if (devLog) {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.style.cssText = 'margin-bottom:2px; border-left:2px solid #0f0; padding-left:4px';
        entry.textContent = `[${time}] ${JSON.stringify(data)}`;
        devLog.appendChild(entry);
        devLog.scrollTop = devLog.scrollHeight;
    }
};

// ─── Local Signer Utils ──────────────────────────────────────────────

export function getOrCreateLocalSigner(): NDKPrivateKeySigner {
    let hex = localStorage.getItem('satlotto_local_privkey');
    if (!hex || hex.length !== 64 || hex.includes('[') || hex.includes('undefined')) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('satlotto_local_privkey', hex);
    }

    const signer = new NDKPrivateKeySigner(hex);
    const originalDecrypt = signer.decrypt.bind(signer);

    signer.decrypt = async (user, content) => {
        try {
            return await originalDecrypt(user, content);
        } catch (e) {
            const { nip04, nip44 } = await import('nostr-tools');
            const privKeyBytes = (typeof hex === 'string')
                ? new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
                : hex;

            if (content.includes('?iv=')) {
                return await nip04.decrypt(privKeyBytes as Uint8Array, user.pubkey, content);
            } else {
                const conversationKey = nip44.v2.utils.getConversationKey(privKeyBytes as Uint8Array, user.pubkey);
                return nip44.v2.decrypt(content, conversationKey);
            }
        }
    };
    return signer;
}

// ─── Login UI ────────────────────────────────────────────────────────

export function createLoginModal(handlers: LoginHandlers): HTMLElement {
    const container = document.createElement('div');
    container.id = 'loginModal';
    container.className = 'modal-bg';
    container.innerHTML = `
        <div class="modal auth-modal">
            <div id="login-main-view">
                <h2>Conectá tu Wallet</h2>
                <div class="auth-tabs">
                    <button class="tab-btn active" data-target="manual-section">Directo / NWC</button>
                    <button class="tab-btn" data-target="connect-section">Bunker</button>
                </div>
                <div id="manual-section" class="auth-section active">
                    <button class="auth-btn" id="extLogin">Login con extensión</button>
                    <div class="nwc-section">
                        <div class="nwc-guide">
                            <p><strong>¿Cómo conectar vía NWC?</strong></p>
                            <ol>
                                <li>Abrí <strong>Alby</strong>, <strong>Mutiny</strong> o tu wallet NWC.</li>
                                <li>Buscá "Connections" y creá una para <strong>SatLotto</strong>.</li>
                                <li>Copiá el link y pegalo acá abajo:</li>
                            </ol>
                        </div>
                        <input type="text" id="nwcInput" placeholder="nostr+walletconnect://..." />
                        <button class="auth-btn" id="nwcBtn">Conectar Wallet</button>
                    </div>
                </div>
                <div id="connect-section" class="auth-section">
                    <div id="qrContainer" class="qr-container"><div class="qr-placeholder">Generando URI...</div></div>
                    <code id="connectUri" style="cursor:pointer; font-size:0.7rem; word-break:break-all;">Generando...</code>
                    <div id="copyUriStatus" style="opacity:0">¡Copiado! ⚡</div>
                    <button class="auth-btn secondary" id="refreshConnect">Generar nuevo QR</button>
                    <div class="nwc-section" style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                        <input type="text" id="bunkerInput" placeholder="bunker://... o handle@domain" />
                        <button class="auth-btn" id="bunkerLogin">Conectar Bunker manual</button>
                    </div>
                </div>
            </div>

            <div id="pin-view" class="auth-section" style="display:none; text-align:center;">
                <h2 id="pinTitle">Seguridad de la Wallet</h2>
                <p id="pinDesc" style="font-size:0.9rem; opacity:0.8; margin-bottom:20px;"></p>
                <div class="pin-input-container" style="display:flex; justify-content:center; gap:10px; margin-bottom:20px;">
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                    <input type="password" inputmode="numeric" pattern="[0-9]*" class="pin-digit" maxlength="1" />
                </div>
                <p id="pinError" class="auth-error"></p>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="auth-btn secondary" id="backToLogin">Volver</button>
                    <button class="auth-btn" id="confirmPinInModal">Continuar</button>
                </div>
            </div>

            <p id="authError" class="auth-error"></p>
            <button class="close-btn" id="closeModal">Cerrar</button>
        </div>
    `;

    const digits = container.querySelectorAll('.pin-digit') as NodeListOf<HTMLInputElement>;
    digits.forEach((d, idx) => {
        d.addEventListener('input', () => {
            if (d.value && idx < digits.length - 1) digits[idx + 1].focus();
        });
        d.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !d.value && idx > 0) {
                digits[idx - 1].focus();
                digits[idx - 1].value = '';
            }
        });
        d.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData?.getData('text') || '';
            const numbers = pastedData.replace(/\D/g, '').substring(0, 4);
            for (let i = 0; i < numbers.length; i++) {
                if (idx + i < digits.length) {
                    digits[idx + i].value = numbers[i];
                    digits[idx + i].focus();
                }
            }
            if (idx + numbers.length < digits.length) {
                digits[idx + numbers.length].focus();
            } else {
                digits[digits.length - 1].focus();
            }
        });
    });

    container.querySelector('#backToLogin')?.addEventListener('click', () => {
        (container.querySelector('#pin-view') as HTMLElement).style.display = 'none';
        (container.querySelector('#login-main-view') as HTMLElement).style.display = 'block';
        (container.querySelector('#authError') as HTMLElement).textContent = '';
    });

    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.tab-btn, .auth-section').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const target = (btn as HTMLElement).dataset.target;
            if (target) container.querySelector(`#${target}`)?.classList.add('active');
            const errorEl = container.querySelector('#authError') as HTMLElement;
            if (errorEl) errorEl.textContent = '';
        });
    });

    container.querySelector('#extLogin')?.addEventListener('click', handlers.onExtLogin);
    container.querySelector('#nwcBtn')?.addEventListener('click', handlers.onNwcLogin);
    container.querySelector('#bunkerLogin')?.addEventListener('click', handlers.onBunkerLogin);
    container.querySelector('#refreshConnect')?.addEventListener('click', handlers.onRefreshConnect);
    container.querySelector('#closeModal')?.addEventListener('click', handlers.onClose);

    container.querySelector('#connectUri')?.addEventListener('click', async () => {
        const uri = (container.querySelector('#connectUri') as HTMLElement).dataset.full || '';
        if (await copyToClipboard(uri)) {
            const status = container.querySelector('#copyUriStatus') as HTMLElement;
            status.style.opacity = '1';
            setTimeout(() => status.style.opacity = '0', 2000);
        }
    });

    return container;
}

export function createUserProfile(username: string): HTMLElement {
    const container = document.createElement('div');
    container.id = 'userProfile';
    container.className = 'top-user-profile';
    container.innerHTML = `
        <div id="userAlias" class="profile-info"></div>
        <div id="loginMethodBadge" class="method-badge"></div>
        <div id="logoutMenu" class="logout-menu"><button id="logoutBtn">Cerrar Sesión</button></div>
    `;

    const aliasDisplay = container.querySelector('#userAlias') as HTMLElement;
    aliasDisplay.textContent = username;

    container.addEventListener('click', () => container.querySelector('#logoutMenu')?.classList.toggle('active'));
    container.querySelector('#logoutBtn')?.addEventListener('click', logout);
    return container;
}

// ─── Logout ─────────────────────────────────────────────────────────

export function logout(): void {
    NWC.disconnect();

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
            window.lastExternalSig = obj;
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
    window.updateCenterButton?.();
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

        window.initNostrConnect?.();

        const { hasStoredNwc, isLocked } = await import('../lib/crypto');
        const hasNwc = await hasStoredNwc();
        const locked = isLocked();
        if (hasNwc && !locked) handleNwcLoginAutoPin();
    }
}
