const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('es-PE', { style:'currency',currency:'PEN' }).format(value);
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const state = { view:'welcome',profile:null,token:sessionStorage.getItem('mf_session') || '',items:[],cart:{},category:'Todos',search:'',config:{},editing:false,requestId:crypto.randomUUID(),orderId:sessionStorage.getItem('mf_order') || '',loading:false };
let pollTimer, toastTimer;
$('birthMonth').insertAdjacentHTML('beforeend', months.map((m,i) => `<option value="${i+1}">${m}</option>`).join(''));
function toast(message) { $('toast').textContent=message; $('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000); }
async function api(path, options={}) {
  const response = await fetch('/api/'+path, { ...options, headers:{ 'Content-Type':'application/json',...(state.token ? {Authorization:'Bearer '+state.token}:{}),...options.headers } });
  let data;try { data=await response.json(); } catch { throw new Error('No pudimos conectar con el servicio. Intenta nuevamente.'); }
  if (!response.ok) {
    if(response.status===401 && !path.startsWith('customer')) { state.profile=null;state.token='';sessionStorage.removeItem('mf_session');show('welcome'); }
    throw new Error(data.error || 'No pudimos completar la solicitud.');
  }
  return data;
}
const cartItems = () => state.items.filter(i=>state.cart[i.v]).map(i=>({...i,q:state.cart[i.v]}));
const subtotal = () => Math.round(cartItems().reduce((n,i)=>n+i.p*i.q,0)*100)/100;
const mode = () => document.querySelector('[name=tipo]:checked').value;
const shipping = () => mode()==='delivery' ? Number(state.config.envio)||0 : 0;
const total = () => Math.round((subtotal()+shipping())*100)/100;
function show(view) {
  if (view!=='welcome' && !state.profile) view='welcome';
  if(view==='checkout' && !cartItems().length) { toast('Elige tus platos favoritos para comenzar.');view='menu'; }
  state.view=view;
  for(const name of ['welcome','menu','checkout','status']) $(name+'-view').hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.disabled=button.dataset.view!=='welcome' && !state.profile;
    if(button.dataset.view===view || (view==='status' && button.dataset.view==='checkout'))button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });
  $('profile-button').hidden=!state.profile;
  if(view==='menu') { $('greeting').textContent=`Hola, ${state.profile.firstName}. Elige tus favoritos y disfruta.`;renderCatalog(); }
  if(view==='checkout')renderSummary();
  if(view==='status')refreshStatus();
  clearInterval(pollTimer);
  if(view==='status')pollTimer=setInterval(refreshStatus,12000);
  renderDock();window.scrollTo({top:0,behavior:'instant'});
  const heading=$(view+'-view').querySelector('h1,h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
}
function updateMarketing() {
  const enabled=$('marketing').checked;
  $('birthday-fields').hidden=!enabled;$('birthday-fields').disabled=!enabled;
  $('birthDay').required=$('birthMonth').required=$('phone').required=enabled;
  $('phone-label').textContent=enabled?'*':'(opcional)';
  if(!enabled){$('birthDay').value='';$('birthMonth').value='';}
}
function editProfile() {
  state.editing=!!state.profile;
  const p=state.profile||{};
  for(const key of ['firstName','lastName','phone','birthDay','birthMonth'])$(key).value=p[key]||'';
  $('marketing').checked=p.marketing===true;updateMarketing();
  $('welcome-title').textContent=state.editing?'Tus datos, tu decisión.':'Primero, conozcámonos.';
  $('welcome-description').textContent=state.editing?'Actualiza tus datos o cambia tus preferencias de promociones.':'Cuéntanos cómo te llamas y descubre nuestra carta.';
  $('profile-submit').textContent=state.editing?'Guardar mis datos →':'Ver la carta →';
  $('profile-cancel').hidden=!state.editing;$('profile-error').textContent='';
  state.returnView=state.view==='welcome'?'menu':state.view;show('welcome');
}
$('marketing').addEventListener('change',updateMarketing);
$('profile-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('profile-submit');button.disabled=true;$('profile-error').textContent='';
  try {
    const profile={firstName:$('firstName').value,lastName:$('lastName').value,phone:$('phone').value,marketing:$('marketing').checked,birthDay:$('birthDay').value,birthMonth:$('birthMonth').value};
    const result=await api('customer',{method:state.editing?'PATCH':'POST',body:JSON.stringify(profile)});
    if(result.token){state.token=result.token;sessionStorage.setItem('mf_session',state.token);}
    state.profile=result.profile;
    const destination=state.editing?(state.returnView||'menu'):'menu';
    if(state.editing)toast(profile.marketing?'Datos y preferencias guardados.':'Datos guardados. No recibirás promociones.');
    if(!state.items.length)await loadMenu();show(destination);
  }catch(error){$('profile-error').textContent=error.message;}
  finally {button.disabled=false;}
});
$('profile-button').onclick=editProfile;
$('profile-cancel').onclick=()=>show(state.returnView||'menu');
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>button.dataset.view==='welcome'?editProfile():show(button.dataset.view));
$('brand').onclick=event=>{event.preventDefault();show(state.profile?'menu':'welcome');};
function renderDock(){const count=cartItems().reduce((n,i)=>n+i.q,0);$('cart-dock').hidden=state.view!=='menu'||!count;$('cart-count').textContent=`${count} ${count===1?'plato en tu pedido':'platos en tu pedido'}`;$('cart-total').textContent=money(subtotal());document.body.classList.toggle('has-cart',!$('cart-dock').hidden);}
function controls(item,compact=false){const q=state.cart[item.v]||0;return q?`<div class="stepper"><button type="button" data-change="-1" data-product="${esc(item.v)}" aria-label="Quitar uno de ${esc(item.n)}">−</button><output aria-label="Cantidad">${q}</output><button type="button" data-change="1" data-product="${esc(item.v)}" aria-label="Añadir uno de ${esc(item.n)}" ${q>=20?'disabled':''}>+</button></div>`:compact?'':`<button class="add-button" type="button" data-change="1" data-product="${esc(item.v)}" aria-label="Añadir ${esc(item.n)}">Añadir +</button>`;}
function renderCatalog(){
  const categories=['Todos',...new Set(state.items.map(i=>i.c))];
  $('categories').innerHTML=categories.map(c=>`<button class="chip" type="button" data-category="${esc(c)}" aria-pressed="${c===state.category}">${esc(c)}</button>`).join('');
  const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const items=state.items.filter(i=>(state.category==='Todos'||i.c===state.category)&&normal(i.n+' '+i.d).includes(normal(state.search)));
  $('products').innerHTML=items.map(i=>`<article class="product-card">${i.image?`<img class="product-photo" src="${esc(i.image)}" alt="${esc(i.n)}" loading="lazy" referrerpolicy="no-referrer">`:`<div class="product-placeholder" aria-hidden="true"><small>${state.config.demo?'Carta de ejemplo':'Sin foto disponible'}</small></div>`}<div class="product-info"><span class="eyebrow">${esc(i.c)}</span><h2>${esc(i.n)}</h2><p class="product-description">${esc(i.d)}</p><div class="product-action"><span class="price">${money(i.p)}</span>${controls(i)}</div></div></article>`).join('');
  $('products').querySelectorAll('img').forEach(img=>img.onerror=()=>{const placeholder=document.createElement('div');placeholder.className='product-placeholder';placeholder.setAttribute('aria-hidden','true');img.replaceWith(placeholder);});
  if(!state.loading && !state.menuError)$('menu-message').textContent=items.length?'':state.items.length?'No encontramos platos con esa búsqueda.':'La carta se está preparando. Consulta al personal.';
  renderDock();
}
async function loadMenu(){
  state.loading=true;$('refresh-menu').disabled=true;$('menu-message').textContent='Buscando lo mejor de nuestra carta…';
  try {
    const data=await api('menu');state.config=data;state.items=data.m||[];state.menuError=false;
    const ids=new Set(state.items.map(i=>i.v));let removed=false;
    for(const id of Object.keys(state.cart))if(!ids.has(id)){delete state.cart[id];removed=true;}
    if(removed)toast('Algunos platos ya no están disponibles y se retiraron del pedido.');
    if(state.category!=='Todos' && !state.items.some(i=>i.c===state.category))state.category='Todos';
    $('demo-banner').hidden=!data.demo;
    if(/^\+?\d{8,15}$/.test(data.contacto||'')){$('contact-link').href='https://wa.me/'+data.contacto.replace('+','');$('contact-link').hidden=false;}
    $('menu-message').textContent='';
  }catch(error){state.menuError=true;$('menu-message').textContent=error.message;}
  finally{state.loading=false;$('refresh-menu').disabled=false;renderCatalog();}
}
$('categories').onclick=event=>{const button=event.target.closest('[data-category]');if(button){state.category=button.dataset.category;renderCatalog();}};
$('search').oninput=()=>{state.search=$('search').value;renderCatalog();};
$('refresh-menu').onclick=loadMenu;
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-change]');if(!button)return;
  if(!state.items.some(i=>i.v===button.dataset.product))return;
  state.cart[button.dataset.product]=Math.max(0,Math.min(20,(state.cart[button.dataset.product]||0)+Number(button.dataset.change)));
  state.requestId=crypto.randomUUID();renderCatalog();
  if(state.view==='checkout'){renderSummary();if(!cartItems().length)show('menu');}
});
$('open-cart').onclick=()=>show('checkout');$('back-menu').onclick=()=>show('menu');
function renderSummary(){
  $('order-lines').innerHTML=cartItems().map(i=>`<div class="order-line"><div><b>${esc(i.n)}</b><small> · ${money(i.p)}</small>${controls(i,true)}</div><b>${money(i.p*i.q)}</b></div>`).join('');
  $('subtotal').textContent=money(subtotal());$('delivery-total').hidden=mode()!=='delivery';$('shipping').textContent=money(shipping());$('total').textContent=money(total());
  $('customer-summary').innerHTML=`<b>${esc(state.profile.firstName+' '+state.profile.lastName)}</b>${esc(state.profile.phone||'Sin celular de contacto')}<br><button type="button" class="inline-link" id="edit-summary">Editar mis datos</button>`;
  $('edit-summary').onclick=editProfile;
}
function updateMode(){const delivery=mode()==='delivery';$('table-field').hidden=delivery;$('delivery-fields').hidden=!delivery;$('table').required=!delivery;$('address').required=delivery;if(state.profile)renderSummary();}
document.querySelectorAll('[name=tipo]').forEach(r=>r.onchange=()=>{state.requestId=crypto.randomUUID();updateMode();});
document.querySelectorAll('[name=metodo]').forEach(r=>r.onchange=()=>{
  state.requestId=crypto.randomUUID();const yape=document.querySelector('[name=metodo]:checked').value==='yape';$('yape-details').hidden=!yape;
  $('yape-details').textContent=state.config.yape?`Yapea al ${state.config.yape}. El personal debe verificar el pago antes de marcarlo como recibido.`:'Consulta al personal el número oficial de Yape antes de transferir.';
});
document.querySelectorAll('[name=billingType]').forEach(r=>r.onchange=()=>{
  const invoice=r.value==='factura';$('document-label').firstChild.textContent=invoice?'RUC *':'DNI (opcional)';$('document').value='';$('document').maxLength=invoice?11:8;$('document').placeholder=invoice?'11 dígitos':'8 dígitos';$('document').required=invoice;$('company-label').hidden=!invoice;$('company').required=invoice;
});
$('order-form').addEventListener('input',()=>{state.requestId=crypto.randomUUID();});
$('order-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('order-submit');button.disabled=true;$('order-error').textContent='';
  try{
    const payload={requestId:state.requestId,tipo:mode(),mesa:$('table').value,direccion:$('address').value,metodo:document.querySelector('[name=metodo]:checked').value,nota:$('notes').value,items:cartItems().map(i=>({v:i.v,q:i.q})),transactionalWhatsapp:$('transactional').checked,billing:{type:document.querySelector('[name=billingType]:checked').value,document:$('document').value,company:$('company').value,email:$('email').value}};
    const result=await api('order',{method:'POST',headers:{'x-expected-total':String(total())},body:JSON.stringify(payload)});
    state.orderId=String(result.id);sessionStorage.setItem('mf_order',state.orderId);state.cart={};state.requestId=crypto.randomUUID();show('status');
  }catch(error){$('order-error').textContent=error.message;}
  finally{button.disabled=false;}
});
const statusNames={nuevo:'Recibido · esperando confirmación',preparando:'En preparación',listo:'¡Tu pedido está listo!',en_camino:'En camino',cerrado:'Entregado y pagado',cancelado:'Pedido cancelado'};
async function refreshStatus(){
  if(!state.orderId)return;
  $('status-reference').textContent='Pedido #'+state.orderId;
  try{
    const order=await api('order?id='+encodeURIComponent(state.orderId));
    $('status-detail').innerHTML=`<p class="status-current">${esc(statusNames[order.estado]||order.estado)}</p><b>Total: ${money(order.total)}</b>`;
    $('status-note').textContent=state.config.demo?'Demostración: este pedido solo existe durante la prueba.':order.estado==='cerrado'?'El personal registró tu pago.':'Tu pago sigue pendiente de confirmación por el personal. Puedes seguir el estado desde esta pantalla.';
    if(['cerrado','cancelado'].includes(order.estado))clearInterval(pollTimer);
  }catch(error){$('status-note').textContent=error.message;}
}
$('status-refresh').onclick=refreshStatus;$('new-order').onclick=()=>show('menu');
const privacy=()=>$('privacy-dialog').showModal();$('privacy-open').onclick=$('footer-privacy').onclick=privacy;$('privacy-close').onclick=()=>$('privacy-dialog').close();
const tableFromQr=new URLSearchParams(location.search).get('mesa')||'';
if(/^[\p{L}\p{N} -]{1,12}$/u.test(tableFromQr)){$('table').value=tableFromQr;$('table-label').textContent='Mesa '+tableFromQr+' · Salón';}
updateMode();
async function init(){
  // The menu carries an explicit demo marker; errors never switch production into demo.
  await loadMenu();
  if(state.token){try{const data=await api('customer');state.profile=data.profile;show(state.orderId?'status':'menu');}catch{state.token='';sessionStorage.removeItem('mf_session');sessionStorage.removeItem('mf_order');}}
}
init();

