export const CONSENT_VERSION = 'promociones-whatsapp-v1';
export const CONSENT_TEXT = 'Quiero recibir promociones especiales de Mistura Fish por WhatsApp, como descuentos y beneficios por mi cumpleaños.';
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireValue(ok, message) { if (!ok) throw new HttpError(400, message); }
export function text(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function phone(value) {
  const raw = text(value, 40);
  if (!raw) return '';
  let digits = raw.replace(/[\s().-]/g, '');
  if (/^9\d{8}$/.test(digits)) digits = '+51' + digits;
  requireValue(/^\+[1-9]\d{7,14}$/.test(digits), 'Ingresa un celular válido: 9 dígitos para Perú o el número con prefijo internacional.');
  return digits;
}
export function profileInput(body) {
  requireValue(body && typeof body === 'object', 'Revisa tus datos.');
  const firstName = text(body.firstName, 80), lastName = text(body.lastName, 80);
  requireValue(firstName && lastName, 'Escribe tu nombre y apellido.');
  requireValue(typeof body.marketing === 'boolean', 'Indica si deseas recibir promociones.');
  const telephone = phone(body.phone), marketing = body.marketing === true;
  let birthDay = null, birthMonth = null;
  if (marketing) {
    requireValue(telephone, 'El celular es obligatorio para recibir promociones por WhatsApp.');
    birthDay = Number(body.birthDay); birthMonth = Number(body.birthMonth);
    const maxDays = [31,29,31,30,31,30,31,31,30,31,30,31];
    requireValue(Number.isInteger(birthMonth) && birthMonth >= 1 && birthMonth <= 12 && Number.isInteger(birthDay) && birthDay >= 1 && birthDay <= maxDays[birthMonth - 1], 'Elige un día y mes de cumpleaños válidos.');
  }
  return { firstName, lastName, phone: telephone || null, marketing, birthDay, birthMonth };
}
export function orderInput(body) {
  requireValue(['mesa','delivery'].includes(body?.tipo), 'Elige mesa o delivery.');
  requireValue(['efectivo','tarjeta','yape'].includes(body.metodo), 'Elige un método de pago.');
  const mesa = text(body.mesa, 12), direccion = text(body.direccion, 300);
  requireValue(body.tipo !== 'mesa' || /^[\p{L}\p{N} -]{1,12}$/u.test(mesa), 'Indica una mesa válida.');
  requireValue(body.tipo !== 'delivery' || direccion.length >= 8, 'Escribe la dirección y una referencia para el delivery.');
  requireValue(/^[0-9a-f-]{36}$/i.test(body.requestId || ''), 'No se pudo identificar el pedido. Recarga e inténtalo otra vez.');
  requireValue(Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 40, 'Agrega entre 1 y 40 productos diferentes.');
  const seen = new Set();
  for (const item of body.items) {
    requireValue(typeof item?.v === 'string' && item.v.length <= 80 && !seen.has(item.v) && Number.isInteger(item.q) && item.q >= 1 && item.q <= 20, 'Revisa las cantidades del pedido (máximo 20 por producto).');
    seen.add(item.v);
  }
  requireValue(body.items.reduce((n, i) => n + i.q, 0) <= 80, 'Máximo 80 unidades por pedido.');
  const billing = body.billing || {};
  requireValue(['boleta','factura'].includes(billing.type), 'Elige boleta o factura.');
  const document = text(billing.document, 20), company = text(billing.company, 150), email = text(billing.email, 150);
  requireValue(billing.type !== 'factura' || (/^\d{11}$/.test(document) && company), 'Para factura, ingresa RUC de 11 dígitos y razón social.');
  requireValue(billing.type !== 'boleta' || !document || /^\d{8}$/.test(document), 'El DNI debe tener 8 dígitos.');
  requireValue(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Revisa tu correo electrónico.');
  return { tipo: body.tipo, metodo: body.metodo, mesa: body.tipo === 'mesa' ? mesa : null, direccion: body.tipo === 'delivery' ? direccion : null, nota: text(body.nota, 500), requestId: body.requestId, items: body.items, billing: { type: billing.type, document, company: billing.type === 'factura' ? company : '', email }, transactionalWhatsapp: body.transactionalWhatsapp === true };
}
export function pricedItems(requested, catalog) {
  return requested.map(i => {
    const product = catalog.find(p => p.v === i.v);
    requireValue(product, 'Un producto ya no está disponible. Actualiza la carta y revisa tu pedido.');
    return { v: product.v, n: product.n, p: product.p, q: i.q };
  });
}

