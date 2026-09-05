const screens=Array.from(document.querySelectorAll('[data-site-screen]'));
const navLinks=Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
const screenIds=new Set(screens.map(screen=>screen.id));
const homeSectionIds=new Set(Array.from(document.querySelectorAll('[data-home-section]')).map(section=>section.id));

function requestedHash(){return String(location.hash||'').replace(/^#/,'');}
function screenFromHash(){const requested=requestedHash();if(screenIds.has(requested))return requested;if(homeSectionIds.has(requested))return'home';return'home';}

function setActiveScreen(id,{scroll=true,anchorId=null}={}){
  const activeId=screenIds.has(id)?id:'home';
  screens.forEach(screen=>{screen.hidden=screen.id!==activeId;});
  navLinks.forEach(link=>{
    const active=link.getAttribute('href')===`#${activeId}`;
    if(active)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  document.body.dataset.activeScreen=activeId;
  if(!scroll)return;
  if(anchorId&&homeSectionIds.has(anchorId)){
    requestAnimationFrame(()=>document.getElementById(anchorId)?.scrollIntoView({behavior:'auto',block:'start'}));
  }else{
    window.scrollTo({top:0,left:0,behavior:'auto'});
  }
}

function syncFromLocation(){
  const requested=requestedHash();
  const activeId=screenFromHash();
  const homeAnchor=homeSectionIds.has(requested)?requested:null;
  if(requested&&!screenIds.has(requested)&&!homeAnchor){
    history.replaceState(null,'',`${location.pathname}${location.search}#home`);
  }
  setActiveScreen(activeId,{anchorId:homeAnchor});
}

document.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener('click',()=>{
    const id=String(link.getAttribute('href')||'').replace(/^#/,'');
    if(location.hash!==`#${id}`)return;
    if(screenIds.has(id))setActiveScreen(id);
    else if(homeSectionIds.has(id))setActiveScreen('home',{anchorId:id});
  });
});

window.addEventListener('hashchange',syncFromLocation);
window.addEventListener('popstate',syncFromLocation);
syncFromLocation();
