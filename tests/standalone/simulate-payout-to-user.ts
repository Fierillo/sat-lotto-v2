import 'dotenv/config';
import { nwc } from '@getalby/sdk';
import NDK, { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';
import { nip04 } from 'nostr-tools';

const USER_PUBKEY = '3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9';
const LN_ADDRESS = 'fierillo@lawalletilla.vercel.app';
const TEST_SATS = 1;

async function getInvoiceFromLNAddress(address: string, amountSats: number): Promise<string | null> {
    try {
        const [user, domain] = address.split('@');
        const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
        const lnurlData = await lnurlRes.json();
        const callback = lnurlData.callback;
        const amountMsats = amountSats * 1000;
        const invRes = await fetch(`${callback}?amount=${amountMsats}`);
        const invData = await invRes.json();
        return invData.pr || invData.payment_request;
    } catch (e) {
        console.error(`[LNURL] Failed:`, e);
        return null;
    }
}

async function simulate() {
    console.log('🏗️ Iniciando SIMULACIÓN DE PAGO para Fierillo...');

    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) throw new Error('NWC_URL missing');
    const nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });

    const botPrivkey = process.env.NOSTR_PRIVKEY;
    if (!botPrivkey) throw new Error('NOSTR_PRIVKEY missing');
    const botNdk = new NDK({ explicitRelayUrls: ['wss://relay.primal.net', 'wss://nos.lol'] });
    botNdk.signer = new NDKPrivateKeySigner(botPrivkey);
    await botNdk.connect();
    const botUser = await botNdk.signer.user();

    console.log(`🤖 Bot listo (${botUser.pubkey})`);

    console.log(`🔍 Resolviendo Lightning Address: ${LN_ADDRESS}...`);
    const invoice = await getInvoiceFromLNAddress(LN_ADDRESS, TEST_SATS);
    if (!invoice) throw new Error('Could not get invoice');
    console.log(`✅ Invoice obtenida para ${TEST_SATS} sat.`);

    console.log('⚡ Pagando vía NWC...');
    try {
        const payRes = await nwcClient.payInvoice({ invoice });
        console.log('✅ ¡PAGO EXITOSO! Hash:', (payRes as any).preimage || 'confirmed');
    } catch (e) {
        console.error('❌ Pago fallido:', e);
    }

    console.log('✉️ Enviando DM bilingüe...');
    const dm = new NDKEvent(botNdk);
    dm.kind = 4;
    dm.tags = [['p', USER_PUBKEY]];
    const msg = `¡Listo! 🇦🇷 Ya te envié tus ${TEST_SATS} sats de prueba a ${LN_ADDRESS}. ¡Gracias por jugar! ⚡\n\nDone! I've sent your ${TEST_SATS} test sats to ${LN_ADDRESS}. Thanks for playing! ⚡`;
    dm.content = await nip04.encrypt(botPrivkey, USER_PUBKEY, msg);
    await dm.publish();
    console.log('✅ DM enviado.');

    console.log('📢 Publicando anuncio global...');
    const ann = new NDKEvent(botNdk);
    ann.kind = 1;
    ann.content = `¡SIMULACIÓN! Ronda de prueba confirmada! 🏆\n\nGanador: Fierillo\nPremio: ${TEST_SATS} sat (test).\n\nSatLotto: Bitcoin + Nostr = 🧡`;
    await ann.publish();
    console.log('✅ Anuncio publicado.');

    console.log('🏁 Simulación terminada.');
    process.exit(0);
}

simulate();
