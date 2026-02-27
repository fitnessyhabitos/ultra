# 🚀 Guía de Despliegue: Firebase Cloud Function para SumUp

## ¿Qué es esto?

Esta Cloud Function actúa como un intermediario seguro entre la app y SumUp.
La clave secreta de SumUp NUNCA sale del servidor — el navegador del usuario nunca la ve.

## Pasos para desplegar (una sola vez)

### 1. Instalar las herramientas (si no las tienes)

Instala Node.js desde https://nodejs.org (versión 20 LTS)

Después instala Firebase CLI:
```
npm install -g firebase-tools
```

### 2. Iniciar sesión en Firebase
```
firebase login
```

### 3. Instalar dependencias de la función
```
cd functions
npm install
cd ..
```

### 4. Guardar la clave secreta de SumUp en Firebase (SEGURO)
```
firebase functions:secrets:set SUMUP_SECRET_KEY
```
Cuando te pregunte el valor, escribe exactamente:
`sup_sk_T82OYQH1H86LYMkG9X9fCF1vczTrYe79N`

### 5. Desplegar la función
```
firebase deploy --only functions
```

### 6. Verificar

Tras el deploy, obtendrás una URL como:
`https://europe-west1-fitdatalite.cloudfunctions.net/createSumupCheckout`

Esta URL ya está configurada en index.html. ¡No tienes que tocar nada más!

---

## Cambiar el precio de un plan

Los precios están en `index.html` en el bloque `#btn-pay-sumup`:
- APP: 29€
- Preparación Física: 65€
- 4 Sesiones: 80€
- 8 Sesiones: 144€
- Sesión Suelta: 23€

---

## ¿Qué pasa si la función no está desplegada?

Los usuarios verán un mensaje: *"La pasarela de pago aún está siendo activada por el Coach. Por ahora, usa Bizum..."*
Bizum siempre funcionará como alternativa de pago.
