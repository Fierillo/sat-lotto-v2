import NDK from '@nostr-dev-kit/ndk';

const ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol'
    ]
});

ndk.connect();

const nameCache: Record<string, string> = {};
const pendingRequests = new Set<string>();

export function resolveName(pubkey: string, callback?: () => void): string {
    if (nameCache[pubkey]) return nameCache[pubkey];
    if (pendingRequests.has(pubkey)) return `${pubkey.slice(0, 8)}…`;

    pendingRequests.add(pubkey);
    const user = ndk.getUser({ pubkey });
    user.fetchProfile().then(() => {
        nameCache[pubkey] = user.profile?.nip05 || `${pubkey.slice(0, 8)}…`;
        pendingRequests.delete(pubkey);
        if (callback) callback();
    }).catch(() => {
        nameCache[pubkey] = `${pubkey.slice(0, 8)}…`;
        pendingRequests.delete(pubkey);
    });

    return `${pubkey.slice(0, 8)}…`;
}

export default ndk;
