/**
 * NIP-55: Amber (Android Signer)
 * Uses nostrsigner: deep links for signing and getting pubkey.
 * Amber does NOT have wallet payments — manual invoice only.
 */

import { logRemote } from '../auth/auth-state';

export const NIP55 = {
    name: 'nip55' as const,
    canPay: false,  // Amber is signer only, no wallet

    isAvailable(): boolean {
        return /Android/i.test(navigator.userAgent);
    },

    getPublicKey(): Promise<string> {
        return new Promise((resolve, reject) => {
            const root = window.location.origin + window.location.pathname;
            const callbackWithParam = root + '?result=';

            sessionStorage.setItem('login_pending', JSON.stringify({
                timestamp: Date.now(),
                callbackUrl: callbackWithParam
            }));

            logRemote({ msg: 'NIP55_GET_PUBLIC_KEY', callbackUrl: callbackWithParam });
            window.location.href = `nostrsigner:?type=get_public_key&callbackUrl=${encodeURIComponent(callbackWithParam)}&returnType=signature&compressionType=none`;

            // Never resolves — page redirects away
            // Resolution happens in checkExternalLogin() when page returns with ?result=
        });
    },

    async signEvent(event: any): Promise<any> {
        // For NIP-55 signing, we use deep links
        // The event gets signed by Amber and returned via callback
        // This is async and page-reloading, so it's handled differently
        return new Promise((resolve, reject) => {
            const root = window.location.origin + window.location.pathname;
            const callbackWithParam = root + '?result=&signature=&event=';

            const eventJson = JSON.stringify(event);
            sessionStorage.setItem('login_pending', JSON.stringify({
                timestamp: Date.now(),
                pendingSign: true
            }));

            window.location.href = `nostrsigner:?type=sign_event&event=${encodeURIComponent(eventJson)}&callbackUrl=${encodeURIComponent(callbackWithParam)}&returnType=signature&compressionType=none`;
        });
    }
};
