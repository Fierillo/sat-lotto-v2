import { authState } from '../components/auth';
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { neon } from '@neondatabase/serverless';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];

const casinoSigner = import.meta.env.VITE_APP_NOSTR_PRIVKEY
    ? new NDKPrivateKeySigner(import.meta.env.VITE_APP_NOSTR_PRIVKEY)
    : NDKPrivateKeySigner.generate();

const casinoNdk = new NDK({
    explicitRelayUrls: DEFAULT_RELAYS,
    signer: casinoSigner
});
casinoNdk.connect();

export async function saveBet(targetBlock: number, selectedNumber: number): Promise<void> {
    if (!authState.pubkey) return;

    const dbUrl = import.meta.env.VITE_NEON_URL;
    if (dbUrl) {
        try {
            const sql = neon(dbUrl);
            await sql`
                CREATE TABLE IF NOT EXISTS lotto_bets (
                    id SERIAL PRIMARY KEY,
                    pubkey VARCHAR(64) NOT NULL,
                    target_block INT NOT NULL,
                    selected_number INT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `;
            await sql`
                INSERT INTO lotto_bets (pubkey, target_block, selected_number)
                VALUES (${authState.pubkey}, ${targetBlock}, ${selectedNumber})
            `;
        } catch (e: any) {
            console.error('Error Neon DB:', e.message);
        }
    }

    try {
        const event = new NDKEvent(casinoNdk);
        event.kind = 1;
        event.content = JSON.stringify({
            juego: "SatLotto",
            bloque: targetBlock,
            numero: selectedNumber
        });
        event.tags = [
            ['e', 'satlotto_bet_v1'],
            ['p', authState.pubkey]
        ];

        await event.sign();
        await event.publish();
    } catch (e: any) {
        console.error('Error Nostr Cast:', e.message);
    }
}
