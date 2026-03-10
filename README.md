# SatLotto ⚡

**La lotería de Bitcoin en Lightning Network**

Cada 21 bloques de Bitcoin, el azar decide quién se lleva el pozo acumulado. 
Vos apostás 21 sats, elegís un número del 1 al 21, y si tu número sale... 
te llevás TODOS LOS SATS.

## ¿Cómo funciona?

1. **Conectá** tu wallet Nostr (Alby, nos2x, Bunker, NWC, etc...)
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

Abrí http://localhost:5173

## Configuración

Creá `.env`:

```env
NEON_URL=postgres://...
NWC_URL=nostr+walletconnect://...

# Habilita para que el juego pueda usar NOSTR.
NOSTR_PRIVKEY=nsec...
NOSTR_ENABLED=true
```

## Stack

- **Nostr** - Identidad (NIP-26, NIP-46 Bunker)
- **NWC** - Pagos Lightning (NIP-47)
- **Neon** - Base de datos PostgreSQL
- **Vite** - Frontend
- **Typescript** - Base

## Reglas del juego

- **Apuesta**: 21 sats por número
- **Premio**: El pozo completo dividido entre los ganadores
- **Ronda**: 21 bloques de Bitcoin (lo que el destino diga)
- **Ventana**: Podés apostar hasta el bloque 18
- **Pago**: Automático a tu Lightning Address (configurala en tu perfil de Nostr)

---

🏆 Construido para La Crypta Lightning Hackathon 2026
