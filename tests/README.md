# Pruebas (Tests)

Este directorio está destinado a alojar *scripts* aislados para testear partes de la infraestructura backend y frontend sin necesidad de accionar todo el flujo en el panel de UI.

## Ejecución
Los tests se ejecutan utilizando `tsx`. 
No requieren dependencias adicionales ni compilar, ya que `tsx` transpila TypeScript al vuelo.

Ejemplo:
```bash
 npx tsx tests/test-ping-bets.ts
```

*Nota: Los endpoints necesitan el servidor Node.js corriendo (`npm run dev`) con `dotenv` válido (`.env`) ya instanciado en el proyecto si buscan comunicarse con la base Neon u otros servicios.*
