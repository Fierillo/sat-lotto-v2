import 'dotenv/config';
import NDK, { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';

const USER_PUBKEY = '3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9'; 

async function testSend() {
    const privkey = process.env.NOSTR_PRIVKEY;
    if (!privkey) {
        console.error('❌ Error: NOSTR_PRIVKEY no encontrada');
        return;
    }

    const ndk = new NDK({
        explicitRelayUrls: [
            'wss://relay.primal.net', 
            'wss://relay.damus.io', 
            'wss://nos.lol', 
            'wss://relay.snort.social',
            'wss://purplepag.es'
        ]
    });
    ndk.signer = new NDKPrivateKeySigner(privkey);
    
    console.log('🚀 Conectando...');
    await ndk.connect(5000);
    const botUser = await ndk.signer.user();
    console.log(`🤖 Bot Pubkey: ${botUser.pubkey}`);

    console.log('📢 Enviando mención pública...');
    const note = new NDKEvent(ndk);
    note.kind = 1;
    note.content = `Test de conectividad para @${USER_PUBKEY.slice(0,8)}... SatLotto Bot reportándose. 🚀`;
    note.tags = [['p', USER_PUBKEY]];
    await note.publish();
    console.log('✅ Nota pública enviada. ID:', note.id);

    console.log('✉️ Enviando DM (Kind 4)...');
    const dm = new NDKEvent(ndk);
    dm.kind = 4;
    dm.tags = [['p', USER_PUBKEY]];
    
    try {
        console.log('🔐 Cifrando con NIP-04...');
        const botPrivkey = process.env.NOSTR_PRIVKEY!;
        const { nip04 } = await import('nostr-tools');
        
        const encryptedContent = await nip04.encrypt(botPrivkey, USER_PUBKEY, '¡Hola! Este mensaje usa cifrado NIP-04 directo. Si lo leés bien en Primal, es porque NDK estaba siendo creativo. 🔒');
        dm.content = encryptedContent;
        
        console.log('📤 Publicando DM...');
        await dm.publish();
        console.log('✅ Proceso de DM finalizado. ID:', dm.id);
    } catch (e) {
        console.error('❌ Error en cifrado/envío:', e);
    }

    setTimeout(() => process.exit(0), 10000);
}

testSend();
