import { HttpError } from './validation.js';
export async function loyverse(path, options = {}) {
  if (!process.env.LOYVERSE_TOKEN) throw new HttpError(503, 'La carta está en preparación. Pide ayuda al personal.');
  const response = await fetch('https://api.loyverse.com/v1.0' + path, { ...options, headers: { 'Authorization': 'Bearer ' + process.env.LOYVERSE_TOKEN, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) { console.error('Loyverse request failed', response.status); throw new HttpError(503, 'No pudimos conectar con Loyverse. Intenta nuevamente en un momento.'); }
  return response.json();
}
export async function all(path, key) {
  const result = []; let cursor;
  do {
    const page = await loyverse(`${path}${path.includes('?') ? '&' : '?'}limit=250${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    result.push(...(page[key] || [])); cursor = page.cursor;
  } while (cursor);
  return result;
}
export function catalogItems(items, categories, storeId) {
  const categoryNames = Object.fromEntries(categories.filter(c => !c.deleted_at).map(c => [c.id, c.name]));
  return items.filter(i => !i.deleted_at && !i.sold_by_weight).flatMap(item => (item.variants || []).flatMap(variant => {
    const store = variant.stores?.find(s => s.store_id === storeId);
    const price = store?.price ?? variant.default_price;
    if (variant.deleted_at || !store || store.available_for_sale !== true || (store.pricing_type || variant.default_pricing_type) !== 'FIXED' || typeof price !== 'number' || !Number.isFinite(price) || price < 0) return [];
    const options = [variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(' / ');
    return [{ v: variant.variant_id, n: item.item_name + (options ? ' · ' + options : ''), p: Math.round(price * 100) / 100, c: categoryNames[item.category_id] || 'Especialidades', d: item.description || '', image: /^https:\/\//.test(item.image_url || '') ? item.image_url : null }];
  }));
}
export async function catalog() {
  if (!process.env.LOYVERSE_STORE_ID) throw new HttpError(503, 'La tienda todavía no tiene la carta configurada.');
  const [items, categories] = await Promise.all([all('/items', 'items'), all('/categories', 'categories')]);
  return catalogItems(items, categories, process.env.LOYVERSE_STORE_ID);
}

