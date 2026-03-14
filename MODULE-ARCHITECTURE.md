# SatLotto — Modularización propuesta

## Principio: "El dinero no se pierde"

Regla absoluta: si un usuario pagó, su apuesta queda registrada como paid.
Si es ganador, recibe su premio (o se reintenta hasta que sí).

## Estructura propuesta

```
src/
├── modules/
│   ├── bets/
│   │   ├── bet-service.ts      # Lógica central: crear, confirmar, validar bet
│   │   ├── bet-validator.ts    # Validación de inputs (número, bloque, pubkey)
│   │   └── bet-repository.ts   # Queries DB (INSERT, SELECT, UPDATE)
│   │
│   ├── payments/
│   │   ├── invoice-service.ts  # Crear invoices vía NWC
│   │   ├── payment-verifier.ts # Verificar si una invoice fue pagada
│   │   ├── lnurl-service.ts    # Pago vía LN Address / LNURL
│   │   └── nwc-client.ts       # Wrapper del Alby SDK (un solo lugar)
│   │
│   ├── game/
│   │   ├── game-state.ts       # Bloque actual, target, fase del juego
│   │   ├── round-resolver.ts   # Calcular ganador del bloque
│   │   └── block-tracker.ts    # Sync con mempool.space
│   │
│   ├── payouts/
│   │   ├── payout-service.ts   # Orquestar pagos a ganadores
│   │   ├── payout-retry.ts     # Reintentar pagos fallidos
│   │   └── payout-notify.ts    # Notificar ganadores (DM Nostr)
│   │
│   └── identity/
│       ├── identity-service.ts # Perfiles Nostr, alias, lud16
│       └── nip05-verify.ts     # Verificar NIP-05
│
├── api/                        # Rutas HTTP (thin controllers)
│   ├── bet/
│   │   ├── POST.ts             # Crear bet con firma Nostr
│   │   ├── GET.ts              # Crear bet Amber (sin firma)
│   │   └── confirm.ts          # Confirmar pago
│   ├── state/
│   │   └── GET.ts              # Estado del juego
│   ├── identity/
│   │   ├── GET.ts              # Obtener perfil
│   │   └── POST.ts             # Actualizar perfil
│   └── cron/
│       └── payout.ts           # Worker de payouts
│
├── lib/
│   ├── db.ts                   # Pool de conexión Neon
│   ├── cache.ts                # Cache en memoria (block height, etc)
│   └── rate-limiter.ts         # Rate limiting
│
└── shared/
    ├── errors.ts               # Errores tipados (InsufficientFunds, InvalidBet, etc)
    └── constants.ts            # 21 bloques, 21 sats, timeouts, etc
```

## Flujo crítico: Crear apuesta

```
API Route (thin)
  └─→ BetService.createBet({ pubkey, number, block, signedEvent? })
        ├─→ BetValidator.validate({ number, block, pubkey })   # ¿número 1-21? ¿bloque válido?
        ├─→ PaymentVerifier.ensureNoDuplicate(...)              # ¿ya pagó este número?
        ├─→ InvoiceService.createInvoice(21, description)       # NWC: generar invoice
        ├─→ BetRepository.save({ ... })                        # INSERT en DB
        └─→ return { paymentRequest, paymentHash }
```

## Flujo crítico: Confirmar pago

```
API Route (thin)
  └─→ BetService.confirmBet({ paymentHash })
        ├─→ PaymentVerifier.isSettled(paymentHash)             # Consultar NWC
        │     └─→ NWCClient.lookupInvoice(paymentHash)
        ├─→ BetRepository.markAsPaid(paymentHash)              # UPDATE is_paid = TRUE
        ├─→ InvoiceService.payFee(2)                           # Pagar fee a fierillo
        └─→ return { confirmed: true }
```

## Flujo crítico: Resolver ronda

```
Cron Worker
  └─→ PayoutService.resolveRound(blockHeight)
        ├─→ GameRound.getRoundFor(blockHeight)                 # ¿este bloque cierra ronda?
        ├─→ RoundResolver.calculateWinner(blockHash)           # (hash % 21) + 1
        ├─→ BetRepository.getWinners(block, winningNumber)     # SELECT ganadores
        ├─→ PayoutService.payWinners(winners, prizeAmount)
        │     └─→ para cada ganador:
        │           ├─→ IdentityService.getLnAddress(pubkey)   # lud16 del perfil
        │           ├─→ LNURLService.requestInvoice(...)       # Generar invoice
        │           ├─→ NWCClient.payInvoice(invoice)          # Pagar
        │           ├─→ PayoutRepository.save(...)             # Registrar payout
        │           └─→ si falla → PayoutRetryQueue.enqueue()  # Reintentar después
        └─→ PayoutNotify.announceWinners(...)                  # Kind:1 en Nostr
```

## Separación de responsabilidades

| Módulo | Responsabilidad | NO hace |
|---|---|---|
| `BetService` | Orquestar creación/confirmación de bets | No consulta NWC, no accede DB directamente |
| `InvoiceService` | Crear/manejar invoices | No conoce de bets o jugadores |
| `PaymentVerifier` | Verificar si algo fue pagado | No crea invoices, no actualiza DB |
| `BetRepository` | Leer/escribir bets en DB | No sabe de Lightning o Nostr |
| `NWCClient` | Comunicación con wallet NWC | No sabe qué es una apuesta |

## Por qué esto importa

**Hoy:** si `payout-logic.ts` falla al pagar, el usuario no sabe que ganó.
El error se loggea y se pierde. No hay retry automático.

**Con esta estructura:**
- `PayoutRetryQueue` reintentó automáticamente (cada 30 min)
- `PayoutNotify` le manda un DM diciendo "ganaste, vení a reclamar"
- `PayoutRepository` registra el estado (pending/paid/failed) para debug

**Si algo falla, hay un camino de recovery claro.**
