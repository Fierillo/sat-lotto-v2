import { NIP07 } from '../lib/nip07';
import { NWC, restoreSigner } from '../lib/nwc';
import { 
    hasStoredNwc, 
    isLocked, 
    createPin as cryptoCreatePin, 
    verifyPin, 
    encryptNwc, 
    decryptNwc, 
    clearNwcStorage, 
    getAttemptsLeft 
} from '../lib/crypto';
import ndk from '../lib/ndk';
import { createBunkerSession, BunkerSession } from '../lib/nip46';
import { NDKEvent, NDKPrivateKeySigner, NDKNip46Signer, NDKSigner } from '@nostr-dev-kit/ndk';
import type { Signer, NIP07Signer } from '../types/signer';

export interface VictoryStatus {
    winner_block: number;
    can_claim: boolean;
}

export interface AuthActions {
    setAuth: (payload: Partial<{
        pubkey: string | null;
        nip05: string | null;
        loginMethod: string | null;
        nwcUrl: string | null;
        bunkerTarget: string | null;
        bunkerSession: string | null;
        signer?: Signer;
    }>) => void;
    clearAuth: () => void;
    openPinModal: (payload: { mode: 'create' | 'verify'; nwcUrl?: string }) => void;
    closePinModal: () => void;
    setPinError: (payload: { error: string | null; attemptsLeft: number }) => void;
    setError: (error: string | null) => void;
    pinModalUrl: string | null;
    bunkerSession: string | null;
}

const fetchAndSaveProfile = async (pubkey: string, signer?: Signer | null): Promise<string | null> => {
    try {
        const user = ndk.getUser({ pubkey });
        const profile = await user.fetchProfile();

        const nip05 = profile?.nip05 || profile?.name || profile?.displayName || null;
        const lud16 = profile?.lud16 || profile?.lud06 || null;

        if (nip05) localStorage.setItem('satlotto_alias', nip05);
        if (lud16) localStorage.setItem('satlotto_lud16', lud16);

        const unsignedEvent = {
            kind: 0,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify({
                name: profile?.name || null,
                display_name: profile?.displayName || null,
                nip05: profile?.nip05 || null,
                lud16: profile?.lud16 || null,
                lud06: profile?.lud06 || null,
                about: profile?.about || null,
                picture: profile?.picture || null,
            }),
            pubkey,
        };

        let signedEvent = null;

        if (signer && signer === window.nostr) {
            signedEvent = await NIP07.signEvent(unsignedEvent);
        } else if (signer) {
            const ev = new NDKEvent(ndk, unsignedEvent);
            const signPromise = ev.sign(signer as NDKSigner);
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout esperando firma')), 15000)
            );
            const sig = await Promise.race([signPromise, timeout]);
            ev.sig = sig;
            signedEvent = ev.rawEvent();
        }

        await fetch(`/api/identity/${pubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: signedEvent,
                lud16: lud16 || null,
                nip05: nip05 || null
            })
        });

        return nip05;
    } catch {
        return localStorage.getItem('satlotto_alias');
    }
};

export const loginWithExtension = async (actions: AuthActions): Promise<VictoryStatus | null> => {
    actions.setError(null);
    try {
        if (!NIP07.isAvailable()) {
            throw new Error('No se detectó ninguna extensión de Nostr. Instalá Alby o usá una URL de NWC/Bunker para continuar.');
        }
        const pubkey = await NIP07.getPublicKey();
        const signer = window.nostr as unknown as NIP07Signer;
        const nip05 = await fetchAndSaveProfile(pubkey, signer);
        actions.setAuth({
            pubkey,
            nip05,
            loginMethod: 'extension',
            signer,
        });
        return await getVictoryStatus(pubkey);
    } catch (e: any) {
        actions.setError(e.message);
        throw e;
    }
};

export const loginWithNwc = async (url: string, actions: AuthActions): Promise<void> => {
    actions.setError(null);
    
    if (!url.startsWith('nostr+walletconnect://')) {
        throw new Error('URL inválida. Debe empezar con nostr+walletconnect://');
    }

    try {
        const secret = new URL(url.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');
        if (!secret) {
            throw new Error('La URL no contiene la clave secreta (secret)');
        }
    } catch (e: any) {
        throw new Error('URL inválida: ' + e.message);
    }

    const hasStored = await hasStoredNwc();
    const locked = isLocked();

    if (hasStored && locked) {
        clearNwcStorage();
        actions.setError('Tu NWC fue borrado por seguridad. Conectá uno nuevo.');
        actions.openPinModal({ mode: 'create', nwcUrl: url });
        return;
    }

    if (hasStored && !locked) {
        actions.openPinModal({ mode: 'verify', nwcUrl: url });
    } else {
        actions.openPinModal({ mode: 'create', nwcUrl: url });
    }
};

export const verifyPinForNwc = async (
    pin: string, 
    actions: AuthActions
): Promise<VictoryStatus | null> => {
    const result = await verifyPin(pin);

    if (result.locked) {
        clearNwcStorage();
        actions.setPinError({ error: 'Demasiados intentos. Clave borrada por seguridad.', attemptsLeft: 0 });
        return null;
    }

    if (!result.success) {
        actions.setPinError({
            error: `PIN incorrecto. Quedan ${result.attemptsLeft} intentos.`,
            attemptsLeft: result.attemptsLeft
        });
        return null;
    }

    const nwcUrl = await decryptNwc(pin);
    if (!nwcUrl) {
        actions.setPinError({ error: 'Error al desencriptar.', attemptsLeft: result.attemptsLeft });
        return null;
    }

    try {
        const signer = restoreSigner(nwcUrl);
        if (!signer) {
            actions.setPinError({ error: 'No se pudo crear el signer.', attemptsLeft: result.attemptsLeft });
            return null;
        }
        const user = await signer.user();
        const nip05 = await fetchAndSaveProfile(user.pubkey, signer);
        
        actions.setAuth({
            nwcUrl,
            pubkey: user.pubkey,
            nip05,
            signer,
            loginMethod: 'nwc',
        });
        (window as any).__auth_nwcUrl = nwcUrl;
        return await getVictoryStatus(user.pubkey);
    } catch (e: any) {
        actions.setPinError({ error: 'Error al conectar: ' + e.message, attemptsLeft: result.attemptsLeft });
        return null;
    }
};

export const createPinForNwc = async (
    pin: string, 
    actions: AuthActions
): Promise<VictoryStatus | null> => {
    const nwcUrl = actions.pinModalUrl;
    if (!nwcUrl) {
        actions.setPinError({ error: 'URL de wallet no disponible.', attemptsLeft: 3 });
        return null;
    }

    try {
        await cryptoCreatePin(pin);
        await encryptNwc(nwcUrl, pin);

        const signer = restoreSigner(nwcUrl);
        if (!signer) {
            actions.setPinError({ error: 'No se pudo crear el signer.', attemptsLeft: 3 });
            return null;
        }
        const user = await signer.user();
        const nip05 = await fetchAndSaveProfile(user.pubkey, signer);
        
        actions.setAuth({
            nwcUrl,
            pubkey: user.pubkey,
            nip05,
            signer,
            loginMethod: 'nwc',
        });
        (window as any).__auth_nwcUrl = nwcUrl;
        actions.closePinModal();
        return await getVictoryStatus(user.pubkey);
    } catch (e: any) {
        actions.setPinError({ error: 'Error: ' + e.message, attemptsLeft: 3 });
        return null;
    }
};

export const loginWithBunker = async (
    url: string,
    signer: NDKPrivateKeySigner | NDKNip46Signer,
    secret: string,
    relays?: string[],
    skipHandshake?: boolean,
    actions?: AuthActions,
    existingSession?: BunkerSession
): Promise<VictoryStatus | null> => {
    if (!actions) {
        throw new Error('AuthActions required');
    }
    actions.setError(null);

    if (!url.startsWith('bunker://') && !url.includes('@')) {
        throw new Error('URL de bunker inválida. Debe empezar con bunker:// o ser un handle@domain');
    }

    try {
        let bunkerSigner: NDKNip46Signer;
        let sessionData: string | null = null;

        if (signer instanceof NDKNip46Signer) {
            bunkerSigner = signer;
            if (existingSession) {
                sessionData = JSON.stringify(existingSession);
            } else {
                sessionData = actions.bunkerSession;
            }
        } else {
            const result = await createBunkerSession(url, signer, secret, relays, skipHandshake);
            bunkerSigner = result.signer;
            sessionData = JSON.stringify(result.session);
        }

        const pubkey = (bunkerSigner as unknown as { remotePubkey: string }).remotePubkey;
        const nip05 = await fetchAndSaveProfile(pubkey, bunkerSigner);

        actions.setAuth({
            pubkey,
            nip05,
            bunkerTarget: url,
            bunkerSession: sessionData,
            signer: bunkerSigner,
            loginMethod: 'bunker',
        });
        return await getVictoryStatus(pubkey);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Error al conectar con bunker';
        actions.setError(message);
        throw e;
    }
};

export const getVictoryStatus = async (pubkey: string | null): Promise<VictoryStatus> => {
    if (!pubkey) {
        return { winner_block: 0, can_claim: false };
    }
    try {
        const res = await fetch(`/api/identity/${pubkey}`);
        const data = await res.json();
        return {
            winner_block: data.winner_block || 0,
            can_claim: data.can_claim || false,
        };
    } catch {
        return { winner_block: 0, can_claim: false };
    }
};

export const clearVictoryStatus = async (pubkey: string | null): Promise<void> => {
    if (!pubkey) return;
    try {
        await fetch(`/api/identity/${pubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ can_claim: false })
        });
    } catch (e) {
        console.error('[clearVictoryStatus] Error:', e);
    }
};

export const checkStoredNwc = async (): Promise<boolean> => {
    const hasStored = await hasStoredNwc();
    if (hasStored && isLocked()) {
        clearNwcStorage();
    }
    return hasStored && !isLocked();
};
