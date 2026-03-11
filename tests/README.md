# Pruebas (Tests)

Este directorio está destinado a alojar *scripts* aislados para testear partes de la infraestructura backend y frontend sin necesidad de accionar todo el flujo en el panel de UI.

## Ejecución
Los tests se ejecutan utilizando `tsx`. 
No requieren dependencias adicionales ni compilar, ya que `tsx` transpila TypeScript al vuelo.

Puedes usar el script facilitador:
```bash
./tests/run.sh <nombre_del_test>
```

O via npm:
```bash
npm run test:nwc
```

### Tests disponibles:
- `init-db.ts`: Crea las tablas necesarias en Neon (bet, identities, payouts). Ejecutar al configurar DB por primera vez.
- `test-nwc.ts`: Verifica la conexión NWC del servidor y capacidad de generar invoices.
- `test-submit-bet.ts`: Simula una apuesta completa contra la API.
- `test-db.ts`: Prueba básica de query a la base Neon.
- `debug-ui.ts`: Utilidades para inyectar botones de test en el frontend.
