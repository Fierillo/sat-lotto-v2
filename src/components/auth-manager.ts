import NDK, { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { getNwcInfo } from '../utils/nwc-connect';
import ndk, { resolveName } from '../utils/nostr-service';
import { fetchIdentity } from '../utils/game-api';
import { copyToClipboard } from '../utils/clipboard-utils';
import { authState, logRemote } from './auth-state';

function getOrCreateLocalSigner(): NDKPrivateKeySigner {
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

export function logout(): void {
    localStorage.removeItem('satlotto_pubkey');
    localStorage.removeItem('satlotto_nwc');
    localStorage.removeItem('satlotto_bunker');
    authState.pubkey = null;
    authState.signer = null;
    authState.nwcUrl = null;
    authState.bunkerTarget = null;
    authState.nip05 = null;
    updateAuthUI();
    if (typeof (window as any).updateUI === 'function') (window as any).updateUI();
}


export function createLoginModal(): HTMLElement {
    const loginModalContainer = document.createElement('div');
    loginModalContainer.id = 'loginModal';
    loginModalContainer.className = 'modal-bg';
    loginModalContainer.innerHTML = `
        <div class="modal auth-modal">
            <h2>Conectá tu Wallet</h2>
            
            <div class="auth-tabs">
                <button class="tab-btn active" data-target="manual-section">Directo / NWC</button>
                <button class="tab-btn" data-target="connect-section">Bunker (QR)</button>
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
                    <input type="password" id="nwcInput" placeholder="nostr+walletconnect://..." />
                    <button class="auth-btn" id="nwcBtn">Conectar Wallet</button>
                </div>
            </div>

            <div id="connect-section" class="auth-section">
                <p class="auth-hint">Escaneá con Amber o pegá la URI en tu Bunker</p>
                <div id="qrContainer" class="qr-container">
                    <div class="qr-placeholder">Generando URI...</div>
                </div>
                <div class="uri-display-v2">
                    <code id="connectUri" style="cursor: pointer; padding: 12px; display: block; background: rgba(0,0,0,0.4); position: relative; margin: 5px 0; font-size: 0.7rem; word-break: break-all; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1)">
                        Generando...
                    </code>
                    <div id="copyUriStatus" style="color: var(--neon-green); font-size: 0.65rem; text-align: center; opacity: 0; transition: opacity 0.3s; font-weight: bold; margin-top: 5px">¡Copiado! ⚡</div>
                </div>
                <button class="auth-btn secondary" id="refreshConnect">Generar nuevo QR</button>
                
                <div class="nwc-section" style="margin-top:20px; border-top:1px solid var(--glass-border-light); padding-top:20px;">
                    <input type="text" id="bunkerInput" placeholder="bunker://... o handle@domain" />
                    <button class="auth-btn" id="bunkerLogin">Conectar Bunker manual</button>
                </div>
            </div>

            <p id="authError" class="auth-error"></p>
            <button class="close-btn" id="closeModal">Cerrar</button>
        </div>
    `;

    // Tab switching logic
    loginModalContainer.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            loginModalContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            loginModalContainer.querySelectorAll('.auth-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const target = (btn as HTMLElement).dataset.target;
            if (target) loginModalContainer.querySelector(`#${target}`)?.classList.add('active');
        });
    });

    loginModalContainer.querySelector('#extLogin')?.addEventListener('click', () => handleAutoLogin());
    loginModalContainer.querySelector('#nwcBtn')?.addEventListener('click', () => handleNwcLogin());
    loginModalContainer.querySelector('#bunkerLogin')?.addEventListener('click', handleBunkerLogin);
    loginModalContainer.querySelector('#refreshConnect')?.addEventListener('click', () => initNostrConnect());
    const handleCopy = async () => {
        const uriElement = document.getElementById('connectUri') as HTMLElement;
        const status = document.getElementById('copyUriStatus');
        if (!uriElement || !status) return;
        
        const textToCopy = uriElement.dataset.full || uriElement.textContent || '';
        const success = await copyToClipboard(textToCopy);
        if (success) {
            status.style.opacity = '1';
            uriElement.style.borderColor = 'var(--neon-green)';
            setTimeout(() => { 
                status.style.opacity = '0'; 
                uriElement.style.borderColor = 'rgba(255,255,255,0.1)';
            }, 2000);
        }
    };

    loginModalContainer.querySelector('#connectUri')?.addEventListener('click', handleCopy);
    loginModalContainer.querySelector('#closeModal')?.addEventListener('click', () => hideLoginModal());

    return loginModalContainer;
}

export function createUserProfile(): HTMLElement {
    const profileContainer = document.createElement('div');
    profileContainer.id = 'userProfile';
    profileContainer.className = 'top-user-profile';
    profileContainer.style.display = 'none';
    profileContainer.innerHTML = `
        <div id="userAlias" class="profile-info"></div>
        <div id="logoutMenu" class="logout-menu">
            <button id="logoutBtn">Cerrar Sesión</button>
        </div>
    `;

    profileContainer.addEventListener('click', (e) => {
        const menu = document.getElementById('logoutMenu');
        if (menu) menu.classList.toggle('active');
        e.stopPropagation();
    });

    profileContainer.querySelector('#logoutBtn')?.addEventListener('click', () => logout());

    return profileContainer;
}

async function loginWithExtension(): Promise<void> {
    const nostrExtension = (window as any).nostr;
    if (!nostrExtension) throw new Error('No se detectó extensión Nostr (Alby/Nos2x)');

    const extensionSigner = new NDKNip07Signer();
    await extensionSigner.blockUntilReady();
    const nostrUser = await extensionSigner.user();

    authState.pubkey = nostrUser.pubkey;
    authState.signer = extensionSigner;
    await finishLogin();
}

export async function loginWithNwc(nwcUrl: string): Promise<void> {
    if (!nwcUrl) throw new Error('NWC URL inválida');
    
    logRemote({ msg: 'Iniciando login vía NWC', url: nwcUrl });
    const { info: nwcConnectionInfo } = await getNwcInfo(nwcUrl);
    
    const nwcUrlObject = new URL(nwcUrl.replace('nostr+walletconnect:', 'http:'));
    const secretKeyHex = nwcUrlObject.searchParams.get('secret');

    if (secretKeyHex) {
        const signer = new NDKPrivateKeySigner(secretKeyHex);
        authState.signer = signer;
        const user = await signer.user();
        authState.pubkey = user.pubkey;
        logRemote({ msg: 'NWC Signer creado', pubkey: user.pubkey });
    } else {
        if (!nwcConnectionInfo.pubkey) throw new Error('La conexión NWC no tiene pubkey y no tiene secreto para generar uno.');
        authState.pubkey = nwcConnectionInfo.pubkey;
    }

    if (nwcConnectionInfo.alias && !authState.nip05) {
        authState.nip05 = nwcConnectionInfo.alias;
    }

    authState.nwcUrl = nwcUrl;
    await finishLogin();
}

async function initNostrConnect(): Promise<void> {
    const qrContainer = document.getElementById('qrContainer');
    const uriInput = document.getElementById('connectUri') as HTMLInputElement;
    if (!qrContainer) return;

    try {
        qrContainer.innerHTML = '<div class="qr-placeholder">Generando...</div>';
        const localSigner = getOrCreateLocalSigner();
        const localUser = await localSigner.user();
        const pubkey = localUser.pubkey;

        const bunkerRelays = ['wss://relay.nsec.app', 'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
        const secret = Math.random().toString(36).substring(7);
        const name = 'SatLotto';
        const url = window.location.origin;
        
        const bunkerSigner = new NDKNip46Signer(ndk, "", localSigner);
        (bunkerSigner as any).token = secret;

        let connectUri = `nostrconnect://${pubkey}?`;
        bunkerRelays.forEach(r => connectUri += `relay=${encodeURIComponent(r)}&`);
        connectUri += `secret=${secret}&name=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`;
        
        if (uriInput) {
            uriInput.dataset.full = connectUri;
            uriInput.textContent = connectUri.length > 60 ? connectUri.substring(0, 60) + '...' : connectUri;
        }
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(connectUri)}" alt="QR Nostr Connect" />`;

        logRemote({ msg: 'Esperando conexión desde Amber...', relays: bunkerRelays });

        // Handshake Manual (Estrategia Primal)
        const handshakePromise = new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout (60s)')), 60000);
            ndk.subscribe({
                kinds: [24133 as any],
                "#p": [pubkey]
            }, { closeOnEose: false }).on('event', async (ev) => {
                try {
                    const decrypted = await localSigner.decrypt(ndk.getUser({ pubkey: ev.pubkey }), ev.content);
                    const data = JSON.parse(decrypted);
                    if (data.result === secret) {
                        clearTimeout(timeout);
                        resolve(ev.pubkey);
                    }
                } catch (e) {}
            });
        });

        const confirmedPubkey = await handshakePromise;
        (bunkerSigner as any).remotePubkey = confirmedPubkey;
        (bunkerSigner as any).remoteUser = ndk.getUser({ pubkey: confirmedPubkey });
        (bunkerSigner as any).ndk = ndk;
        ndk.signer = bunkerSigner;

        authState.pubkey = confirmedPubkey;
        authState.signer = bunkerSigner;
        authState.bunkerTarget = confirmedPubkey; 
        
        await finishLogin();
        updateAuthUI();
    } catch (e: any) {
        logRemote({ msg: 'Fallo fatal en Nostr Connect', err: e.message });
        if (qrContainer) qrContainer.innerHTML = `<div class="qr-placeholder text-error">Error: ${e.message}</div>`;
    }
}

async function handleBunkerLogin(): Promise<void> {
    const loginButton = document.getElementById('bunkerLogin') as HTMLButtonElement;
    const bunkerInput = document.getElementById('bunkerInput') as HTMLInputElement;
    try {
        setAuthError('');
        let bunkerTarget = bunkerInput?.value || '';
        if (!bunkerTarget) throw new Error('Bunker URL o NIP-05 requerido');

        loginButton.textContent = 'Conectando...';
        loginButton.disabled = true;

        if (bunkerTarget.startsWith('bunker://')) {
            const url = new URL(bunkerTarget);
            const relays = url.searchParams.getAll('relay');
            if (relays.length) {
                relays.forEach(r => ndk.addExplicitRelay(r));
                await Promise.all(relays.map(r => ndk.pool.getRelay(r)?.connect()));
            }
        }

        const localSigner = getOrCreateLocalSigner();
        const bunkerSigner = new NDKNip46Signer(ndk, bunkerTarget, localSigner);
        
        bunkerSigner.on('authUrl', (url: string) => {
            window.open(url, '_blank', 'width=400,height=600');
        });

        await Promise.race([
            bunkerSigner.blockUntilReady(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (30s)')), 30000))
        ]);
        
        const bunkerUser = await bunkerSigner.user();
        authState.pubkey = bunkerUser.pubkey;
        authState.signer = bunkerSigner;
        authState.bunkerTarget = bunkerTarget;
        await finishLogin();
    } catch (loginError: any) {
        setAuthError(loginError.message);
    } finally {
        if (loginButton) {
            loginButton.textContent = 'Conectar Bunker manual';
            loginButton.disabled = false;
        }
    }
}

let isFinishingLogin = false;
export async function finishLogin(): Promise<void> {
    if (!authState.pubkey || isFinishingLogin) return;
    isFinishingLogin = true;

    try {
        localStorage.setItem('satlotto_pubkey', authState.pubkey);
        if (authState.nwcUrl) localStorage.setItem('satlotto_nwc', authState.nwcUrl);
        if (authState.bunkerTarget) localStorage.setItem('satlotto_bunker', authState.bunkerTarget);

        const withTimeout = (promise: Promise<any>, ms: number, msg: string) => 
            Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);

        if (!authState.signer && authState.bunkerTarget) {
            try {
                const localSigner = getOrCreateLocalSigner();
                const bunkerSigner = new NDKNip46Signer(ndk, authState.bunkerTarget, localSigner);
                
                // Si es solo una pubkey, forzamos el seteo para NDK
                if (authState.bunkerTarget.length === 64 && !authState.bunkerTarget.includes(':')) {
                    (bunkerSigner as any).remotePubkey = authState.bunkerTarget;
                    (bunkerSigner as any).remoteUser = ndk.getUser({ pubkey: authState.bunkerTarget });
                }

                bunkerSigner.on('authUrl', (url: string) => {
                    logRemote({ msg: 'Autorización requerida en restauración', url });
                    window.open(url, '_blank', 'width=400,height=600');
                });

                // No bloqueamos por blockUntilReady en restauración para evitar el hang de Amber
                (bunkerSigner as any).ndk = ndk;
                authState.signer = bunkerSigner;
                logRemote({ msg: 'Sesión Bunker restaurada' });
            } catch (e) {
                logRemote({ msg: 'Bunker re-init failed', error: (e as any).message });
            }
        } else if (!authState.signer && authState.nwcUrl) {
        try {
            const nwcUrlObject = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
            const secretKeyHex = nwcUrlObject.searchParams.get('secret');
            if (secretKeyHex) {
                authState.signer = new NDKPrivateKeySigner(secretKeyHex);
                logRemote({ msg: 'Signer NWC restaurado automáticamente' });
            }
        } catch (e) {
            logRemote({ msg: 'Error restaurando signer NWC', error: (e as any).message });
        }
    } else if (!authState.signer && (window as any).nostr) {
        authState.signer = new NDKNip07Signer();
    }

    if (!authState.nip05) {
        try {
            let userAlias = await fetchIdentity(authState.pubkey);
            if (!userAlias) {
                logRemote({ msg: 'Buscando alias en Nostr Relays', pubkey: authState.pubkey });
                const ndkUser = ndk.getUser({ pubkey: authState.pubkey });
                await withTimeout(ndkUser.fetchProfile(), 5000, 'Fetch profile timeout');
                userAlias = ndkUser.profile?.nip05 || null;
            }
            authState.nip05 = userAlias;
        } catch (e) {
            logRemote({ msg: 'NIP-05 fetch failed', error: (e as any).message });
        }
    }

    } finally {
        isFinishingLogin = false;
        updateAuthUI();
    }
}

function handleAutoLogin(): void {
    setAuthError('');
    const windowNostr = (window as any).nostr;

    if (windowNostr) {
        logRemote({ msg: 'Login via Extension detected' });
        loginWithExtension().catch(error => setAuthError(error.message));
        return;
    }

    if (/Android/i.test(navigator.userAgent)) {
        const cleanRoot = window.location.origin + window.location.pathname;
        const intentUrl = `nostrsigner:?type=get_public_key&callbackUrl=${encodeURIComponent(cleanRoot)}`;
        logRemote({ msg: 'Triggering Amber Intent', intent: intentUrl });
        window.location.href = intentUrl;
        return;
    }

    logRemote({ msg: 'No Nostr wallet detected', ua: navigator.userAgent });
    setAuthError('No se detectó extensión Nostr.');
}

export function checkExternalLogin(): void {
    const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
    const externalPubkey = urlParams.get('pubkey');
    const signature = urlParams.get('signature');
    const event = urlParams.get('event');

    if (externalPubkey) {
        authState.pubkey = externalPubkey;
        finishLogin();
    }

    if (signature && event) {
        const eventObj = JSON.parse(event);
        eventObj.sig = signature;
        (window as any).lastExternalSig = eventObj;
    }

    if (externalPubkey || (signature && event)) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}


async function handleNwcLogin(): Promise<void> {
    try {
        setAuthError('');
        const nwcInputField = document.getElementById('nwcInput') as HTMLInputElement;
        await loginWithNwc(nwcInputField?.value || '');
    } catch (nwcError: any) {
        setAuthError(nwcError.message);
    }
}

function setAuthError(errorMessage: string): void {
    const errorDisplay = document.getElementById('authError');
    if (errorDisplay) errorDisplay.textContent = errorMessage;
}

export function showLoginModal(): void {
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement) {
        loginModalElement.style.display = 'flex';
        initNostrConnect();
    }
}

export function hideLoginModal(): void {
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement) loginModalElement.style.display = 'none';
}

export function updateAuthUI(): void {
    hideLoginModal();
    const userProfileDisplay = document.getElementById('userProfile');
    const userAliasDisplay = document.getElementById('userAlias');

    if (authState.pubkey) {
        if (userProfileDisplay && userAliasDisplay) {
            userAliasDisplay.textContent = authState.nip05 || resolveName(authState.pubkey);
            userProfileDisplay.style.display = 'block';
        }
        document.body.classList.remove('logged-out');
    } else {
        if (userProfileDisplay) userProfileDisplay.style.display = 'none';
        document.body.classList.add('logged-out');
    }

    if (typeof (window as any).updateCenterButton === 'function') (window as any).updateCenterButton();
}
