import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newDb } from 'pg-mem';
import { useTestPool } from '../lib/db.js';
import * as customer from '../api/customer.js';
import * as order from '../api/order.js';
import * as menu from '../api/menu.js';
import * as admin from '../api/admin.js';
process.env.NODE_ENV='test';process.env.LOYVERSE_TOKEN='test-only';process.env.LOYVERSE_STORE_ID='store';process.env.ADMIN_PASSWORD='test-admin-only';process.env.PAY_EFECTIVO_ID='cash';
const memory=newDb(),adapter=memory.adapters.createPg(),pool=new adapter.Pool();useTestPool(pool);
await pool.query(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
let receiptPosts=0,upstreamUnavailable=false;
globalThis.fetch=async(url,options={})=>{
  if(upstreamUnavailable)return Response.json({error:'unavailable'},{status:503});
  if(url.includes('/items'))return Response.json({items:[{item_name:'Ceviche',category_id:'cat',variants:[{variant_id:'v',default_pricing_type:'FIXED',default_price:38,stores:[{store_id:'store',available_for_sale:true,pricing_type:'FIXED',price:38}]}]}]});
  if(url.includes('/categories'))return Response.json({categories:[{id:'cat',name:'Ceviches'}]});
  if(url.endsWith('/receipts')&&options.method==='POST'){receiptPosts++;return Response.json({receipt_number:'TEST-1'});}
  throw new Error('Unexpected upstream request: '+url);
};
const request=(path,method='GET',payload,token,extra={})=>new Request('https://local.test/api/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},...(payload?{body:JSON.stringify(payload)}:{})});
const profile={firstName:'Cliente',lastName:'Prueba',marketing:false};
let token,otherToken,orderId;
test('API real: registra sin celular, guarda consentimiento, protege perfil y permite retirar promociones',async()=>{
  let response=await customer.POST(request('customer','POST',{...profile,marketing:true}));assert.equal(response.status,400);
  response=await customer.POST(request('customer','POST',profile));assert.equal(response.status,201);({token}=await response.json());
  assert.equal((await pool.query('SELECT * FROM consentimientos')).rows[0].aceptado,false);
  assert.equal((await customer.GET(request('customer'))).status,401);
  response=await customer.PATCH(request('customer','PATCH',{...profile,phone:'987654321',marketing:true,birthDay:29,birthMonth:2},token));assert.equal(response.status,200);
  assert.equal((await pool.query('SELECT * FROM clientes')).rows[0].promociones,true);
  response=await customer.PATCH(request('customer','PATCH',{...profile,phone:'987654321',birthDay:29,birthMonth:2},token));assert.equal(response.status,200);
  const row=(await pool.query('SELECT * FROM clientes')).rows[0];assert.equal(row.cumple_dia,null);assert.equal(row.cumple_mes,null);assert.equal(row.promociones,false);
  assert.equal((await pool.query('SELECT * FROM consentimientos')).rows.length,3);
  response=await customer.POST(request('customer','POST',profile));otherToken=(await response.json()).token;
});
test('API real: carga catálogo, guarda pedido con precio del servidor y evita duplicados',async()=>{
  const response=await menu.GET(request('menu'));assert.equal(response.status,200);assert.equal((await response.json()).m[0].p,38);
  const payload={tipo:'mesa',mesa:'04',metodo:'efectivo',requestId:crypto.randomUUID(),items:[{v:'v',q:2,p:0}],billing:{type:'boleta'}};
  assert.equal((await order.POST(request('order','POST',payload,token,{'x-expected-total':'0'}))).status,409);
  let saved=await order.POST(request('order','POST',payload,token,{'x-expected-total':'76'}));assert.equal(saved.status,201);const data=await saved.json();orderId=data.id;assert.equal(Number(data.total),76);
  saved=await order.POST(request('order','POST',payload,token,{'x-expected-total':'76'}));assert.equal((await saved.json()).id,orderId);
  assert.equal((await pool.query('SELECT * FROM pedidos')).rows.length,1);
  assert.equal((await order.GET(request('order?id='+orderId,'GET',null,otherToken))).status,404);
  assert.equal((await order.GET(request('order?id='+orderId,'GET',null,token))).status,200);
});
test('API real: catálogo no cae a demo y solo personal autorizado registra cobro una vez',async()=>{
  upstreamUnavailable=true;assert.equal((await menu.GET(request('menu'))).status,503);upstreamUnavailable=false;
  assert.equal((await admin.GET(request('admin'))).status,401);
  const headers={'x-clave':'test-admin-only'};
  const payload={accion:'cobrar',id:orderId,metodo:'efectivo'};
  let response=await admin.POST(request('admin','POST',payload,null,headers));assert.equal(response.status,200);assert.equal((await response.json()).receipt,'TEST-1');
  response=await admin.POST(request('admin','POST',payload,null,headers));assert.equal(response.status,200);assert.equal(receiptPosts,1);
  const stored=(await pool.query('SELECT * FROM pedidos')).rows[0];assert.equal(stored.estado,'cerrado');assert.equal(stored.sync_state,'done');
});

