# Mistura Fish · Carta y checkout

Carta pública para mesa con QR, recojo y delivery, inspirada en el HTML de referencia. Usa la API existente de https://misturafishreports.vercel.app, autorizada exclusivamente para https://pedidos-mistura-fish.vercel.app. El navegador nunca recibe el token de Loyverse ni la base de datos.

## Flujo real
1. Administración actualiza el catálogo desde Loyverse en Reports → Pedidos web, elige productos/presentaciones y publica la carta. Los precios salen de Loyverse; no se inventan precios en el HTML.
2. El cliente elige platos, indica mesa o dirección y confirma. El servidor valida precios y guarda un pedido único con seguimiento privado.
3. El mismo pedido aparece en Reports → Operativo y en el acceso exclusivo de cocina. Los estados del pedido y el pago se gestionan por separado.
4. Caja confirma el efectivo recibido desde el perfil operativo o administración desde Pedidos web. Una pasarela configurada puede confirmar los pagos en línea.
5. Con la sincronización de recibos habilitada y los tipos de pago asociados, el servidor crea un recibo de venta en Loyverse, guarda su número y lo incorpora a Reports. No volver a registrar el mismo pedido manualmente en el POS.

## Configuración
- En el proyecto Vercel mistura_fish_reports: LOYVERSE_TOKEN (Secret de producción), DATABASE_URL y APP_PASSWORD. Esta carta no necesita otra base ni otro token.
- En Reports → Pedidos web → Pagos / Loyverse: actualizar referencias, seleccionar tienda y tipos de pago, habilitar el envío de ventas. Elegir un artículo de delivery si se cobra envío.
- En Carta: seleccionar los platos y su presentación, guardar y abrir la carta. Los artículos con impuestos añadidos necesitan revisión antes de publicarse.
- Personal: /admin.html enlaza los perfiles reales; sus códigos los genera administración en Reports.
- QR: /qr.html genera un SVG descargable con mesa opcional.

## Pagos y comprobantes
Seleccionar Yape o tarjeta no acredita un pago. Sin pasarela configurada, la carta admite efectivo y mantiene deshabilitados los cobros en línea. No muestra QR, teléfono o códigos Yape ficticios. Las promociones de WhatsApp requieren configuración adicional; el permiso del cliente es opcional. No se promete emitir una boleta o factura fiscal solo por crear un recibo en Loyverse.

## Seguridad y duplicados
El total se valida en servidor; el seguimiento usa un token aleatorio en el fragmento de URL y se envía por cabecera. Repetir el envío consulta el mismo pedido. Si se pierde la confirmación de un POST a Loyverse, el sistema exige conciliación; no crea automáticamente otro recibo. El stock físico no se descuenta por receta salvo activación expresa en Reports.

## Pruebas
La integración y permisos se prueban en el repositorio de Reports con almacenamiento aislado, precios sintéticos y respuestas simuladas de Loyverse. La vista local de la carta nunca debe escribir pedidos ficticios en producción. El antiguo schema.sql queda como referencia histórica y ya no se usa; no hay que ejecutar una migración para esta carta.
