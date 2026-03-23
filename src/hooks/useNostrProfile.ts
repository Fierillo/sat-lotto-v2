'use client';

import { useState, useEffect, useCallback } from 'react';
import ndk from '../lib/ndk';

const ALIAS_KEY = 'satlotto_alias';
const LUD16_KEY = 'satlotto_lud16';

export function useNostrProfile(pubkey: string | null) {
    const [alias, setAlias] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(ALIAS_KEY);
    });
    const [lud16, setLud16] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(LUD16_KEY);
    });
    const [isLoading, setIsLoading] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!pubkey) return;

        setIsLoading(true);

        try {
            const user = ndk.getUser({ pubkey });
            const profile = await user.fetchProfile();

            const fetchedAlias = profile?.nip05 || profile?.name || profile?.displayName || null;
            const fetchedLud16 = profile?.lud16 || profile?.lud06 || profile?.nip05 || null;

            if (fetchedAlias) {
                localStorage.setItem(ALIAS_KEY, fetchedAlias);
                setAlias(fetchedAlias);
            }

            if (fetchedLud16) {
                localStorage.setItem(LUD16_KEY, fetchedLud16);
                setLud16(fetchedLud16);
            }

            const finalLud16 = fetchedLud16 || fetchedAlias;
            if (finalLud16) {
                await fetch(`/api/identity/${pubkey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lud16: finalLud16 })
                });
            }
        } catch (e) {
            console.error('[useNostrProfile] Error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [pubkey]);

    useEffect(() => {
        if (pubkey) {
            fetchProfile();
        }
    }, [pubkey, fetchProfile]);

    return { alias, lud16, isLoading, refetch: fetchProfile };
}