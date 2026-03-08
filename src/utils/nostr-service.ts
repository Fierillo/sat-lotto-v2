import NDK from '@nostr-dev-kit/ndk';

const ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.primal.net',
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol',
        'wss://relay.nsec.app',
        'wss://nostr.oxtr.dev',
        'wss://purplepag.es',
        'wss://relay.mobile.net'
    ]
});

ndk.connect(5000).catch(e => console.error('[NDK] Connect initial failed', e));
(ndk as any).enableNip44 = true;

const aliasCache: Record<string, string> = {};
const pendingRequests = new Set<string>();

export function resolveName(pubkey: string): string {
    if (aliasCache[pubkey]) return aliasCache[pubkey];

    const fallback = `${pubkey.slice(0, 8)}…`;
    if (pendingRequests.has(pubkey)) return fallback;

    pendingRequests.add(pubkey);

    Promise.all([
        fetch(`/api/identity/${pubkey}`).then(r => r.ok ? r.json() : { alias: null }).catch(() => ({ alias: null })),
        ndk.getUser({ pubkey }).fetchProfile().then(() => ({ nip05: (ndk.getUser({ pubkey }) as any).profile?.nip05 })).catch(() => ({ nip05: null }))
    ]).then(([apiRes, ndkRes]) => {
        const name = apiRes.alias || ndkRes.nip05 || fallback;
        aliasCache[pubkey] = name;
        pendingRequests.delete(pubkey);

        if (typeof (window as any).updateUI === 'function') (window as any).updateUI();
    });

    return fallback;
}

export function getAlias(pubkey: string): string | null {
    const name = aliasCache[pubkey];
    return (name && !name.includes('…')) ? name : null;
}

export default ndk;
