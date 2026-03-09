# ⚡ Lightning Starter Kit

Starter kit oficial para las **Lightning Hackathons 2026** de La Crypta.

Incluye ejemplos, utilidades y guía asistida con AI para construir tu proyecto.

## 🚀 Inicio rápido

### Opción 1: Con Claude Code (recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/lacrypta/lightning-starter.git
cd lightning-starter

# Abrir con Claude Code
claude

# El asistente te guía para construir tu proyecto
```

Claude va a:
- Preguntarte qué querés construir
- Proponerte ideas si no tenés
- Guiarte paso a paso
- Ayudarte a ganar la hackathon

### Opción 2: Manual

```bash
# Clonar el repositorio
git clone https://github.com/lacrypta/lightning-starter.git
cd lightning-starter

# Instalar dependencias
npm install

# Ejecutar el frontend de demo
npm run dev
```

Abrir http://localhost:5173 en el navegador.

## 📦 Herramientas principales

| Herramienta | Descripción | Docs |
|-------------|-------------|------|
| **@getalby/sdk** | SDK de Alby para NWC y pagos | [Docs](https://github.com/getAlby/js-sdk) |
| **@neondatabase/serverless** | Driver para Neon (Postgres) | [Docs](https://neon.tech) |
| **@nostr-dev-kit/ndk** | SDK para Nostr (identidad, eventos) | [Docs](https://github.com/nostr-dev-kit/ndk) |
| **webln** | Standard para wallets Lightning | [Docs](https://webln.dev) |

## 🔌 Nostr Wallet Connect (NWC)

NWC permite conectar tu app a cualquier wallet Lightning compatible.

```javascript
import { nwc } from "@getalby/sdk";

// Conectar con string NWC
const client = new nwc.NWCClient({
  nostrWalletConnectUrl: "nostr+walletconnect://..."
});

// Crear invoice
const invoice = await client.makeInvoice({
  amount: 1000, // sats
  description: "Pago de prueba"
});

console.log(invoice.paymentRequest); // bolt11 invoice

// Pagar invoice
const response = await client.payInvoice({
  invoice: "lnbc..."
});
```

## 🌐 WebLN (Browser)

Para apps en el navegador con extensión de wallet:

```javascript
import { requestProvider } from "webln";

// Conectar con wallet del navegador (Alby, etc)
const webln = await requestProvider();

// Enviar pago
await webln.sendPayment("lnbc...");

// Crear invoice
const invoice = await webln.makeInvoice({
  amount: 1000,
  defaultMemo: "Pago desde mi app"
});
```

## 📁 Estructura del proyecto

```
sat-lotto-v2/
├── server/             # Backend (API, DB)
├── src/                # Frontend (Vite)
│   ├── utils/          # Utilidades (NWC, Nostr)
│   └── ui/             # Componentes UI
├── tests/              # Scripts de test y migración
├── package.json
└── README.md
```

## 🏃 Ejecución de Tests

```bash
# Probar conexión NWC
npm run test:nwc

# Ejecutar todos los tests (excepto UI)
npm run test:all
```

> ⚠️ Para los ejemplos que usan NWC, necesitás configurar tu connection string en `.env`

## ⚙️ Configuración

Crear archivo `.env`:

```env
# Tu Nostr Wallet Connect URL (desde Alby u otra wallet)
NWC_URL=nostr+walletconnect://...

# Opcional: tu Lightning Address para testing
LIGHTNING_ADDRESS=tu@email.com
```

## 📚 Recursos

- [Lightning Network Docs](https://lightning.network/)
- [Alby Developer Portal](https://guides.getalby.com/developer-guide)
- [LNURL Specs](https://github.com/lnurl/luds)
- [NWC Spec (NIP-47)](https://github.com/nostr-protocol/nips/blob/master/47.md)
- [WebLN Docs](https://webln.dev)

## 🎯 Ideas para la hackathon

- **POS simple**: Terminal de punto de venta
- **Tipping widget**: Botón de propinas para sitios web
- **Pay-per-content**: Paywall para artículos/videos
- **Split payments**: Dividir pagos entre múltiples wallets
- **Subscriptions**: Pagos recurrentes con NWC
- **Social payments**: Integrar zaps en tu app

## 🏆 Hackathon FOUNDATIONS - Marzo 2026

Este starter es para la primera hackathon del programa:

- **Fechas**: 3-31 de Marzo 2026
- **Tema**: Lightning Payments Basics
- **Premio**: 1,000,000 sats
- **Info**: [hackaton.lacrypta.ar](https://hackaton.lacrypta.ar)

## 🤝 Contribuir

1. Fork este repo
2. Creá tu feature branch (`git checkout -b mi-feature`)
3. Commit tus cambios (`git commit -m 'Agregar feature'`)
4. Push a la branch (`git push origin mi-feature`)
5. Abrí un Pull Request

---

Hecho con ⚡ por [La Crypta](https://lacrypta.ar)
