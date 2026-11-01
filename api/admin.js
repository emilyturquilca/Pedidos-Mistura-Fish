import { db } from '../lib/db.js';
import { admin, wrap, json, body, limit } from '../lib/http.js';
import { HttpError, requireValue } from '../lib/validation.js';
import { loyverse } from '../lib/loyverse.js';
export const GET = wrap(async request => {
  await limit(request, 'admin-read', 1000); admin(request);
  const result = await db().query('SELECT * FROM pedidos ORDER BY creado DESC LIMIT 100');
  return json({ pedidos: result.rows });
});
export const POST = wrap(async request => {
  await limit(request, 'admin-write', 200); admin(request);
  const input = await body(request), id = Number(input.id);
  requireValue(Number.isSafeInteger(id) && id > 0, 'Pedido inválido.');
  if (input.accion === 'estado') {
    requireValue(['preparando','listo','en_camino','cancelado'].includes(input.estado), 'Estado inválido.');
    const result = await db().query("UPDATE pedidos SET estado=$1 WHERE id=$2 AND estado NOT IN ('cerrado','cancelado') AND sync_state='idle' RETURNING id", [input.estado,id]);
    requireValue(result.rows.length, 'El pedido ya se cerró, canceló o está registrando el pago.');
    return json({ ok: true });
  }
  requireValue(input.accion === 'cobrar' && ['efectivo','tarjeta','yape'].includes(input.metodo), 'Acción o método de pago inválido.');
  const existing = (await db().query('SELECT * FROM pedidos WHERE id=$1', [id])).rows[0];
  if (!existing) throw new HttpError(404, 'No encontramos el pedido.');
  if (existing.receipt) return json({ receipt: existing.receipt });
  requireValue(existing.estado !== 'cancelado', 'El pedido está cancelado.');
  requireValue(process.env.LOYVERSE_STORE_ID, 'Configura la tienda de Loyverse.');
  const paymentId = process.env['PAY_' + input.metodo.toUpperCase() + '_ID'];
  requireValue(paymentId, 'Configura el ID del método de pago en Vercel.');
  requireValue(!Number(existing.envio) || process.env.DELIVERY_VARIANT_ID, 'Configura DELIVERY_VARIANT_ID antes de registrar el envío.');
  const orderName = 'MF-' + existing.id + '-' + existing.cid;
  // Recover an uncertain prior response by finding the exact external order.
  if (existing.sync_state !== 'idle') {
    const found = await loyverse('/receipts?order=' + encodeURIComponent(orderName) + '&store_id=' + encodeURIComponent(process.env.LOYVERSE_STORE_ID));
    const receipt = found.receipts?.find(r => r.order === orderName && r.store_id === process.env.LOYVERSE_STORE_ID && !r.cancelled_at);
    if (!receipt) throw new HttpError(409, 'El envío anterior a Loyverse está pendiente de revisión. Comprueba en Loyverse antes de registrar otra venta; no se reenviará automáticamente.');
    await db().query("UPDATE pedidos SET receipt=$1,estado='cerrado',sync_state='done' WHERE id=$2", [receipt.receipt_number,id]);
    return json({ receipt: receipt.receipt_number });
  }
  const claim = await db().query("UPDATE pedidos SET sync_state='sending' WHERE id=$1 AND sync_state='idle' AND estado NOT IN ('cerrado','cancelado') RETURNING id", [id]);
  if (!claim.rows.length) throw new HttpError(409, 'Otro miembro del personal está registrando el cobro. Actualiza la lista.');
  try {
    const lines = existing.items.map(i => ({ variant_id:i.v, quantity:i.q, price:i.p }));
    if (Number(existing.envio)) lines.push({ variant_id: process.env.DELIVERY_VARIANT_ID, quantity: 1, price: Number(existing.envio) });
    const result = await loyverse('/receipts', { method:'POST', body: JSON.stringify({ store_id:process.env.LOYVERSE_STORE_ID, order:orderName, source:'Mistura Fish Web', note:`Pedido web #${id}. ${existing.nota || ''}`, line_items:lines, payments:[{ payment_type_id:paymentId, paid_at:new Date().toISOString() }] }) });
    if (!result.receipt_number) throw new Error('Missing receipt');
    await db().query("UPDATE pedidos SET receipt=$1,estado='cerrado',metodo=$2,sync_state='done' WHERE id=$3", [result.receipt_number,input.metodo,id]);
    return json({ receipt:result.receipt_number });
  } catch (error) {
    await db().query("UPDATE pedidos SET sync_state='uncertain' WHERE id=$1", [id]);
    throw error;
  }
});

