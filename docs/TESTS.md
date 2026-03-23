# Pruebas (Tests)

Este directorio está destinado a alojar *scripts* aislados para testear partes de la infraestructura backend y frontend sin necesidad de accionlar todo el flujo en el panel de UI.

## Estructura

```
tests/
├── unit/           # Unit tests (db queries, pure functions)
├── integration/    # Integration tests (API, NWC, full flows)
├── security/       # Security/hacker tests
└── debug/          # Debug scripts, manual testing tools
```

## Ejecución con Vitest

```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:security # Run security tests only
npm run test:watch    # Watch mode for development
```

## Legado (tsx)

Algunos tests antiguos usan `tsx` directamente:

```bash
npm run test:nwc
./tests/debug/run.sh <nombre_del_test>
```

## Tests disponibles

### Unit tests (`tests/unit/`):
- `test-db.ts`: Prueba básica de query a la base Neon.
- `test-db-connection.ts`: Verifica que la conexión a Neon sea exitosa.
- `test-db-schema.ts`: Valida que el esquema de la base de datos sea consistente.
- `test-frozen-toggle.ts`: Test del toggle de congelamiento.
- `test-ping-bets.ts`: Test de ping a bets.

### Integration tests (`tests/integration/`):
- `test-nwc.ts`: Verifica la conexión NWC del servidor y capacidad de generar invoices.
- `test-submit-bet.ts`: Simula una apuesta completa contra la API consolidada.
- `test-bot-interaction.ts`: Test de interacción con bot.

### Security tests (`tests/security/`):
- `hacker-test-*.ts`: Tests de seguridad (XSS, replay, frozen betting, etc.)

### Debug (`tests/debug/`):
- `debug-ui.ts`: Utilidades para inyectar botones de test en el frontend.
- `debug-payout-send.ts`: Script de debug para payouts.
- `simulate-payout.ts`: Simulación de payout.
- `test-nip46-handshake.ts`: Test manual de handshake NIP-46.

**Nota importante**: Los scripts en esta carpeta son para DIAGNÓSTICO. Para inicializar la estructura de la base de datos, utiliza el archivo `schema.sql` en la raíz del proyecto. El sistema ahora permite múltiples intentos de apuesta por usuario, pero solo la última pagada es válida.
