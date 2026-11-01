# Mistura Fish · Carta, registro y pedidos

Implementación basada en el prototipo «Mistura Fish · Carta y checkout». Conserva azul marino, crema, dorado y Playfair Display / Poppins. No modifica el prototipo original.

## Flujo

1. QR `https://TU-DOMINIO/?mesa=04` → bienvenida. El QR identifica la mesa; no obtiene datos del teléfono.
2. Nombre y apellido obligatorios, celular opcional, promociones desmarcadas.
3. Aceptar promociones hace obligatorios el celular y el cumpleaños (día y mes). Se valida la fecha, incluido el 29 de febrero.
4. Carta con buscador, categorías y variantes. Carrito editable, mesa o delivery, instrucciones, método de pago y datos solicitados para boleta/factura.
5. Pedido guardado como pendiente. El personal cambia el estado y verifica el pago antes de registrarlo en Loyverse.
6. «Mis datos» permite retirar promociones. Se elimina el cumpleaños del perfil y se registra la decisión. El historial de consentimiento conserva teléfono y fecha para auditoría.

El contacto sobre un pedido es una opción separada del consentimiento comercial. El celular es necesario para delivery o contacto transaccional solicitado. No se deduplican perfiles por celular: una persona no puede acceder a otro perfil con solo conocer el número. La sesión es un token aleatorio, guardado en sessionStorage y almacenado como hash en PostgreSQL; expira a los 30 días y no es una cuenta verificada por SMS.

## Vista de prueba

Node 24:

```sh
npm ci
npm run demo
```

La franja identifica explícitamente la demo. Usa productos de ejemplo y memoria temporal; no accede a Loyverse, no persiste datos y no envía campañas. No hay fallback a demo cuando falla la API real.

Vista HTML autónoma para abrir con doble clic:

```sh
node scripts/export-preview.mjs RUTA-ABSOLUTA/prototipo.html
```

Google Fonts requiere conexión; hay tipografías alternativas. Las ilustraciones son decorativas; las fotos reales salen de Loyverse cuando existen.

## Activación en Vercel

1. Ejecuta `schema.sql` en PostgreSQL/Neon. La migración es aditiva y conserva pedidos existentes. Respalda tu base antes de aplicarla en producción.
2. Configura las variables de `.env.example`: DATABASE_URL, LOYVERSE_TOKEN, LOYVERSE_STORE_ID y una ADMIN_PASSWORD larga y exclusiva. Usa base y credenciales separadas en Preview.
3. Framework «Other», Node 24. El build ejecuta comprobaciones. Los HTML/assets se sirven desde la raíz y api/*.js son Vercel Functions.
4. /admin.html → contraseña → «Ver IDs de Loyverse» muestra tiendas y pagos. Configura PAY_EFECTIVO_ID, PAY_TARJETA_ID y PAY_YAPE_ID, según corresponda, y vuelve a desplegar.
5. Configura YAPE_NUMBER y CONTACT_WHATSAPP oficiales, y DELIVERY_FEE. Si hay costo de envío, configura DELIVERY_VARIANT_ID; sin él se bloquea el registro del cobro para evitar omitirlo del recibo.
6. Completa el aviso de privacidad con contacto y conservación del negocio. Verifica precios finales e impuestos, una venta de prueba, autorización/retiro y pedidos desde dos dispositivos antes de abrir al público.

Desarrollo real local: copia .env.example a .env.local, completa las variables de desarrollo y ejecuta `npm run dev`. El servidor local publica solo assets de la app.

## Loyverse

- /api/menu lee todas las páginas de /items y /categories, respeta precio y disponibilidad de la tienda y ofrece variantes con precio fijo. Omite bajas, productos por peso y precio variable.
- Caché pública de 30 segundos, hasta 60 con revalidación. «Actualizar carta» vuelve a consultar. No se configuraron webhooks ni sincronización de inventario. La disponibilidad es available_for_sale, no una reserva de stock.
- Al enviar se vuelve a leer el catálogo. Los precios del navegador se ignoran. Si cambia el total mostrado se pide revisar el carrito. El personal confirma la disponibilidad final.
- Los pedidos tienen una clave idempotente: repetir la solicitud no crea otro pedido.
- «Cobrar y registrar» crea un recibo después de confirmación manual. Una actualización atómica bloquea cobros concurrentes. Si se pierde la respuesta de Loyverse, queda incierto: el próximo intento busca el recibo exacto, sin reenviar la venta automáticamente. Si no lo encuentra, hay que reconciliar manualmente antes de restablecer sync_state a idle.
- Clientes y autorizaciones quedan en PostgreSQL; no se sincronizan clientes/cumpleaños con Loyverse.
- Referencias: https://developer.loyverse.com/docs/ y https://vercel.com/docs/functions/runtimes/node-js.

## Alcance

Yape se verifica manualmente; elegirlo no acredita un pago. Los datos de boleta/factura se entregan al personal. La app no emite comprobantes electrónicos SUNAT. El recibo Loyverse y el comprobante fiscal son procesos distintos. No se calcula un IGV fijo: el precio final depende del catálogo y debe verificarse con los impuestos configurados en Loyverse.

Se registra el consentimiento, pero no se envían mensajes, campañas, recibos ni notificaciones automáticas. Para campañas hace falta integrar un proveedor de WhatsApp y seguir sus reglas vigentes. El personal dispone de los datos del pedido para coordinarlo manualmente.

El panel muestra los últimos 100 pedidos. No incluye panel de campañas ni exportación de clientes. Planificar conservación de clientes/pedidos y limpieza periódica de rate_limits (por ejemplo, filas de más de 48 horas).

## Verificación

```sh
npm test
npm run check
```

Las pruebas ejecutan handlers reales con PostgreSQL emulado por pg-mem y respuestas Loyverse simuladas: registro, auditoría, retiro, aislamiento de sesiones, precios, pedidos idempotentes, errores externos y cobros autorizados. No sustituyen una prueba con tu cuenta de Loyverse y PostgreSQL real.


