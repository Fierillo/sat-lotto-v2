import 'dotenv/config';
import { Client } from '@neondatabase/serverless';

async function migrate() {
    const url = process.env.NEON_URL;
    if (!url) throw new Error('NEON_URL not found');

    const client = new Client(url);
    try {
        await client.connect();
        console.log('🚀 Iniciando migración de esquema...');

        // 1. Agregar nostr_event_id a lotto_bets
        await client.query(`
            ALTER TABLE lotto_bets 
            ADD COLUMN IF NOT EXISTS nostr_event_id TEXT;
        `);
        console.log('✅ Columna nostr_event_id agregada a lotto_bets');

        // 2. Crear índice para búsquedas rápidas de replay
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_nostr_event_id ON lotto_bets(nostr_event_id);
        `);
        console.log('✅ Índice idx_nostr_event_id creado');

        // 3. Verificar lotto_identities por si acaso
        await client.query(`
            ALTER TABLE lotto_identities 
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS last_celebrated_block INTEGER DEFAULT 0;
        `);
        console.log('✅ Columnas last_updated y last_celebrated_block verificadas en lotto_identities');

        // 4. Limpieza (Opcional: borrar tabla compleja anterior si existía)
        await client.query(`DROP TABLE IF EXISTS lotto_celebrations;`);
        console.log('✅ Tabla lotto_celebrations eliminada (simplificación)');

    } catch (err) {
        console.error('❌ Error en migración:', err.message);
    } finally {
        await client.end();
    }
}

migrate();
