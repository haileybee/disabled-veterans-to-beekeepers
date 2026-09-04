import{getSupabaseClient}from'./supabase-client.js';
const client=getSupabaseClient();
let adminState={user:null,approved:false,role:null,adminId:null};
export function normalizeEmail(value=''){return String(value).trim().toLowerCase();}
export function getAdminState(){return{...adminState};}
function escapeHtml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function redirectUrl(){return`${location.origin}${location.pathname}#admin`;}
export function renderAdminGate(state){
  if(!state.user)return`<div class="admin-gate-card"><div><h3>Owner & Admin Sign In</h3><p>Site management is restricted to approved owner and admin emails.</p><form id="admin-email-form" class="admin-email-form"><label>Email<input name="email" type="email" autocomplete="email" required placeholder="approved@email.com"></label><button class="gold-cta compact" type="submit">Email Me a Sign-In Link</button><p id="admin-email-status" class="admin-form-status"></p></form><button class="outline-button" type="button" data-google-signin>Or sign in with Google</button></div></div>`;
  if(!state.approved)return`<div class="admin-gate-card"><h3>Access not approved</h3><p>This account is not approved for admin access.</p><button class="outline-button" type="button" data-admin-signout>Sign Out</button></div>`;
  return`<div class="admin-gate-card approved"><div><p class="eyebrow">Private Admin</p><h3>Admin Dashboard</h3><p>Signed in as ${escapeHtml(state.user.email||'')}</p></div><button class="outline-button" type="button" data-admin-signout>Sign Out</button></div><div id="admin-tools"></div>`;
}
async function resolveAdminState(session){const user=session?.user||null;if(!user?.email)return{user,approved:false,role:null,adminId:null};const email=normalizeEmail(user.email);const{data,error}=await client.from('veterans_admins').select('id,email,role,active').eq('email',email).eq('active',true).maybeSingle();if(error)console.error('Admin permission check failed',error);return{user,approved:Boolean(data),role:data?.role||null,adminId:data?.id||null};}
function emitState(){window.dispatchEvent(new CustomEvent('admin-state-changed',{detail:getAdminState()}));}
async function refreshGate(sessionOverride){const session=sessionOverride??(await client.auth.getSession()).data.session;adminState=await resolveAdminState(session);const gate=document.getElementById('admin-gate');if(gate){gate.innerHTML=renderAdminGate(adminState);gate.querySelector('[data-google-signin]')?.addEventListener('click',signInWithGoogle);gate.querySelector('[data-admin-signout]')?.addEventListener('click',signOutAdmin);gate.querySelector('#admin-email-form')?.addEventListener('submit',sendMagicLink);}emitState();}
export async function signInWithGoogle(){const{error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectUrl()}});if(error)throw error;}
async function sendMagicLink(event){event.preventDefault();const form=event.currentTarget;const status=form.querySelector('#admin-email-status');status.textContent='Sending secure sign-in link…';const email=normalizeEmail(form.email.value);try{const{error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectUrl(),shouldCreateUser:true}});if(error)throw error;status.textContent='Check your email for the secure sign-in link.';}catch(error){status.textContent=error.message;}}
export async function signOutAdmin(){await client.auth.signOut();await refreshGate(null);}
client.auth.onAuthStateChange((_event,session)=>{queueMicrotask(()=>refreshGate(session));});
refreshGate().catch(error=>{console.error(error);const gate=document.getElementById('admin-gate');if(gate)gate.innerHTML='<div class="status-error">Admin sign-in is temporarily unavailable.</div>';});
