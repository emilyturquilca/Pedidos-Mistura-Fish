import { profileInput, orderInput, pricedItems } from './validation.js';
const demoCatalog = [
  {v:'demo-ceviche',n:'Ceviche Clásico Mistura',p:38,c:'Ceviches y tiraditos',d:'Pesca del día en leche de tigre al ají limo, choclo y camote. El clásico que siempre provoca.'},
  {v:'demo-tiradito',n:'Tiradito Bicolor',p:42,c:'Ceviches y tiraditos',d:'Finas láminas de pescado en dos cremas de la casa: ají amarillo y rocoto.'},
  {v:'demo-arroz',n:'Arroz con Mariscos',p:45,c:'Especialidades',d:'Arroz al punto, mariscos salteados y el inconfundible sabor de nuestra cocina.'},
  {v:'demo-causa',n:'Causa de la Casa',p:28,c:'Causas',d:'Papa amarilla al limón, palta y un relleno fresco para empezar a compartir.'},
  {v:'demo-jalea',n:'Jalea para Compartir',p:65,c:'Especialidades',d:'Pescado y mariscos crocantes, yuca dorada y sarza criolla. Para disfrutar en compañía.'},
  {v:'demo-chicha',n:'Chicha Morada · Jarra',p:18,c:'Bebidas',d:'El acompañamiento de siempre, preparado en casa y servido bien frío.'}
];
export function createDemoHandler(){
  const sessions=new Map(),orders=new Map();let orderNumber=100;
  const json=(data,status=200)=>Response.json(data,{status});
  return async request=>{
    const url=new URL(request.url),route=url.pathname.split('/').pop();
    const token=request.headers.get('authorization')?.replace(/^Bearer /,''),profile=sessions.get(token);
    try{
      if(route==='menu')return json({m:demoCatalog,nombre:'Mistura Fish',envio:5,yape:'',contacto:'',demo:true});
      if(route==='customer'&&request.method==='POST'){
        const input=profileInput(await request.json());const newToken=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');sessions.set(newToken,input);return json({token:newToken,profile:input},201);
      }
      if(!profile)return json({error:'Tu sesión de prueba terminó. Vuelve a ingresar tus datos.'},401);
      if(route==='customer'&&request.method==='GET')return json({profile});
      if(route==='customer'&&request.method==='PATCH'){const input=profileInput(await request.json());sessions.set(token,input);return json({profile:input});}
      if(route==='order'&&request.method==='POST'){
        const input=orderInput(await request.json());
        if((input.tipo==='delivery'||input.transactionalWhatsapp)&&!profile.phone)return json({error:'Agrega un celular en Mis datos para el delivery o las notificaciones.'},400);
        const existing=[...orders.values()].find(o=>o.requestId===input.requestId&&o.token===token);if(existing)return json({id:existing.id,total:existing.total});
        const items=pricedItems(input.items,demoCatalog),total=items.reduce((n,i)=>n+i.p*i.q,0)+(input.tipo==='delivery'?5:0);
        if(Number(request.headers.get('x-expected-total'))!==total)return json({error:'Actualiza la carta y revisa el total.'},409);
        const order={id:++orderNumber,token,requestId:input.requestId,total,estado:'nuevo',metodo:input.metodo};orders.set(String(order.id),order);return json({id:order.id,total},201);
      }
      if(route==='order'&&request.method==='GET'){const order=orders.get(url.searchParams.get('id'));return order?.token===token?json({id:order.id,total:order.total,estado:order.estado,metodo:order.metodo}):json({error:'Pedido de prueba no encontrado.'},404);}
      return json({error:'Esta función no está disponible en la vista de prueba.'},404);
    }catch(error){return json({error:error.message},error.status||400);}
  };
}

