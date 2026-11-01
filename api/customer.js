import { randomBytes } from 'node:crypto';
import { db } from '../lib/db.js';
import { wrap, json, body, customer, digest, limit } from '../lib/http.js';
import { profileInput, CONSENT_TEXT, CONSENT_VERSION } from '../lib/validation.js';
const publicProfile = row => ({ firstName: row.nombre, lastName: row.apellido, phone: row.telefono || '', marketing: row.promociones, birthDay: row.cumple_dia, birthMonth: row.cumple_mes });
export const GET = wrap(async request => json({ profile: publicProfile(await customer(request)) }));
async function save(request, update) {
  const profile = profileInput(await body(request));
  await limit(request, update ? 'profile-edit' : 'registration', 30);
  const previous = update ? await customer(request) : null;
  const token = update ? null : randomBytes(32).toString('hex');
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const values = [profile.firstName, profile.lastName, profile.phone, profile.marketing, profile.birthDay, profile.birthMonth];
    const result = update
      ? await client.query('UPDATE clientes SET nombre=$1,apellido=$2,telefono=$3,promociones=$4,cumple_dia=$5,cumple_mes=$6,actualizado=now() WHERE id=$7 RETURNING *', [...values, previous.id])
      : await client.query('INSERT INTO clientes(nombre,apellido,telefono,promociones,cumple_dia,cumple_mes,token_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [...values, digest(token)]);
    const row = result.rows[0];
    await client.query('INSERT INTO consentimientos(cliente_id,aceptado,version,texto,telefono) VALUES($1,$2,$3,$4,$5)', [row.id, profile.marketing, CONSENT_VERSION, CONSENT_TEXT, profile.phone]);
    await client.query('COMMIT');
    return json({ ...(token ? { token } : {}), profile: publicProfile(row) }, update ? 200 : 201);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export const POST = wrap(request => save(request, false));
export const PATCH = wrap(request => save(request, true));

