# Pruebas (Tests)

## Estructura

```
tests/
├── unit/           # Unit tests (pure functions, utils, lib modules)
├── integration/    # Integration tests (API endpoints, NWC, full flows)
├── security/       # Security/hacker tests (input validation, replay attacks, etc.)
├── e2e/           # End-to-end tests with Playwright (browser automation)
└── debug/          # Debug scripts, manual testing tools
```

## Ejecución con Vitest

```bash
npm test              # Run all tests (unit + integration + security)
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:security # Run security tests only
npm run test:watch    # Watch mode for development
```

## Ejecución con Playwright (E2E)

```bash
npm run test:e2e         # Run E2E tests headless
npm run test:e2e:ui      # Run E2E tests with UI
```

## Unit Tests (`tests/unit/`)

Unit tests run in Node environment and test pure functions:

| Test | Descripción |
|------|-------------|
| `bunker-url-parsing.test.ts` | NIP-46 bunker URL parsing |
| `crypto.test.ts` | NWC encryption/decryption with Argon2 |
| `db-connection.test.ts` | Neon database connection |
| `db-schema.test.ts` | Database schema validation |
| `ln.test.ts` | Lightning address parsing |
| `lnurl-resolver.test.ts` | LNURL resolution |
| `nip07-payment.test.ts` | NIP-07 payment flow |
| `nip46-serialization.test.ts` | NIP-46 signer serialization |
| `nostr.test.ts` | Nostr utilities (NDK exports) |
| `nwc.test.ts` | NWC URL parsing |
| `qr-uri-generation.test.ts` | QR URI generation |
| `reorg-protection.test.ts` | Reorganization protection logic |
| `victory-flow.test.ts` | Victory celebration flow |
| `winner-determination.test.ts` | Winner number calculation |

## Integration Tests (`tests/integration/`)

Integration tests verify API endpoints and full flows:

| Test | Descripción |
|------|-------------|
| `bet-flow.test.ts` | Complete bet creation flow |
| `duplicate-prevention.test.ts` | Replay attack protection |
| `frozen-window.test.ts` | Betting window restrictions |
| `identity-api.test.ts` | Identity endpoint |
| `state-api.test.ts` | Game state endpoint |
| `victory-payout.test.ts` | Payout processing |

## Security Tests (`tests/security/`)

Security tests verify protections against attacks:

| Test | Descripción |
|------|-------------|
| `frozen-window-bypass.test.ts` | Frozen betting bypass attempts |
| `hacker-identity-claim.test.ts` | Identity/claim endpoint auth (firma, pubkey mismatch, expired) |
| `invalid-signature.test.ts` | Signature validation |
| `input-validation.test.ts` | Input sanitization |
| `rate-limit.test.ts` | Rate limiting |
| `replay-attack.test.ts` | Replay attack protection |
| `spam-unpaid-invoices.test.ts` | Unpaid invoice spam |
| `xss-vulnerability.test.ts` | XSS protection |

## E2E Tests (`tests/e2e/`)

Browser automation tests with Playwright:

| Test | Descripción |
|------|-------------|
| `login-extension.spec.ts` | Login flow with NIP-07 extensions |

## Debug Scripts (`tests/debug/`)

Scripts para diagnóstico manual. **No son tests automatizados.**

**Nota**: Para inicializar la estructura de la base de datos, utiliza el archivo `schema.sql` en la raíz del proyecto.

---

## Pending Tests (To Implement)

These tests are identified as missing and should be implemented in the future.

### Unit Tests Pendientes

| Test | Descripción | Archivo |
|------|-------------|---------|
| `getWinners.test.ts` | Función `getWinners()` de champion-call.ts | `tests/unit/` |
| `buildAnnouncement.test.ts` | Función `buildAnnouncement()` | `tests/unit/` |
| `calculateResult.test.ts` | Función `calculateResult()` | `tests/unit/` |

### Integration Tests Pendientes

| Test | Descripción | Archivo |
|------|-------------|---------|
| `cron-process-round.test.ts` | Endpoint `/api/cron/process-round` completo (auth, sync, publish) | `tests/integration/` |
| `processPayouts.test.ts` | Flujo completo de pagos (winners, retry, DM) | `tests/integration/` |

### Security Tests Pendientes

| Test | Descripción | Archivo |
|------|-------------|---------|
| `cron-endpoint-auth.test.ts` | Verifica que el endpoint rechace requests sin VERCEL_SECRET | `tests/security/` |
