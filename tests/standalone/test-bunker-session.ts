import { generateConnectUri, createBunkerSession, serializeSession, restoreBunkerSession, deserializeSession } from '../../src/lib/nip46';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const RESULT_FILE = path.join(process.cwd(), 'test-results', `bunker-test-${Date.now()}.json`);

const result: {
    timestamp: string;
    uri?: string;
    secret?: string;
    signerPubkey?: string;
    qrUrl?: string;
    remotePubkey?: string;
    session?: {
        bunkerTarget: string;
        localSignerPrivkey: string;
        remotePubkey: string;
    };
    restoredSession?: {
        bunkerTarget: string;
        localSignerPrivkey: string;
        remotePubkey: string;
    };
    signedEvent?: {
        id: string;
        sig: string;
        pubkey: string;
        kind: number;
        created_at: number;
        tags: string[][];
        content: string;
    };
    logs: string[];
    error?: string;
} = {
    timestamp: new Date().toISOString(),
    logs: []
};

const log = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `${timestamp} - ${msg}`;
    console.log(`[BunkerTest] ${logLine}`);
    result.logs.push(logLine);
};

const saveResult = () => {
    try {
        const logDir = path.dirname(RESULT_FILE);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
        console.log(`\n📄 Resultado guardado en: ${RESULT_FILE}`);
    } catch (e) {
        console.error('Failed to save result:', e);
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (question: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

async function runTest() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║        TEST INTERACTIVO DE BUNKER/AMBER                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    log('=== TEST INTERACTIVO DE BUNKER/AMBER ===');
    log(`Resultado guardado en: ${RESULT_FILE}`);

    try {
        console.log('PASO 1: Generando URI de conexión...\n');
        log('PASO 1: Generando URI de conexión...');

        const { uri, secret, signer, pubkey } = generateConnectUri();

        result.uri = uri;
        result.secret = secret;
        result.signerPubkey = pubkey;

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(uri)}&size=400x400`;
        result.qrUrl = qrUrl;

        console.log('═══════════════════════════════════════════════════════════');
        console.log('QR CODE (escaneá con Amber):');
        console.log(qrUrl);
        console.log('═══════════════════════════════════════════════════════════\n');

        log(`URI generada: ${uri}`);
        log(`Secret: ${secret}`);
        log(`Signer pubkey: ${pubkey}`);
        log(`QR URL: ${qrUrl}`);

        console.log('1. Abrí el link del QR en tu navegador');
        console.log('2. Escaneá el código QR con Amber');
        console.log('3. Esperá a que Amber se conecte');
        console.log('\n');

        await askQuestion('Cuando Amber se haya conectado, presionar ENTER para continuar...');

        log('Usuario indica que Amber se conectó');

        console.log('\nPASO 2: Creando sesión de bunker (esperando respuesta de Amber)...');
        log('PASO 2: Creando sesión de bunker...');

        const sessionResult = await createBunkerSession('bunker://', signer, secret);

        const bunkerSigner = sessionResult.signer;
        const remotePubkey = (bunkerSigner as any).remotePubkey;

        result.remotePubkey = remotePubkey;

        console.log(`\n✅ Bunker signer creado!`);
        console.log(`Remote pubkey: ${remotePubkey}`);
        log(`Bunker signer creado. Remote pubkey: ${remotePubkey}`);

        const session = sessionResult.session;
        result.session = {
            bunkerTarget: session.bunkerTarget,
            localSignerPrivkey: session.localSignerPrivkey,
            remotePubkey: session.remotePubkey
        };

        log(`Session localSignerPrivkey: ${session.localSignerPrivkey.substring(0, 30)}...`);
        log(`Session remotePubkey: ${session.remotePubkey}`);
        log(`Session bunkerTarget: ${session.bunkerTarget}`);

        console.log('\nPASO 3: Simulando recarga de página...');
        log('PASO 3: Simulando recarga de página...');

        const serialized = serializeSession(session);
        const restoredSession = deserializeSession(serialized);

        result.restoredSession = {
            bunkerTarget: restoredSession.bunkerTarget,
            localSignerPrivkey: restoredSession.localSignerPrivkey,
            remotePubkey: restoredSession.remotePubkey
        };

        log(`Session restaurado:`);
        log(`  - bunkerTarget: ${restoredSession.bunkerTarget}`);
        log(`  - localSignerPrivkey: ${restoredSession.localSignerPrivkey.substring(0, 30)}...`);
        log(`  - remotePubkey: ${restoredSession.remotePubkey}`);

        console.log('\nPASO 4: Restaurando bunker signer desde session...');
        log('PASO 4: Restaurando bunker signer desde session...');

        const restoredSigner = restoreBunkerSession(restoredSession);
        const restoredRemotePubkey = (restoredSigner as any).remotePubkey;

        console.log(`✅ Bunker signer restaurado!`);
        console.log(`Remote pubkey: ${restoredRemotePubkey}`);
        log(`Bunker signer restaurado. Remote pubkey: ${restoredRemotePubkey}`);

        console.log('\nPASO 5: Firmando evento localmente...');
        log('PASO 5: Firmando evento localmente...');

        const { finalizeEvent } = await import('nostr-tools');

        const unsignedEvent = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: 870000, numero: 9 }),
            pubkey: restoredSession.remotePubkey,
        };

        log(`Evento a firmar: ${JSON.stringify(unsignedEvent)}`);

        const privKeyBytes = Uint8Array.from(
            restoredSession.localSignerPrivkey.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
        );

        const signed = finalizeEvent(unsignedEvent, privKeyBytes);

        result.signedEvent = {
            id: signed.id,
            sig: signed.sig,
            pubkey: signed.pubkey,
            kind: signed.kind,
            created_at: signed.created_at,
            tags: signed.tags as string[][],
            content: signed.content
        };

        console.log(`\n✅ EVENTO FIRMADO!`);
        console.log(`id: ${signed.id}`);
        console.log(`sig: ${signed.sig.substring(0, 30)}...`);
        console.log(`pubkey: ${signed.pubkey}`);
        log(`Evento firmado:`);
        log(`  - id: ${signed.id}`);
        log(`  - sig: ${signed.sig}`);
        log(`  - pubkey: ${signed.pubkey}`);

        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║  ✅ TEST COMPLETADO EXITOSAMENTE!                     ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        log('=== TEST COMPLETADO EXITOSAMENTE ===');

    } catch (e: any) {
        console.error(`\n❌ ERROR: ${e.message}`);
        log(`ERROR: ${e.message}`);
        log(`Stack: ${e.stack}`);
        result.error = e.message;
        console.error(e);
    } finally {
        rl.close();
        saveResult();
    }
}

runTest();
