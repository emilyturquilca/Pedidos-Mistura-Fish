import { admin, wrap, json } from '../lib/http.js';
import { all } from '../lib/loyverse.js';
export const GET = wrap(async request => {
  admin(request);
  const [tiendas, pagos] = await Promise.all([all('/stores', 'stores'), all('/payment_types', 'payment_types')]);
  return json({ tiendas, pagos });
});

