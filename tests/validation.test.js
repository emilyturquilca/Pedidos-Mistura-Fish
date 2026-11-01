import test from 'node:test';
import assert from 'node:assert/strict';
import { profileInput, orderInput, pricedItems } from '../lib/validation.js';
import { catalogItems } from '../lib/loyverse.js';
const base={firstName:'Ana María',lastName:'Del Mar',marketing:false};
test('registro sin promociones admite celular vacío y descarta cumpleaños',()=>{
  assert.deepEqual(profileInput({...base,birthDay:12,birthMonth:3}),{...base,phone:null,birthDay:null,birthMonth:null});
});
test('nombre y apellido son obligatorios, no se aceptan consentimientos ambiguos',()=>{
  for(const override of [{firstName:' '},{lastName:''},{marketing:'true'},{marketing:undefined}])assert.throws(()=>profileInput({...base,...override}));
});
test('promociones requieren celular y cumpleaños válido, incluido 29 de febrero',()=>{
  for(const override of [{phone:''},{birthDay:31,birthMonth:4},{birthDay:0},{birthMonth:13}])assert.throws(()=>profileInput({...base,marketing:true,phone:'987654321',birthDay:29,birthMonth:2,...override}));
  assert.equal(profileInput({...base,marketing:true,phone:'987 654 321',birthDay:29,birthMonth:2}).phone,'+51987654321');
});
test('retirar promociones elimina cumpleaños incluso si el cliente lo envía',()=>{
  const data=profileInput({...base,phone:'987654321',birthDay:4,birthMonth:5});assert.equal(data.birthDay,null);assert.equal(data.birthMonth,null);
});
test('catálogo respeta tienda, precio cero, variantes, bajas y venta por peso',()=>{
  const variant={variant_id:'v',default_price:38,default_pricing_type:'FIXED',stores:[{store_id:'store',available_for_sale:true,price:0}]};
  const item={item_name:'Ceviche',category_id:'cat',variants:[variant]};
  const result=catalogItems([item],[{id:'cat',name:'Ceviches'}],'store');assert.equal(result[0].p,0);assert.equal(result[0].c,'Ceviches');
  assert.deepEqual(catalogItems([item],[],'other'),[]);
  for(const changed of [{deleted_at:'today'},{sold_by_weight:true}])assert.deepEqual(catalogItems([{...item,...changed}],[],'store'),[]);
  assert.deepEqual(catalogItems([{...item,variants:[{...variant,deleted_at:'today'}]}],[],'store'),[]);
  assert.deepEqual(catalogItems([{...item,variants:[{...variant,stores:[{store_id:'store',available_for_sale:false}]}]}],[],'store'),[]);
});
test('el precio siempre proviene del servidor',()=>{
  assert.equal(pricedItems([{v:'v',q:2,p:0}],[{v:'v',n:'Plato',p:38}])[0].p,38);
  assert.throws(()=>pricedItems([{v:'inexistente',q:1}],[]));
});
test('pedidos rechazan duplicados, cantidades alteradas y factura incompleta',()=>{
  const order={tipo:'mesa',mesa:'04',metodo:'efectivo',requestId:crypto.randomUUID(),items:[{v:'v',q:1}],billing:{type:'boleta'}};
  assert.equal(orderInput(order).mesa,'04');
  for(const override of [{items:[{v:'v',q:1},{v:'v',q:1}]},{items:[{v:'v',q:-1}]},{items:[{v:'v',q:1.5}]},{billing:{type:'factura',document:'123'}},{mesa:''}])assert.throws(()=>orderInput({...order,...override}));
});

