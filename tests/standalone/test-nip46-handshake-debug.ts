import NDK, { NDKPrivateKeySigner, NDKNip46Signer, NDKEvent } from '@nostr-dev-kit/ndk';
import 'dotenv/config';

async function debugBunker() {
    console.log('🚀 [CIRCUITO] Iniciando Debug de Nostr Connect (Estrategia Primal)...');
    
    const bunkerRelays = [
        'wss://relay.nsec.app',
        'wss://relay.damus.io',
        'wss://relay.primal.net',
        'wss://nos.lol'
    ];

    const ndk = new NDK({ explicitRelayUrls: bunkerRelays });
    console.log('📡 [RED] Intentando conectar a relays...');
    await ndk.connect(3000).catch(() => console.log('⚠️ [RED] Algunos relays fallaron, continuando...'));
    console.log('✅ [RED] NDK listo');

    const localSigner = NDKPrivateKeySigner.generate();
    const localUser = await localSigner.user();
    const pubkey = localUser.pubkey;
    console.log(`🔑 [AUTH] Pubkey App (Local): ${pubkey}`);

    const bunkerSigner = new NDKNip46Signer(ndk, "", localSigner);
    const secret = Math.random().toString(36).substring(7);
    (bunkerSigner as any).token = secret;
    
    const localPrivateKey = (localSigner as any)._privateKey;
    const name = 'SatLotto-Circuit-Debug';
    const url = 'http://localhost:5173';
    
    let connectUri = `nostrconnect://${pubkey}?`;
    bunkerRelays.forEach(r => connectUri += `relay=${encodeURIComponent(r)}&`);
    connectUri += `secret=${encodeURIComponent(secret)}&name=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`;

    console.log('\n--------------------------------------------------');
    console.log('📱 ESCANEÁ ESTA URI CON AMBER:');
    console.log(connectUri);
    console.log(`\nGenerador de QR: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(connectUri)}`);
    console.log('--------------------------------------------------\n');

    console.log('📡 [MONITOR] Escuchando tráfico NIP-46...');

    let amberPubkey: string | null = null;
    let resolveHandshake: (pk: string) => void;
    const handshakePromise = new Promise<string>((resolve) => {
        resolveHandshake = resolve;
    });

    ndk.subscribe({
        kinds: [24133 as any],
        "#p": [pubkey]
    }, { closeOnEose: false }).on('event', async (ev: NDKEvent) => {
        try {
            const { nip04, nip44 } = await import('nostr-tools');
            const privKeyBytes = typeof localPrivateKey === 'string' 
                ? new Uint8Array(localPrivateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
                : localPrivateKey;

            let decrypted: string;
            if (ev.content.includes('?iv=')) {
                decrypted = await nip04.decrypt(privKeyBytes, ev.pubkey, ev.content);
            } else {
                const conversationKey = nip44.v2.utils.getConversationKey(privKeyBytes, ev.pubkey);
                decrypted = nip44.v2.decrypt(ev.content, conversationKey);
            }

            const data = JSON.parse(decrypted);
            console.log(`\n📬 [EVENTO] de ${ev.pubkey.slice(0,8)}...`);
            console.log(`📝 JSON: ${decrypted}`);

            if (data.result === secret) {
                console.log('🎯 [MANUAL] ¡Handshake detectado! El secreto coincide.');
                amberPubkey = ev.pubkey;
                resolveHandshake(ev.pubkey);
            }
        } catch (e: any) {
            console.log(`❌ [ERROR] Error al procesar evento: ${e.message}`);
        }
    });

    try {
        console.log('⏳ [WAIT] Esperando que Amber responda con el secreto (60s)...');
        
        const confirmedPubkey = await Promise.race([
            handshakePromise,
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout (60s)')), 60000))
        ]);

        console.log(`\n🎉 [EXITO] ¡CONEXIÓN MANUAL DETECTADA!`);
        console.log(`👤 [USUARIO] Amber Pubkey: ${confirmedPubkey}`);

        (bunkerSigner as any).remotePubkey = confirmedPubkey;
        
        console.log('🔍 [INFO] Intentando obtener perfil del usuario remoto...');
        const remoteUser = ndk.getUser({ pubkey: confirmedPubkey });
        const profile = await remoteUser.fetchProfile();
        console.log(`✅ [PERFIL] Nombre: ${profile?.name || 'No definido'} | NIP-05: ${profile?.nip05 || 'No definido'}`);

        console.log('\n🚀 [FINAL] Ahora el BunkerSigner está listo para firmar eventos.');
        
    } catch (e: any) {
        console.error(`\n🚫 [FALLO] No se pudo completar el handshake: ${e.message}`);
    }
}

debugBunker();
