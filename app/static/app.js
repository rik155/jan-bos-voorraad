function openModal(id){document.getElementById(id)?.classList.add('show')}
function closeModal(id){document.getElementById(id)?.classList.remove('show')}
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')}));

function showToast(text,isError=false){
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;toast.className='toast show'+(isError?' error':'');
  clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>toast.classList.remove('show'),1800);
}

async function quickBook(form){
  const productId=form.dataset.product;
  const button=form.querySelector('button');
  const card=form.closest('.product-card');
  const stockEl=card?.querySelector('.stock-value');
  const change=Number(form.querySelector('[name="change"]').value);
  button.disabled=true;
  try{
    const body=new FormData();body.append('change',String(change));
    const response=await fetch(`/api/products/${productId}/quick`,{method:'POST',body});
    const data=await response.json();
    if(!response.ok)throw new Error(data.detail||'Boeken mislukt');
    if(stockEl){stockEl.textContent=Number(data.stock).toLocaleString('nl-NL',{maximumFractionDigits:2});stockEl.dataset.stock=data.stock}
    if(card){card.classList.toggle('low',data.low);card.querySelector('.low-label')?.toggleAttribute('hidden',!data.low)}
    showToast(`${change>0?'+':''}${change} geboekt · voorraad ${data.stock}`);
  }catch(error){showToast(error.message||'Boeken mislukt',true)}finally{button.disabled=false}
}
document.querySelectorAll('.quick-form').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();quickBook(form)}));

const liveSearch=document.getElementById('liveSearch');
const categoryFilter=document.getElementById('categoryFilter');
function filterCards(){
  const query=(liveSearch?.value||'').trim().toLowerCase();
  const category=(categoryFilter?.value||'').trim().toLowerCase();
  let visible=0;
  document.querySelectorAll('#productGrid .product-card').forEach(card=>{
    const show=(!query||card.dataset.name.includes(query))&&(!category||card.dataset.category===category);
    card.hidden=!show;if(show)visible++;
  });
  const count=document.getElementById('visibleCount');if(count)count.textContent=visible;
}
liveSearch?.addEventListener('input',filterCards);
categoryFilter?.addEventListener('change',filterCards);

if('serviceWorker' in navigator){navigator.serviceWorker.register('/static/sw.js')}
