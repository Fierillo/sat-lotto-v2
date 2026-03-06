import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { nwc } from '@getalby/sdk';

export const authState = {
    pubkey: null as string | null,
    signer: null as NDKNip07Signer | null
};

export function createLoginModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
        <div class="modal">
            <h2>Conectá tu Wallet</h2>
            <button class="auth-btn" id="extensionLogin">Login con extensión</button>
            <div class="nwc-section">
                <input type="password" id="nwcInput" placeholder="nostr+walletconnect://..." />
                <button class="auth-btn" id="nwcLogin">Conectar NWC</button>
            </div>
            <p id="authError" class="auth-error"></p>
            <button class="close-btn" id="closeModal">Cerrar</button>
        </div>
    `;

    modal.querySelector('#extensionLogin')?.addEventListener('click', () => handleAutoLogin());
    modal.querySelector('#nwcLogin')?.addEventListener('click', () => handleNwcLogin());
    modal.querySelector('#closeModal')?.addEventListener('click', () => hideLoginModal());

    return modal;
}

export function createLoginButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.id = 'loginBtn';
    btn.className = 'top-login-btn';
    btn.textContent = 'ENTRAR';
    btn.onclick = showLoginModal;
    return btn;
}

async function loginWithExtension(): Promise<void> {
    if (!(window as any).nostr) throw new Error('No se detectó extensión Nostr (Alby/Nos2x)');
    const signer = new NDKNip07Signer();
    await signer.blockUntilReady();
    const user = await signer.user();
    authState.pubkey = user.pubkey;
    authState.signer = signer;
    updateAuthUI();
}

export async function loginWithNwc(nwcUrl: string): Promise<void> {
    if (!nwcUrl) throw new Error('NWC URL inválida');
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    const info = await client.getInfo();
    if (!info.pubkey) throw new Error('La conexión NWC no devolvió un pubkey válido');
    authState.pubkey = info.pubkey;
    updateAuthUI();
}

function handleAutoLogin(): void {
    setAuthError('');
    if ((window as any).nostr) {
        loginWithExtension().catch(e => setAuthError(e.message));
        return;
    }
    window.location.href = 'nostrsigner:';
    setTimeout(() => {
        if (!authState.pubkey) setAuthError('No se detectó extensión ni app móvil. Usá el login con NWC.');
    }, 2500);
}

async function handleNwcLogin(): Promise<void> {
    try {
        setAuthError('');
        const input = document.getElementById('nwcInput') as HTMLInputElement;
        await loginWithNwc(input?.value || '');
    } catch (e: any) {
        setAuthError(e.message);
    }
}

function setAuthError(msg: string): void {
    const err = document.getElementById('authError');
    if (err) err.textContent = msg;
}

export function showLoginModal(): void {
    const el = document.getElementById('loginModal');
    if (el) el.style.display = 'flex';
}

export function hideLoginModal(): void {
    const el = document.getElementById('loginModal');
    if (el) el.style.display = 'none';
}

export function updateAuthUI(): void {
    const loginBtn = document.getElementById('loginBtn');
    hideLoginModal();
    if (!loginBtn) return;

    if (authState.pubkey) {
        loginBtn.textContent = `${authState.pubkey.slice(0, 6)}...${authState.pubkey.slice(-4)}`;
        loginBtn.classList.add('logged-in');
    } else {
        loginBtn.textContent = 'ENTRAR';
        loginBtn.classList.remove('logged-in');
    }
}
