import NDK from '@nostr-dev-kit/ndk';

const ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol'
    ]
});

ndk.connect();
// @ts-ignore - Enable NIP-44 support to silence deprecation warnings
ndk.enableNip44 = true;

const aliasCache: Record<string, string> = {};
const pendingRequests = new Set<string>();

export function resolveName(pubkey: string): string {
    if (aliasCache[pubkey]) return aliasCache[pubkey];

    const fallback = `${pubkey.slice(0, 8)}…`;
    if (pendingRequests.has(pubkey)) return fallback;

    pendingRequests.add(pubkey);
    const user = ndk.getUser({ pubkey });
    user.fetchProfile().then(() => {
        if (user.profile?.nip05) {
            aliasCache[pubkey] = user.profile.nip05;
        } else {
            aliasCache[pubkey] = fallback;
        }
        pendingRequests.delete(pubkey);
    }).catch(() => {
        aliasCache[pubkey] = fallback;
        pendingRequests.delete(pubkey);
    });

    return fallback;
}

export function getAlias(pubkey: string): string | null {
    const name = aliasCache[pubkey];
    return (name && !name.includes('…')) ? name : null;
}

export default ndk;
