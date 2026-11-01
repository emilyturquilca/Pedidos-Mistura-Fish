import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './validation.js';
export const digest = value => createHash('sha256').update(value).digest('hex');
export const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function wrap(fn) {
  return async request => {
    try { return await fn(request); }
    catch (error) {
      if (!error.status) console.error('Request failed', error.code || error.name);
      return json({ error: error.status ? error.message : 'No pudimos completar la solicitud. Intenta nuevamente en un momento.' }, error.status || 503);
    }
  };
}
export async function body(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Envía los datos en formato JSON.');
  const source = await request.text();
  if (Buffer.byteLength(source) > 16000) throw new HttpError(413, 'La solicitud es demasiado grande.');
  try { return JSON.parse(source); } catch { throw new HttpError(400, 'No se pudieron leer los datos.'); }
}
export async function customer(request, client = db()) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, 'Vuelve a ingresar tus datos para continuar.');
  const result = await client.query('SELECT * FROM clientes WHERE token_hash=$1 AND expires_at>now()', [digest(token)]);
  if (!result.rows[0]) throw new HttpError(401, 'Tu sesión terminó. Vuelve a ingresar tus datos.');
  return result.rows[0];
}
export function admin(request) {
  let supplied = '';
  try { supplied = decodeURIComponent(request.headers.get('x-clave') || ''); } catch { /* invalid header */ }
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || !timingSafeEqual(Buffer.from(digest(supplied)), Buffer.from(digest(expected)))) throw new HttpError(401, 'Acceso no autorizado.');
}
export async function limit(request, action, maximum = 20) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const bucket = digest(`${action}:${ip}:${Math.floor(Date.now() / 3600000)}`);
  const result = await db().query('INSERT INTO rate_limits(bucket, hits) VALUES($1,1) ON CONFLICT(bucket) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits', [bucket]);
  if (result.rows[0].hits > maximum) throw new HttpError(429, 'Has realizado varias solicitudes. Espera un momento o pide ayuda al personal.');
}

