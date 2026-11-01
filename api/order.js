import { db } from '../lib/db.js';
import { wrap, json, body, customer, limit } from '../lib/http.js';
import { orderInput, pricedItems, requireValue, HttpError } from '../lib/validation.js';
import { catalog } from '../lib/loyverse.js';
export const GET = wrap(async request => {
  const person = await customer(request), id = new URL(request.url).searchParams.get('id');
  const result = await db().query('SELECT id,estado,total,metodo,receipt,creado FROM pedidos WHERE id=$1 AND cliente_id=$2', [id, person.id]);
  if (!result.rows[0]) throw new HttpError(404, 'No encontramos este pedido.');
  return json(result.rows[0]);
});
export const POST = wrap(async request => {
  const person = await customer(request), input = orderInput(await body(request));
  requireValue(!((input.tipo === 'delivery' || input.transactionalWhatsapp) && !person.telefono), 'Agrega un celular en tus datos para el delivery o las notificaciones por WhatsApp.');
  const previous = await db().query('SELECT id,total FROM pedidos WHERE cid=$1 AND cliente_id=$2', [input.requestId, person.id]);
  if (previous.rows[0]) return json(previous.rows[0]);
  await limit(request, 'order', 30);
  const items = pricedItems(input.items, await catalog());
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.p * i.q, 0) * 100) / 100;
  const envio = input.tipo === 'delivery' ? Math.max(0, Number(process.env.DELIVERY_FEE) || 0) : 0;
  const total = Math.round((subtotal + envio) * 100) / 100;
  // A displayed estimate must agree with the newly fetched Loyverse prices.
  const original = request.headers.get('x-expected-total');
  if (original === null || Math.abs(Number(original) - total) > 0.005 || !Number.isFinite(Number(original))) throw new HttpError(409, 'Los precios cambiaron. Vuelve a la carta, actualízala y revisa el total.');
  const result = await db().query(`INSERT INTO pedidos(cid,cliente_id,tipo,mesa,nombre,telefono,direccion,metodo,nota,items,subtotal,envio,total,comprobante,notificaciones_whatsapp)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(cid) DO NOTHING RETURNING id,total`,
  [input.requestId,person.id,input.tipo,input.mesa,person.nombre+' '+person.apellido,person.telefono,input.direccion,input.metodo,input.nota,JSON.stringify(items),subtotal,envio,total,JSON.stringify(input.billing),input.transactionalWhatsapp]);
  if (!result.rows[0]) {
    const existing = await db().query('SELECT id,total FROM pedidos WHERE cid=$1 AND cliente_id=$2', [input.requestId,person.id]);
    if (!existing.rows[0]) throw new HttpError(409, 'No se pudo identificar el pedido. Vuelve a intentarlo.');
    return json(existing.rows[0]);
  }
  return json(result.rows[0], 201);
});

