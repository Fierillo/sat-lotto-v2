import { NDKNip07Signer, NDKNip46Signer } from '@nostr-dev-kit/ndk';
import { getNwcInfo } from '../utils/nwc-connect';
import { getPublicKey } from 'nostr-tools';
import ndk, { resolveName } from '../utils/nostr';
import { fetchIdentity } from '../utils/ledger';

export const authState = {
    pubkey: null as string | null,
    signer: null as any | null,
    nwcUrl: null as string | null,
    nip05: null as string | null
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

async function finishLogin(): Promise<void> {
    if (authState.pubkey) {
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
    if ((window as any).nostr) {
        loginWithExtension().catch(error => setAuthError(error.message));
        return;
    }
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = 'nostrsigner:';
        return;
    }
    setAuthError('No se detectó extensión Nostr.');
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

    if (authState.pubkey) {
        if (userProfileDisplay) {
            userProfileDisplay.textContent = resolveName(authState.pubkey);
            userProfileDisplay.style.display = 'block';
        }
        document.body.classList.remove('logged-out');
    } else {
        if (userProfileDisplay) userProfileDisplay.style.display = 'none';
        document.body.classList.add('logged-out');
    }

    if (typeof (window as any).updateCenterButton === 'function') (window as any).updateCenterButton();
}
