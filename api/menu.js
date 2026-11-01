import { wrap, json } from '../lib/http.js';
import { catalog } from '../lib/loyverse.js';
export const GET = wrap(async () => json({
  m: await catalog(), nombre: process.env.BUSINESS_NAME || 'Mistura Fish', envio: Math.max(0, Number(process.env.DELIVERY_FEE) || 0),
  yape: process.env.YAPE_NUMBER || '', contacto: process.env.CONTACT_WHATSAPP || '', demo: false
}, 200, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' }));

