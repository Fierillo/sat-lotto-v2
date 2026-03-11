import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { setAlias } from '../utils/nostr-service';
import { getNwcInfo } from '../utils/nwc-connect';
import { authState, logRemote } from './auth-state';
import { getOrCreateLocalSigner } from './auth-utils';
import { finishLogin } from './auth-manager';
import { 
    createPin, verifyPin, encryptNwc, decryptNwc, 
    hasStoredNwc, isLocked 
} from './nwc-storage';

export function setAuthError(msg: string): void {
    const errorDisplay = document.getElementById('authError');
    if (errorDisplay) errorDisplay.textContent = msg;
}

function showPinModal(mode: 'create' | 'verify'): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-bg';
        modal.innerHTML = `
            <div class="modal auth-modal" style="max-width:320px">
                <h2>${mode === 'create' ? 'Creá tu PIN' : 'Ingresá tu PIN'}</h2>
                <p style="font-size:0.9rem;opacity:0.8;margin-bottom:20px">
                    ${mode === 'create' ? 'Este PIN protege tu wallet NWC. Guardalo bien.' : 'Ingresá el PIN de 6 dígitos de tu wallet.'}
                </p>
                <input type="password" id="pinInput" maxlength="6" placeholder="******" style="font-size:1.5rem;letter-spacing:0.5rem;text-align:center" />
                <p id="pinError" class="auth-error"></p>
                <div style="display:flex;gap:10px;margin-top:20px">
                    <button class="auth-btn secondary" id="cancelPin">Cancelar</button>
                    <button class="auth-btn" id="confirmPin">${mode === 'create' ? 'Crear PIN' : 'Desbloquear'}</button>
                </div>
            </div>
        `;
        
        document.getElementById('app')?.appendChild(modal);
        
        const input = modal.querySelector('#pinInput') as HTMLInputElement;
        input?.focus();
        
        modal.querySelector('#cancelPin')?.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });
        
        modal.querySelector('#confirmPin')?.addEventListener('click', async () => {
            const pin = input.value;
            if (pin.length !== 6 || !/^\d+$/.test(pin)) {
                const errorEl = modal.querySelector('#pinError');
                if (errorEl) errorEl.textContent = 'El PIN debe tener 6 dígitos';
                return;
            }
            
            if (mode === 'create') {
                try {
                    await createPin(pin);
                    modal.remove();
                    resolve(pin);
                } catch (e: any) {
                    const errorEl = modal.querySelector('#pinError');
                    if (errorEl) errorEl.textContent = e.message;
                }
            } else {
                const result = await verifyPin(pin);
                if (result.locked) {
                    modal.remove();
                    setAuthError('Tu NWC fue borrado por seguridad. Generá uno nuevo.');
                    return;
                }
                if (!result.success) {
                    const errorEl = modal.querySelector('#pinError');
                    if (errorEl) errorEl.textContent = `PIN incorrecto. Te quedan ${result.attemptsLeft} intentos.`;
                    input.value = '';
                    return;
                }
                modal.remove();
                resolve(pin);
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                modal.querySelector('#confirmPin')?.dispatchEvent(new Event('click'));
            }
        });
    });
}

export async function handleAutoLogin(): Promise<void> {
    setAuthError('');
    try {
        if ((window as any).nostr) {
            const signer = new NDKNip07Signer();
            await signer.blockUntilReady();
            const user = await signer.user();
            authState.pubkey = user.pubkey;
            authState.signer = signer;
            await finishLogin();
            return;
        }
    } catch (e: any) {
        setAuthError(`No se pudo conectar con la extensión: ${e.message}. Asegúrate de que tu extensión (Alby/Nos2x) esté desbloqueada.`);
        return;
    }

    if (/Android/i.test(navigator.userAgent)) {
        const root = window.location.origin + window.location.pathname;
        window.location.href = `nostrsigner:?type=get_public_key&callbackUrl=${encodeURIComponent(root)}`;
        return;
    }
    setAuthError('No se detectó ninguna extensión de Nostr. Instalá Alby o usá una URL de NWC/Bunker para continuar.');
}

export async function handleNwcLogin(): Promise<void> {
    try {
        setAuthError('');
        const input = document.getElementById('nwcInput') as HTMLInputElement;
        const url = input?.value || '';
        if (!url) throw new Error('Copiá y pegá una URL de NWC válida (empieza con nostr+walletconnect://)');

        const { info } = await getNwcInfo(url);
        const secret = new URL(url.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');

        if (secret) {
            const hasExistingNwc = await hasStoredNwc();
            const locked = isLocked();
            
            if (hasExistingNwc && !locked) {
                const pin = await showPinModal('verify');
                if (!pin) return;
                
                const decryptedNwc = await decryptNwc();
                if (decryptedNwc) {
                    authState.nwcUrl = decryptedNwc;
                } else {
                    authState.nwcUrl = url;
                    await encryptNwc(url, pin);
                }
            } else if (locked) {
                setAuthError('Tu NWC fue borrado por seguridad. Necesitás conectar uno nuevo.');
                authState.nwcUrl = url;
            } else {
                const pin = await showPinModal('create');
                if (!pin) return;
                
                authState.nwcUrl = url;
                await encryptNwc(url, pin);
            }
            
            const signer = new NDKPrivateKeySigner(secret);
            authState.signer = signer;
            authState.pubkey = (await signer.user()).pubkey;
        } else if (info.pubkey) {
            authState.pubkey = info.pubkey;
            authState.nwcUrl = url;
        }

        authState.nip05 = info.alias || null;
        if (authState.pubkey && authState.nip05) {
            setAlias(authState.pubkey, authState.nip05);
        }
        
        await finishLogin();
    } catch (e: any) {
        setAuthError(`Error al conectar NWC: ${e.message}. Verificá que el link sea correcto y que tu wallet esté activa.`);
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

        logRemote({ msg: 'Confirmado desde Amber', pubkey: confirmedPubkey });
        authState.pubkey = confirmedPubkey;
        authState.bunkerTarget = confirmedPubkey;
        await finishLogin();
    } catch (e: any) {
        logRemote({ msg: 'Fallo en Nostr Connect', err: e.message });
        qr.innerHTML = `<div class="qr-placeholder text-error">${e.message}</div>`;
    }
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
        await finishLogin();
    } catch (e: any) {
        logRemote({ msg: 'Fallo Bunker manual', err: e.message });
        setAuthError(`Error de conexión Bunker: ${e.message}. Verificá el handle o la URI y asegurate de autorizar la conexión en tu app.`);
    } finally {
        if (btn) { btn.textContent = 'Conectar Bunker manual'; btn.disabled = false; }
    }
}
