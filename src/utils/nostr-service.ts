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

    // 1. Check Neon (Truth source)
    fetch(`/api/identity/${pubkey}`).then(r => r.ok ? r.json() : { alias: null }).then(res => {
        if (res.alias) {
            aliasCache[pubkey] = res.alias;
            pendingRequests.delete(pubkey);
            if (typeof (window as any).updateUI === 'function') (window as any).updateUI();
        } else {
            // 2. Not in Neon? Resolve via NDK and save to Neon for next time
            ndk.getUser({ pubkey }).fetchProfile().then(profile => {
                const nip05 = (profile as any)?.nip05;
                if (nip05) setAlias(pubkey, nip05);
                pendingRequests.delete(pubkey);
            }).catch(() => {
                pendingRequests.delete(pubkey);
            });
        }
    }).catch(() => {
        pendingRequests.delete(pubkey);
    });

    return fallback;
}

export function setAlias(pubkey: string, name: string): void {
    if (!name || name.includes('…')) return;
    aliasCache[pubkey] = name;
    
    // Sync to Neon (Future truth)
    fetch('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, alias: name })
    }).catch(e => console.error('[NostrService] Sync alias to neon failed', e));

    if (typeof (window as any).updateUI === 'function') (window as any).updateUI();
}

export function getAlias(pubkey: string): string | null {
    const name = aliasCache[pubkey];
    return (name && !name.includes('…')) ? name : null;
}

export default ndk;
