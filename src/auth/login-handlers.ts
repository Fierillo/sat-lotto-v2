import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { setAlias } from '../utils/nostr-service';
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

export function askPinInModal(mode: 'create' | 'verify'): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = document.getElementById('loginModal');
        if (!modal) return resolve(null);

        const mainView = modal.querySelector('#login-main-view') as HTMLElement;
        const pinView = modal.querySelector('#pin-view') as HTMLElement;
        const pinTitle = modal.querySelector('#pinTitle') as HTMLElement;
        const pinDesc = modal.querySelector('#pinDesc') as HTMLElement;
        const pinError = modal.querySelector('#pinError') as HTMLElement;
        const digits = modal.querySelectorAll('.pin-digit') as NodeListOf<HTMLInputElement>;
        const confirmBtn = modal.querySelector('#confirmPinInModal') as HTMLButtonElement;
        const backBtn = modal.querySelector('#backToLogin') as HTMLButtonElement;

        if (!mainView || !pinView) return resolve(null);

        mainView.style.display = 'none';
        pinView.style.display = 'block';
        pinError.textContent = '';
        digits.forEach(d => {
            d.value = '';
            d.disabled = false;
        });
        confirmBtn.disabled = false;
        setTimeout(() => digits[0].focus(), 50); // Ensure it's visible before focusing

        if (mode === 'create') {
            pinTitle.textContent = 'Creá tu PIN';
            pinDesc.textContent = 'Este PIN de 4 dígitos protege tu wallet. Guardalo bien.';
            confirmBtn.textContent = 'Crear PIN';
        } else {
            pinTitle.textContent = 'Ingresá tu PIN';
            pinDesc.textContent = 'Ingresá el PIN de 4 dígitos para desbloquear tu wallet.';
            confirmBtn.textContent = 'Desbloquear';
        }

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            backBtn.removeEventListener('click', handleBack);
            document.removeEventListener('keydown', handleKeydown);
        };

        const handleConfirm = async () => {
            const pin = Array.from(digits).map(d => d.value).join('');
            if (pin.length !== 4 || !/^\d+$/.test(pin)) {
                pinError.textContent = 'Ingresá los 4 dígitos';
                return;
            }

            if (mode === 'create') {
                try {
                    await createPin(pin);
                    cleanup();
                    resolve(pin);
                } catch (e: any) {
                    pinError.textContent = e.message;
                }
            } else {
                const result = await verifyPin(pin);
                if (result.locked) {
                    cleanup();
                    pinError.textContent = 'Demasiados intentos. Tu wallet fue borrada del dispositivo por seguridad. Tocá "Volver" para conectar una nueva.';
                    confirmBtn.disabled = true;
                    digits.forEach(d => d.disabled = true);
                    return;
                }
                if (!result.success) {
                    pinError.textContent = `PIN incorrecto. Quedan ${result.attemptsLeft} intentos.`;
                    digits.forEach(d => d.value = '');
                    digits[0].focus();
                    return;
                }
                cleanup();
                resolve(pin);
            }
        };

        const handleBack = () => {
            cleanup();
            pinView.style.display = 'none';
            mainView.style.display = 'block';
            resolve(null);
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') handleBack();
        };

        confirmBtn.addEventListener('click', handleConfirm);
        backBtn.addEventListener('click', handleBack);
        document.addEventListener('keydown', handleKeydown);
    });
}

export async function handleAutoLogin(): Promise<void> {
    setAuthError('');
    
    // Respetar login guardado — si el usuario eligió NWC, no sobreescribir con extensión
    const savedMethod = localStorage.getItem('satlotto_login_method');
    
    if (savedMethod === 'nwc') {
        try {
            await handleNwcLoginAutoPin();
            if (authState.pubkey) return; // Login exitoso
        } catch (e: any) {
            console.warn('[AutoLogin] NWC auto-login failed:', e.message);
        }
    }
    
    try {
        if ((window as any).nostr) {
            const signer = new NDKNip07Signer();
            await signer.blockUntilReady();
            const user = await signer.user();
            authState.pubkey = user.pubkey;
            authState.signer = signer;
            authState.loginMethod = 'extension';
            localStorage.setItem('satlotto_login_method', 'extension');
            await finishLogin();
            return;
        }
    } catch (e: any) {
        setAuthError(`No se pudo conectar con la extensión: ${e.message}. Asegúrate de que tu extensión (Alby/Nos2x) esté desbloqueada.`);
        return;
    }

    if (/Android/i.test(navigator.userAgent)) {
        const root = window.location.origin + window.location.pathname;
        const callbackWithParam = root + '?result=';
        
        sessionStorage.setItem('login_pending', JSON.stringify({
            timestamp: Date.now(),
            callbackUrl: callbackWithParam
        }));
        
        logRemote({ msg: 'REDIRECT_TO_AMBER', callbackUrl: callbackWithParam });
        window.location.href = `nostrsigner:?type=get_public_key&callbackUrl=${encodeURIComponent(callbackWithParam)}&returnType=signature&compressionType=none`;
        return;
    }
    setAuthError('No se detectó ninguna extensión de Nostr. Instalá Alby o usá una URL de NWC/Bunker para continuar.');
}

export async function handleNwcLogin(): Promise<void> {
    const btn = document.getElementById('nwcBtn') as HTMLButtonElement;
    const input = document.getElementById('nwcInput') as HTMLInputElement;
    const originalBtnText = btn?.textContent || 'Conectar Wallet';

    try {
        setAuthError('');
        const url = (input?.value || '').trim();
        if (!url || !url.startsWith('nostr+walletconnect://')) {
            throw new Error('URL inválida. Debe empezar con nostr+walletconnect://');
        }

        if (btn) {
            btn.textContent = 'Verificando Wallet...';
            btn.disabled = true;
        }

        // 1. Extraer el secret manualmente
        const secret = new URL(url.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');
        if (!secret) throw new Error('La URL no contiene la clave secreta (secret)');

        // 2. Manejo de PIN y Persistencia
        const hasExistingNwc = await hasStoredNwc();
        const locked = isLocked();
        
        if (hasExistingNwc && !locked) {
            const pin = await askPinInModal('verify');
            if (!pin) return;
            
            const decryptedNwc = await decryptNwc(pin);
            if (!decryptedNwc) {
                throw new Error('Error al desencriptar la wallet. Intentá nuevamente.');
            }
            authState.nwcUrl = decryptedNwc;
        } else if (locked) {
            setAuthError('Tu NWC fue borrado por seguridad. Necesitás conectar uno nuevo.');
            const pin = await askPinInModal('create');
            if (!pin) return;
            authState.nwcUrl = url;
            await encryptNwc(url, pin);
        } else {
            const pin = await askPinInModal('create');
            if (!pin) return;
            
            authState.nwcUrl = url;
            await encryptNwc(url, pin);
        }
        
        // 3. Inicializar el Signer y el estado de la sesión
        const signer = new NDKPrivateKeySigner(secret);
        authState.signer = signer;
        const user = await signer.user();
        authState.pubkey = user.pubkey;
        authState.loginMethod = 'nwc';
        localStorage.setItem('satlotto_login_method', 'nwc');

        // Intentar obtener el alias vía NDK
        try {
            const profile = await user.fetchProfile();
            authState.nip05 = profile?.nip05 || null;
            if (authState.pubkey && authState.nip05) {
                setAlias(authState.pubkey, authState.nip05);
            }
        } catch (e) {
            console.log('[NWC Login] No se pudo obtener el perfil de Nostr');
        }
        
        await finishLogin();
    } catch (e: any) {
        console.error('[NWC Login] Failed:', e);
        setAuthError(`Error: ${e.message}`);
    } finally {
        if (btn) {
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
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
        const errDiv = document.createElement('div');
        errDiv.className = 'qr-placeholder text-error';
        errDiv.textContent = e.message;
        qr.innerHTML = '';
        qr.appendChild(errDiv);
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

export async function handleNwcLoginAutoPin(): Promise<void> {
    try {
        const pin = await askPinInModal('verify');
        if (!pin) return;
        
        const decryptedNwc = await decryptNwc(pin);
        if (!decryptedNwc) {
            throw new Error('Error al desencriptar la wallet. Intentá nuevamente.');
        }
        
        authState.nwcUrl = decryptedNwc;
        const secret = new URL(decryptedNwc.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');
        if (!secret) throw new Error('Wallet guardada inválida.');

        const signer = new NDKPrivateKeySigner(secret);
        authState.signer = signer;
        const user = await signer.user();
        authState.pubkey = user.pubkey;

        try {
            const profile = await user.fetchProfile();
            authState.nip05 = profile?.nip05 || null;
            if (authState.pubkey && authState.nip05) {
                setAlias(authState.pubkey, authState.nip05);
            }
        } catch (e) {}

        await finishLogin();
    } catch (e: any) {
        console.error('[NWC Auto-Login] Failed:', e);
        setAuthError(`Error: ${e.message}`);
    }
}
