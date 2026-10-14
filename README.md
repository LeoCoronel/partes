# Partes de servicio

App web (Astro + React) para llevar los partes de servicio, con códigos GIB, trazabilidad y gestión de personal.
Datos en **Firestore** (se usa desde cualquier PC); sin `.env` funciona en **modo demo** (datos solo en ese navegador).

## Usar en modo demo
```
npm install
npm run dev      # http://localhost:4321
npm test         # pruebas de la lógica
```

## Poner en la nube (una sola vez)
Usá un proyecto Firebase **nuevo** (no el de guardias).
1. console.firebase.google.com → Agregar proyecto.
2. Build → Firestore Database → Crear base de datos (modo producción).
3. (Solo si querés login) Build → Authentication → Google → habilitar y completá `PUBLIC_ALLOWED_EMAIL`.
4. Configuración del proyecto → Tus apps → Web (`</>`) → copiá la config a `.env` (ver `.env.example`).
5. Pegá `firestore.rules` en Firestore → Reglas (por defecto sin login: los datos quedan accesibles a quien tenga el link) (o `firebase deploy --only firestore:rules`).
6. En `.firebaserc` poné el ID del proyecto.
7. `npm install -g firebase-tools`, `firebase login`, `npm run build`, `firebase deploy`.
   (Authentication → Configuración → Dominios autorizados: agregá el dominio de Hosting si no está.)

Al primer ingreso se cargan solos el personal y los 1126 partes de 2026 (próximo: 1183, NH = 22405 + N°).

## Estructura
- `src/lib/store.ts`: toda la lógica (NH, J, códigos, importación) en memoria, con adaptadores de guardado.
- `src/lib/firestoreAdapter.ts`: colecciones `ps_config`, `ps_personal`, `ps_partes`.
- `data/`: códigos del PDF, categorías viejas, personal y partes 2026.
