/**
 * NIP-55: Mobile Signer (Amber, etc.)
 * Uses nostrsigner: deep links for signing and getting pubkey.
 * Mobile signers do NOT have wallet payments — manual invoice only.
 */

import type { UnsignedEvent } from '../types';

export const NIP55 = {
    name: 'nip55' as const,
    canPay: false,

    isAvailable(): boolean {
        return /Android/i.test(navigator.userAgent);
    },

    getPublicKey(callbackUrl: string): string {
        return `nostrsigner:?type=get_public_key&callbackUrl=${encodeURIComponent(callbackUrl)}&returnType=signature&compressionType=none`;
    },

    signEvent(event: UnsignedEvent, callbackUrl: string): string {
        const eventJson = JSON.stringify(event);
        return `nostrsigner:?type=sign_event&event=${encodeURIComponent(eventJson)}&callbackUrl=${encodeURIComponent(callbackUrl)}&returnType=signature&compressionType=none`;
    }
};
