import NDK, { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';
import { nip04 } from 'nostr-tools';
import { withSuppressedWarnings } from './nwc';

const nostrEnabled = process.env.NOSTR_ENABLED === 'true';
const botPrivkey = process.env.NOSTR_PRIVKEY;

export const botNdk = new NDK({
    explicitRelayUrls: ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']
});

if (botPrivkey) {
    botNdk.signer = new NDKPrivateKeySigner(botPrivkey);
}

let ndkConnected = false;

export async function ensureNdkConnected(): Promise<boolean> {
    if (!ndkConnected && nostrEnabled) {
        try {
            await botNdk.connect(5000);
            ndkConnected = true;
            return true;
        } catch {
            console.error('[Nostr] Connection failed');
            return false;
        }
    }
    return ndkConnected;
}

export async function sendDM(pubkey: string, message: string): Promise<void> {
    if (!nostrEnabled || !botPrivkey) return;
    try {
        await ensureNdkConnected();
        await withSuppressedWarnings(async () => {
            const dm = new NDKEvent(botNdk);
            dm.kind = 4;
            dm.tags = [['p', pubkey]];
            dm.content = await nip04.encrypt(botPrivkey, pubkey, message);
            await dm.publish();
        });
    } catch (e: any) {
        console.error(`[Nostr] DM to ${pubkey.slice(0, 8)}... failed:`, e.message?.slice(0, 30));
    }
}

export async function publishRoundResult(content: string): Promise<void> {
    if (!nostrEnabled || !botPrivkey) return;
    try {
        await ensureNdkConnected();
        const ev = new NDKEvent(botNdk);
        ev.kind = 1;
        ev.content = content;
        await ev.publish();
    } catch (e: any) {
        console.error('[Nostr] Round result publish failed:', e.message?.slice(0, 30));
    }
}

export function getBotPubkey(): string | null {
    if (!botPrivkey) return null;
    return botNdk.signer ? (botNdk.signer as any).pubkey : null;
}