import ndk from './ndk';

const aliasCache: Record<string, string> = {};
const pendingRequests = new Set<string>();

export function resolveName(pubkey: string): string {
    if (aliasCache[pubkey]) return aliasCache[pubkey];

    if (typeof localStorage !== 'undefined' && localStorage.getItem('satlotto_pubkey') === pubkey) {
        const cached = localStorage.getItem('satlotto_alias');
        if (cached) {
            aliasCache[pubkey] = cached;
            return cached;
        }
    }

    const fallback = `${pubkey.slice(0, 8)}…`;
    if (pendingRequests.has(pubkey)) return fallback;
    if (pendingRequests.size > 5) return fallback;

    pendingRequests.add(pubkey);

    fetch(`/api/identity/${pubkey}`).then(r => r.ok ? r.json() : { alias: null }).then(res => {
        if (res.alias) {
            aliasCache[pubkey] = res.alias;
            pendingRequests.delete(pubkey);
            window.updateUI?.();
        } else {
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
    window.updateUI?.();
}

export function getAlias(pubkey: string): string | null {
    const name = aliasCache[pubkey];
    return (name && !name.includes('…')) ? name : null;
}
