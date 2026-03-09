import 'dotenv/config';
import { createNwcInvoice } from '../src/utils/create-invoice.ts';

async function testNwcConnection() {
    console.log('[Test] Probando conexión NWC del servidor...');
    const nwcUrl = process.env.NWC_URL;

    if (!nwcUrl) {
        console.error('[Error] No se encontró NWC_URL en el archivo .env');
        process.exit(1);
    }

    console.log(`[Test] Usando NWC: ${nwcUrl.substring(0, 50)}...`);

    try {
        console.log('[Test] Intentando generar invoice de 1 sat...');
        const invoice = await createNwcInvoice(nwcUrl, 1, 'Test SatLotto NWC Connection');
        
        const pr = (invoice as any).invoice || (invoice as any).payment_request || (invoice as any).paymentRequest;
        
        if (pr) {
            console.log('[Éxito] Invoice generado correctamente:');
            console.log(`        PR: ${pr.substring(0, 60)}...`);
            console.log(`        Hash: ${(invoice as any).payment_hash || (invoice as any).paymentHash}`);
        } else {
            console.error('[Fallo] El NWC respondió pero no devolvió un BOLT11 (payment_request).');
            console.log('[Detalles del objeto recibido]:', JSON.stringify(invoice, null, 2));
        }
    } catch (err: any) {
        console.error('[Error] Falló la conexión o la generación del invoice:');
        console.error('        Mensaje:', err.message);
        console.error('        Asegúrate de que el relay sea accesible y que el NWC tenga permiso "make_invoice".');
    }
}

testNwcConnection();
