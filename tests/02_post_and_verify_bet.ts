import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';

async function testSubmitBet() {
    console.log('[Test] Probando POST /api/bet...');

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);
    const targetBlock = 899999;
    const selectedNumber = 12;

    console.log(`[Test] Generada pubkey aleatoria: ${pubkey.slice(0, 10)}...`);

    const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: targetBlock, numero: selectedNumber }),
    };

    const signedEvent = finalizeEvent(eventTemplate, sk);

    try {
        const response = await fetch('http://localhost:5173/api/bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`[Error] Respuesta servidor (${response.status}):`, data.error);
            return;
        }

        console.log(`[Éxito] Invoice generado validamente: ${data.paymentRequest.slice(0, 20)}...`);
        console.log('[Test] Verificando en DB si se alojó la apuesta en el endpoint /api/bets...');

        await verifySavedBet(targetBlock, pubkey);

    } catch (error: any) {
        console.error('[Error] Falló el fetch:', error.message);
    }
}

async function verifySavedBet(block: number, expectedPubkey: string) {
    try {
        const response = await fetch(`http://localhost:5173/api/bets?block=${block}`);
        const data = await response.json();

        if (!data.bets || data.bets.length === 0) {
            console.error('[Fallo] No se encontró ninguna apuesta para el bloque', block);
            return;
        }

        const found = data.bets.find((b: any) => b.pubkey === expectedPubkey);
        if (found) {
            console.log(`[Éxito] Apuesta encontrada en la DB para ${expectedPubkey.slice(0, 10)}... (Número: ${found.selected_number})`);
        } else {
            console.error('[Fallo] Apuestas listadas, pero no está la de la key esperada.');
        }

    } catch (error: any) {
        console.error('[Error] Verificación db fallida:', error.message);
    }
}

testSubmitBet();
