import ndk from './ndk';

const ALIAS_PREFIX = 'satlotto_alias_';

export async function resolveAlias(pubkey: string): Promise<string | null> {
    // 1. Try NDK first
    try {
        const user = ndk.getUser({ pubkey });
        const profile = await user.fetchProfile();
        const alias = profile?.nip05 || profile?.name || profile?.displayName;

        if (alias) {
            // Persist to localStorage
            localStorage.setItem(`${ALIAS_PREFIX}${pubkey}`, alias);
            return alias;
        }
    } catch {
        // NDK failed, use fallback
    }

    // 2. Fallback to localStorage
    return localStorage.getItem(`${ALIAS_PREFIX}${pubkey}`);
}
