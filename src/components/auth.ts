import { NDKNip07Signer, NDKNip46Signer } from '@nostr-dev-kit/ndk';
import { getNwcInfo } from '../utils/nwc-connect';
import { getPublicKey } from 'nostr-tools';
import ndk, { resolveName } from '../utils/nostr';
import { fetchIdentity } from '../utils/ledger';

export const authState = {
    pubkey: localStorage.getItem('satlotto_pubkey'),
    signer: null as any | null,
    nwcUrl: localStorage.getItem('satlotto_nwc'),
    bunkerTarget: localStorage.getItem('satlotto_bunker'),
    nip05: null as string | null
};

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

export const logRemote = (data: any) => {
    let devLog = document.getElementById('devLog');
    if (!devLog && document.body) {
        devLog = document.createElement('div');
        devLog.id = 'devLog';
        devLog.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(0,255,0,0.05);backdrop-filter:blur(4px);color:#0f0;font-size:9px;z-index:9999;max-height:80px;overflow:auto;padding:5px;pointer-events:none;font-family:monospace;border-bottom:1px solid rgba(0,255,0,0.2);text-shadow:0 0 5px #0f0;display:none;';
        document.body.appendChild(devLog);
    }
    if (devLog) {
        const time = new Date().toLocaleTimeString();
        devLog.innerHTML += `<div style="margin-bottom:2px; border-left:2px solid #0f0; padding-left:4px">[${time}] ${JSON.stringify(data)}</div>`;
        devLog.scrollTop = devLog.scrollHeight;
    }

    fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(() => { });
};

export function createLoginModal(): HTMLElement {
    const loginModalContainer = document.createElement('div');
    loginModalContainer.id = 'loginModal';
    loginModalContainer.className = 'modal-bg';
    loginModalContainer.innerHTML = `
        <div class="modal">
            <h2>Conectá tu Wallet</h2>
            <button class="auth-btn" id="extLogin">Login con extensión</button>
            <div class="nwc-section">
                <input type="password" id="nwcInput" placeholder="nostr+walletconnect://..." />
                <button class="auth-btn" id="nwcBtn">Conectar NWC</button>
            </div>
            <div class="nwc-section">
                <input type="text" id="bunkerInput" placeholder="bunker://... o handle@domain" />
                <button class="auth-btn" id="bunkerLogin">Conectar Bunker (NIP-46)</button>
            </div>
            <p id="authError" class="auth-error"></p>
            <button class="close-btn" id="closeModal">Cerrar</button>
        </div>
    `;

    loginModalContainer.querySelector('#extLogin')?.addEventListener('click', () => handleAutoLogin());
    loginModalContainer.querySelector('#nwcBtn')?.addEventListener('click', () => handleNwcLogin());
    loginModalContainer.querySelector('#bunkerLogin')?.addEventListener('click', () => handleBunkerLogin());
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
    const { info: nwcConnectionInfo } = await getNwcInfo(nwcUrl);
    const nwcUrlObject = new URL(nwcUrl.replace('nostr+walletconnect:', 'http:'));
    const secretKeyHex = nwcUrlObject.searchParams.get('secret');

    if (secretKeyHex) {
        const secretKeyBytes = Uint8Array.from(secretKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        authState.pubkey = getPublicKey(secretKeyBytes);
    } else {
        if (!nwcConnectionInfo.pubkey) throw new Error('La conexión NWC no devolvió un pubkey válido');
        authState.pubkey = nwcConnectionInfo.pubkey;
    }

    authState.nwcUrl = nwcUrl;
    finishLogin();
}

async function handleBunkerLogin(): Promise<void> {
    const loginButton = document.getElementById('bunkerLogin') as HTMLButtonElement;
    const bunkerInput = document.getElementById('bunkerInput') as HTMLInputElement;
    try {
        setAuthError('');
        const bunkerTarget = bunkerInput?.value || '';
        if (!bunkerTarget) throw new Error('Bunker URL o NIP-05 requerido');

        loginButton.textContent = 'Conectando...';
        loginButton.disabled = true;

        const bunkerSigner = new NDKNip46Signer(ndk, bunkerTarget);
        await bunkerSigner.blockUntilReady();
        const bunkerUser = await bunkerSigner.user();

        authState.pubkey = bunkerUser.pubkey;
        authState.signer = bunkerSigner;
        authState.bunkerTarget = bunkerTarget;
        finishLogin();
    } catch (loginError: any) {
        setAuthError(loginError.message);
    } finally {
        if (loginButton) {
            loginButton.textContent = 'Conectar Bunker (NIP-46)';
            loginButton.disabled = false;
        }
    }
}

export async function finishLogin(): Promise<void> {
    if (authState.pubkey) {
        localStorage.setItem('satlotto_pubkey', authState.pubkey);
        if (authState.nwcUrl) localStorage.setItem('satlotto_nwc', authState.nwcUrl);
        if (authState.bunkerTarget) localStorage.setItem('satlotto_bunker', authState.bunkerTarget);

        if (!authState.signer && authState.bunkerTarget) {
            try {
                const bunkerSigner = new NDKNip46Signer(ndk, authState.bunkerTarget);
                await bunkerSigner.blockUntilReady();
                authState.signer = bunkerSigner;
            } catch (e) {
                logRemote({ msg: 'Bunker re-init failed', error: (e as any).message });
            }
        } else if (!authState.signer && (window as any).nostr) {
            authState.signer = new NDKNip07Signer();
        }

        let userAlias = await fetchIdentity(authState.pubkey);
        if (!userAlias) {
            const ndkUser = ndk.getUser({ pubkey: authState.pubkey });
            await ndkUser.fetchProfile();
            userAlias = ndkUser.profile?.nip05 || null;
        }
        authState.nip05 = userAlias;
    }
    updateAuthUI();
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
    if (loginModalElement) loginModalElement.style.display = 'flex';
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
