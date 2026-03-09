import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk from '../utils/nostr-service';
import { getNwcInfo } from '../utils/nwc-connect';
import { authState, logRemote } from './auth-state';
import { getOrCreateLocalSigner } from './auth-utils';
import { finishLogin } from './auth-manager';

export function setAuthError(msg: string): void {
    const errorDisplay = document.getElementById('authError');
    if (errorDisplay) errorDisplay.textContent = msg;
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
            const signer = new NDKPrivateKeySigner(secret);
            authState.signer = signer;
            authState.pubkey = (await signer.user()).pubkey;
        } else if (info.pubkey) {
            authState.pubkey = info.pubkey;
        }

        authState.nip05 = info.alias || null;
        authState.nwcUrl = url;
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
