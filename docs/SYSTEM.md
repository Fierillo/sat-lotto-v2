# SatLotto System Documentation

## 1. Arquitectura General

### Stack Tecnológico
- **Frontend**: Next.js 16 (React, TypeScript, Turbopack)
- **Base de Datos**: Neon PostgreSQL (serverless)
- **Wallet**: Nostr Wallet Connect (NWC) via Alby
- **Auth**: NIP-46 (Bunker), NIP-07 (Extensions), NWC Direct
- **Nostr**: NDK, nostr-tools
- **Styling**: CSS Modules + Plain CSS

### Componentes Principales
```
src/
├── app/
│   ├── api/
│   │   ├── bet/route.ts       # Crear/obtener apuestas
│   │   ├── state/route.ts     # Estado global del juego
│   │   ├── identity/[pubkey]/  # Perfiles de usuarios
│   │   └── debug/champions/   # Debug para testing
│   └── page.tsx               # Página principal
├── components/
│   ├── modals/
│   │   ├── ChampionModal.tsx       # Modal de victoria
│   │   ├── PotentialWinnerModal.tsx # Modal potencial ganador
│   │   └── LoginModal.tsx           # Login NIP-46/NWC
│   ├── Clock.tsx              # Reloj del sorteo
│   ├── BetsTable.tsx           # Tabla de apuestas
│   ├── ChampionsTable.tsx      # Hall of fame
│   └── DebugButtons.tsx       # Botonera de debug
├── contexts/
│   ├── AuthContext.tsx         # Autenticación
│   └── GameContext.tsx        # Estado del juego
├── hooks/
│   ├── usePayment.ts          # Lógica de pago
│   └── useVictoryCelebration.tsx # Animación de victoria
└── lib/
    ├── db.ts                  # Conexión Neon + CRUD
    ├── cache.ts               # Sync de bloques
    ├── nip46.ts               # Bunker NIP-46
    ├── nip07.ts               # Extension NIP-07
    ├── nwc.ts                # NWC client
    └── payout-logic.ts       # Lógica de premios
```

---

## 2. Flujo de Autenticación

### 2.1 NIP-46 Bunker (QR Code)

```
Usuario escanea QR → nostrconnect://...
    ↓
Genera signer local (secret)
    ↓
Suscribe a kind 24133 en relays
    ↓
Decrypt mensaje con NIP-44
    ↓
Valida secret → obtiene remotePubkey
    ↓
Signer configurado en AuthContext
```

**Archivos**: `src/lib/nip46.ts`, `src/components/modals/LoginModal.tsx`

### 2.2 NWC URL Directo

```
Usuario ingresa nostr+walletconnect://...
    ↓
Extrae secret de URL
    ↓
Crea NDKPrivateKeySigner con secret
    ↓
Signer configurado en AuthContext
```

**Archivos**: `src/lib/nwc.ts`, `AuthContext.tsx`

### 2.3 NIP-07 Extension (Alby, nos2x)

```
Usuario tiene extensión instalada (window.nostr existe)
    ↓
Llamar window.nostr.getPublicKey()
    ↓
Signer = window.nostr
    ↓
Firma eventos con window.nostr.signEvent()
```

**Archivos**: `src/lib/nip07.ts`, `AuthContext.tsx`

---

## 3. Flujo de Apuesta

### 3.1 Colocación de Apuesta

```
1. Usuario selecciona número (1-21)
    ↓
2. Frontend: Crear evento nostr kind 1
   {
     kind: 1,
     content: { bloque: targetBlock, numero: selectedNumber },
     tags: [['t', 'satlotto']]
   }
    ↓
3. Firme evento con signer disponible
   - NIP-07: window.nostr.signEvent()
   - Bunker: NDK con NDKNip46Signer
   - NWC: NDK con NDKPrivateKeySigner
    ↓
4. POST /api/bet con signedEvent
    ↓
5. Backend: Verificar firma, replay attack
    ↓
6. Backend: Crear invoice NWC (21 sats)
    ↓
7. Return { paymentRequest, paymentHash }
    ↓
8. Frontend: Mostrar invoice (QR)
    ↓
9. Usuario paga invoice
    ↓
10. Extension: window.webln.sendPayment()
    o NWC: Backend confirma pago automáticamente
    ↓
11. Backend: Marcar is_paid = TRUE
```

**Archivos**: `src/hooks/usePayment.ts`, `src/app/api/bet/route.ts`

### 3.2 Cambio de Número (Misma Ronda)

```
1. Usuario ya tiene apuesta PAGADA en esta ronda
2. Usuario cambia de número (ej: 5 → 10)
3. Se crea NUEVA apuesta con nuevo número
4. INSERT lotto_payouts { amount: 21, fee: 2, type: 'bet' }
5. Usuario paga la nueva apuesta
6. Ahora tiene 2 apuestas pagadas en la misma ronda
7. Para el sorteo: se usa la de ID más alto (la más reciente)
```

**Nota**: No hay reintegro. Si apostás 2 veces, pagás 2 veces (42 sats).

---

## 4. Flujo de Pago

### 4.1 NWC (Silencioso)

```
Backend crea invoice con NWC
    ↓
Invoice se muestra en QR
    ↓
Usuario paga con wallet externo (Alby app)
    ↓
Backend: lookupNwcInvoice(paymentHash)
    ↓
Si settled → is_paid = TRUE
```

**Aprobaciones**: 0 (el usuario paga desde su app)

### 4.2 Extensión NIP-07 (WebLN)

```
Usuario tiene extensión (Alby, nos2x)
    ↓
1. Intentar window.webln.sendPayment() directo
   (sin enable() - optimizado)
    ↓
2. Si falla por "not enabled" → enable() + sendPayment()
    ↓
Extension pide aprobación
    ↓
Pago se hace
    ↓
Preimage returned → confirmar con backend
```

**Aprobaciones**: 1-2 según estado de extensión

---

## 5. Determinación de Ganador

### 5.1 Cálculo del Número Ganador

```
target_block = ceil(current_block / 21) * 21
    ↓
Obtener block_hash del target_block desde mempool.space
    ↓
winning_number = (block_hash[0] % 21) + 1
    (número entre 1 y 21)
```

### 5.2 Protección contra Reorgs

```
Un block puede ser reorg'd (reorganizado) por la chain
    ↓
Para evitar pagos a bloques inválidos:
    ↓
processPayouts() SOLO se ejecuta si:
    current_block >= target_block + 2
    ↓
Espera 2 bloques de confirmación
```

**Archivos**: `src/lib/cache.ts`, `src/lib/payout-logic.ts`

---

## 6. Flujo de Celebración

### 6.1 Potential Winner (0-1 bloque después)

```
Usuario ganó (número coincide) PERO
    ↓
current_block < target_block + 2
    ↓
Mostrar PotentialWinnerModal:
    - "¡Posible ganador!"
    - Esperar confirmaciones de bloque
    - Si no tiene lud16 → solicitar LN address
    ↓
Backend: No procesar payout todavía
```

### 6.2 Champion (2+ bloques después)

```
current_block >= target_block + 2
    ↓
1. Animación "¡CAMPEÓN!" (4.5 segundos)
   - Overlay naranja
   - Texto animado
    ↓
2. A los 5.5 segundos: ChampionModal
   - Trofeo 🏆
   - "Ganaste X sats"
   - Mostrar LN address
   - Si no tiene → solicitar input
    ↓
3. Backend:
   - UPDATE last_celebrated_block = target_block
   - Procesar payout (enviar sats a lud16)
```

**Archivos**: `src/hooks/useVictoryCelebration.tsx`, `src/components/ResultPanel.tsx`

---

## 7. Schema de Base de Datos

### lotto_identities

```sql
CREATE TABLE lotto_identities (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL UNIQUE,
    alias TEXT,
    nip05 TEXT,
    lud16 TEXT,              -- Lightning address para pagos
    sats_earned INTEGER DEFAULT 0,
    last_celebrated_block INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### lotto_bets

```sql
CREATE TABLE lotto_bets (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    alias TEXT,
    selected_number INTEGER NOT NULL,  -- 1-21
    target_block INTEGER NOT NULL,     -- Bloque del sorteo
    betting_block INTEGER NOT NULL,    -- Bloque cuando apostó
    is_paid BOOLEAN DEFAULT FALSE,
    payment_request TEXT,
    payment_hash TEXT UNIQUE,          -- Para confirmar pago
    nostr_event_id TEXT,               -- Protección replay
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### lotto_payouts

```sql
CREATE TABLE lotto_payouts (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    block_height INTEGER NOT NULL,
    amount INTEGER NOT NULL,           -- 21 sats apostadas
    fee INTEGER DEFAULT 0,            -- 2 sats de fee
    type TEXT NOT NULL,               -- 'bet', 'winner', 'fee', 'cycle_resolved'
    status TEXT DEFAULT 'pending',    -- 'pending', 'paid', 'failed'
    tx_hash TEXT,
    bet_id INTEGER REFERENCES lotto_bets(id),
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pubkey, block_height, type)
);
```

---

## 8. Endpoints API

### GET /api/state

Retorna estado global del juego:
```json
{
  "block": { "height": 890000, "target": 890021, "poolBalance": 150 },
  "activeBets": [...],
  "champions": [...],
  "lastResult": {
    "resolved": true,
    "winningNumber": 7,
    "winners": [...],
    "targetBlock": 890021,
    "blocksUntilCelebration": 0,
    "hasConfirmed": true
  }
}
```

### POST /api/bet

Crea apuesta:
```json
Request: { "signedEvent": {...} }
Response: { "paymentRequest": "lnbc...", "paymentHash": "abc..." }
```

### GET /api/identity/[pubkey]

Retorna perfil:
```json
{ "alias": "fierillo", "lastCelebrated": 890021, "sats_earned": 15000, "lud16": "fierillo@lawallet.ar" }
```

### POST /api/identity/[pubkey]

Actualiza perfil con evento kind 0 firmado.

---

## 9. Debug Mode

### Activación

```bash
NEXT_PUBLIC_TEST=on npm run dev
```

### Botonera DebugButtons

| Botón | Función |
|-------|---------|
| ⚡ FLASH | Simula pago exitoso (flash verde) |
| ❄️ FROZEN | Toggle estado veda |
| 🔥 RESOLVING | Toggle fin de ronda |
| 🏆 VICTORY | Fuerza animación campeón + ChampionModal |
| 👑 POTENTIAL | Muestra PotentialWinnerModal |
| 🏅 CHAMPIONS | Inserta/reset test champions en DB |

### Endpoint Debug

```bash
POST /api/debug/champions
{
  "champions": [...],
  "action": "set" | "reset"
}
```

**Solo funciona si TEST=on**, sino retorna: `"No sos hacker, sos un mamerto. Volvé a Google."`

---

## 10. Ciclo de Juego

```
1. Apuesta abierta (bloques target-21 a target-2)
   - Usuario puede apostar
   - isFrozen = false
   
2. Betting cerrada (target-2 a target)
   - isFrozen = true
   - No se aceptan más apuestas
   
3. Sorteo (bloque = target)
   - Se determina winning_number
   - Se identifican winners
   
4. Espera reorg (target a target+2)
   - processPayouts() no corre
   - Winners ven PotentialWinnerModal
   
5. Confirmado (target+2+)
   - processPayouts() corre
   - Winners ven ChampionModal
   - Pool se reinicia
```

---

## 11. Rate Limiting

El sistema protege contra abuse:

| Endpoint | Límite |
|----------|--------|
| bet:create:pubkey | 10/minuto |
| bet:create:ip | 30/minuto |
| bet:confirm:pubkey | 3/minuto |
| identity:ip | 20/minuto |
| state:ip | 60/minuto |

---

## 12. Seguridad

###Replay Attack Protection
- `nostr_event_id` único por apuesta
- Si ya existe → rechazo

### Firma Desincronizada
- Evento debe tener created_at < 15 min
- Si no → rechazo

### Frozen Betting
- Si current_block >= target_block - 2
- No se aceptan más apuestas
