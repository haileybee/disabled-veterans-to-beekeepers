const screens=Array.from(document.querySelectorAll('[data-site-screen]'));
const navLinks=Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
const screenIds=new Set(screens.map(screen=>screen.id));

function screenFromHash(){
  const requested=String(location.hash||'').replace(/^#/,'');
  return screenIds.has(requested)?requested:'home';
}

function setActiveScreen(id,{scroll=true}={}){
  const activeId=screenIds.has(id)?id:'home';
  screens.forEach(screen=>{screen.hidden=screen.id!==activeId;});
  navLinks.forEach(link=>{
    const active=link.getAttribute('href')===`#${activeId}`;
    if(active)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  document.body.dataset.activeScreen=activeId;
  if(scroll)window.scrollTo({top:0,left:0,behavior:'auto'});
}

function syncFromLocation(){
  const requested=String(location.hash||'').replace(/^#/,'');
  const activeId=screenFromHash();
  if(requested&&requested!==activeId){
    history.replaceState(null,'',`${location.pathname}${location.search}#${activeId}`);
  }
  setActiveScreen(activeId);
}

document.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener('click',()=>{
    const id=String(link.getAttribute('href')||'').replace(/^#/,'');
    if(screenIds.has(id)&&location.hash===`#${id}`)setActiveScreen(id);
  });
});

window.addEventListener('hashchange',syncFromLocation);
window.addEventListener('popstate',syncFromLocation);
syncFromLocation();
