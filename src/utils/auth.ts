import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk, { resolveName, setAlias } from './nostr-service';
import { fetchIdentity } from './game';
import { NIP07 } from '../lib/nip07';

// ─── Auth State ──────────────────────────────────────────────────────

export const authState = {
    pubkey: null as string | null,
    signer: null as any | null,
    nwcUrl: null as string | null,
    bunkerTarget: null as string | null,
    localPrivkey: null as string | null,
    nip05: null as string | null,
    loginEvent: null as any | null,
    lastCelebratedBlock: 0,
    loginMethod: null as string | null,
};

export function initAuthState(): void {
    if (typeof window === 'undefined') return;
    authState.pubkey = localStorage.getItem('satlotto_pubkey');
    authState.bunkerTarget = localStorage.getItem('satlotto_bunker');
    authState.localPrivkey = localStorage.getItem('satlotto_local_privkey');
    authState.nip05 = localStorage.getItem('satlotto_alias');
    authState.loginMethod = localStorage.getItem('satlotto_login_method');
    authState.lastCelebratedBlock = parseInt(localStorage.getItem('satlotto_last_victory_block') || '0');
}

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

// ─── Logout ─────────────────────────────────────────────────────────

export function logout(): void {
    ['satlotto_pubkey', 'satlotto_login_method', 'satlotto_bunker', 'satlotto_alias',
     'satlotto_amber', 'satlotto_nwc', 'satlotto_extension'].forEach(k => localStorage.removeItem(k));

    if (typeof window !== 'undefined') window.location.reload();
}

// ─── Finish Login ────────────────────────────────────────────────────

export async function finishLogin(): Promise<void> {
    if (!authState.pubkey) return;
    localStorage.setItem('satlotto_pubkey', authState.pubkey);
    if (authState.bunkerTarget) localStorage.setItem('satlotto_bunker', authState.bunkerTarget);
    if (authState.nwcUrl) localStorage.setItem('satlotto_nwc', authState.nwcUrl);

    if (!authState.signer) {
        if (authState.bunkerTarget) {
            const signer = new NDKNip46Signer(ndk, authState.bunkerTarget, getOrCreateLocalSigner());
            (signer as any).ndk = ndk;
            authState.signer = signer;
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
}
