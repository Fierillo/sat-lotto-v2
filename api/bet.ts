import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { verifyEvent } from 'nostr-tools';
import { nwc } from '@getalby/sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { signedEvent } = req.body;
    if (!signedEvent) return res.status(400).json({ error: 'Falta el evento firmado' });

    const isValid = verifyEvent(signedEvent);
    if (!isValid) return res.status(403).json({ error: 'Firma del evento inválida' });

    let bet: { bloque: number; numero: number };
    try {
        bet = JSON.parse(signedEvent.content);
    } catch {
        return res.status(400).json({ error: 'Contenido del evento inválido' });
    }

    if (!bet.bloque || !bet.numero) return res.status(400).json({ error: 'Faltan campos bloque o numero' });

    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return res.status(500).json({ error: 'NWC no configurado en el servidor' });

    try {
        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
        const invoice = await client.makeInvoice({
            amount: 21000,
            description: `SatLotto - Bloque ${bet.bloque} - Num ${bet.numero}`
        });
        const pr = (invoice as any).paymentRequest || (invoice as any).invoice;

        const sql = neon(process.env.NEON_URL!);
        await sql`
            CREATE TABLE IF NOT EXISTS lotto_bets (
                id SERIAL PRIMARY KEY,
                pubkey VARCHAR(64) NOT NULL,
                target_block INT NOT NULL,
                selected_number INT NOT NULL,
                payment_request TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;
        await sql`
            INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request)
            VALUES (${signedEvent.pubkey}, ${bet.bloque}, ${bet.numero}, ${pr})
        `;

        return res.json({ paymentRequest: pr });
    } catch (e: any) {
        return res.status(500).json({ error: `Error generando invoice: ${e.message}` });
    }
}
