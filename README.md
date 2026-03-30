# SatLotto ⚡

**La lotería de Bitcoin en Lightning Network**

Cada 21 bloques de Bitcoin, el azar decide quién se lleva el pozo acumulado.
Vos apostás 21 sats, elegís un número del 1 al 21, y si tu número sale...
te llevás TODOS LOS SATS.

## ¿Cómo funciona?

1. **Conectá** tu wallet Nostr (Alby, nos2x, Amber, Bunker, NWC, etc...)
2. **Apostá** 21 sats en el número que elijas (1-21)
3. **Esperá** 21 bloques hasta que se resuelva la ronda
4. **Ganá** si tu número es el elegido por el azar, y recibí tu premio automáticamente en tu Lightning Address

El número ganador se calcula del hash del bloque de Bitcoin siguiendo una sencilla formula que cualquiera puede verificar:
```
winningNumber = (blockHash % 21) + 1
```

## Desarrollo

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## Testing

```bash
npm test              # Todos los tests (unit + integration + security)
npm run test:unit     # Solo unit tests
npm run test:integration  # Solo integration tests
npm run test:security    # Solo security tests
npm run test:e2e         # E2E tests con Playwright
npm run test:e2e:ui      # E2E tests con UI
```

Ver [docs/TESTS.md](docs/TESTS.md) para más detalles.

## Configuración

Creá `.env.local`:

```env
NEON_URL=postgres://...
NWC_URL=nostr+walletconnect://...

# Habilita para que el juego pueda usar NOSTR.
NOSTR_PRIVKEY=nsec...
NOSTR_ENABLED=true

# Para cron de GitHub Actions
VERCEL_SECRET=your-secret-here
APP_URL=https://your-app.vercel.app
```

## Stack

- **Next.js** - Frontend framework
- **Nostr** - Identidad (NIP-07, NIP-46 Bunker, NIP-55 Amber)
- **NWC** - Pagos Lightning (NIP-47)
- **Neon** - Base de datos PostgreSQL serverless
- **NDK** - Nostr Development Kit
- **GitHub Actions** - Cron para announcements (cada 5 min)
- **Vitest** - Testing (unit/integration/security)
- **Playwright** - E2E testing
- **TypeScript** - Tipado estático

---

🏆 Construido para La Crypta Lightning Hackathon 2026
