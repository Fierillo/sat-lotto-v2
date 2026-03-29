import 'dotenv/config';
import NDK, { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';
import { nip04 } from 'nostr-tools';

const USER_PUBKEY = '3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9';

async function testBot() {
    const privkey = process.env.NOSTR_PRIVKEY;
    if (!privkey) {
        console.error('❌ Error: NOSTR_PRIVKEY no encontrada en .env');
        return;
    }

    const ndk = new NDK({
        explicitRelayUrls: ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol']
    });
    ndk.signer = new NDKPrivateKeySigner(privkey);
    
    console.log('🚀 Conectando a Nostr...');
    await ndk.connect(5000);
    const botUser = await ndk.signer.user();
    console.log(`🤖 Bot iniciado (Pubkey: ${botUser.pubkey})`);

    console.log(`✉️ Enviando DM de prueba a Fierillo (${USER_PUBKEY})...`);
    const dm = new NDKEvent(ndk);
    dm.kind = 4;
    dm.tags = [['p', USER_PUBKEY]];
    dm.content = await nip04.encrypt(privkey, USER_PUBKEY, '¡Hola Fierillo! Soy el bot de SatLotto. Pasame una Lightning Address para testear si te escucho bien. ⚡ (Enviado a las ' + new Date().toLocaleTimeString() + ')');
    await dm.publish();
    console.log('✅ DM enviado. ID:', dm.id);

    console.log('👂 Escuchando cualquier evento Kind 4 dirigido al bot...');
    const sub = ndk.subscribe({
        kinds: [4],
        '#p': [botUser.pubkey]
    });

    sub.on('event', async (event: NDKEvent) => {
        console.log(`👁️ Vi un evento Kind 4 de ${event.pubkey}`);
        if (event.pubkey === USER_PUBKEY) {
            try {
                const decryptedContent = await nip04.decrypt(privkey, event.pubkey, event.content);
                console.log(`📩 Mensaje recibido de Fierillo: "${decryptedContent}"`);

                const lnAddressMatch = decryptedContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (lnAddressMatch) {
                    console.log(`✨ ¡ÉXITO! Capturé la dirección: ${lnAddressMatch[0]}`);
                    
                    const reply = new NDKEvent(ndk);
                    reply.kind = 4;
                    reply.tags = [['p', USER_PUBKEY]];
                    reply.content = await nip04.encrypt(privkey, USER_PUBKEY, `¡Perfecto! Entendí que tu dirección es ${lnAddressMatch[0]}. El test fue un éxito. 🏆`);
                    await reply.publish();
                    console.log('✅ Confirmación enviada al usuario.');
                } else {
                    console.log('🤔 Recibí un mensaje pero no parece tener una Lightning Address válida.');
                }
            } catch (e) {
                console.error('❌ Error al procesar el mensaje:', e);
            }
        }
    });

    setTimeout(() => {
        console.log('⏲️ Tiempo de test finalizado. Cerrando...');
        process.exit(0);
    }, 120000);
}

testBot();
