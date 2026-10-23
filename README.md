# Pedidos web (mesa con QR y delivery) → Loyverse

Los clientes piden desde el celular; el personal confirma y cobra; la venta queda registrada como recibo en **Loyverse**.

## Flujo
1. El cliente abre la carta (productos y precios salen de Loyverse), elige mesa o delivery y forma de pago (efectivo, tarjeta, Yape) y envía el pedido.
2. El pedido queda en la base de datos (no es una venta todavía).
3. El personal lo ve en `/admin.html`, lo marca *preparando / listo / en camino* y, al cobrar, presiona **Cobrar y registrar**: recién ahí se crea el recibo en Loyverse.

## Puesta en marcha
1. Crea una base en Neon y ejecuta `schema.sql`.
2. Sube estos archivos a un repositorio privado de GitHub (en la raíz) y créalo en Vercel (framework: Other).
3. En Vercel > Settings > Environment Variables agrega las de `.env.example`. Primero pon `DATABASE_URL`, `LOYVERSE_TOKEN` y `ADMIN_PASSWORD`; haz Redeploy.
4. Entra a `/admin.html`, presiona **Ver IDs de Loyverse**, copia el ID de la tienda y de los tipos de pago (efectivo, tarjeta, Yape) a `LOYVERSE_STORE_ID`, `PAY_EFECTIVO_ID`, `PAY_TARJETA_ID`, `PAY_YAPE_ID`. Redeploy.
5. QR por mesa: genera un QR con la dirección `https://TU-APP.vercel.app/?mesa=5` (una por mesa).

## Importante
- El precio siempre se toma de Loyverse en el servidor; el navegador no puede cambiarlo.
- Yape se confirma manualmente: el personal verifica el pago y lo marca. No hay conexión automática con Yape.
- Si usas delivery con costo de envío, crea un producto "Delivery" en Loyverse y pon su ID en `DELIVERY_VARIANT_ID`; si no, el envío se cobra pero no se registra en el recibo.
- Anti-abuso básico: celular obligatorio, máximo 3 pedidos pendientes por celular por hora y cantidades limitadas.
- Un recibo de Loyverse no es necesariamente un comprobante electrónico de SUNAT: consúltalo con tu contador.
- Vercel Hobby es solo para uso no comercial.
- Verifica con la documentación oficial de Loyverse los campos de `POST /receipts` (`line_items`, `payments`) y de `/payment_types` y `/stores`, y haz una venta de prueba antes de abrir al público.
