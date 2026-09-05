import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterChatMessages} from '../../js/admin-chat-search.js';

const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const router=fs.readFileSync(new URL('../../js/screen-navigation.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8');

const screenIds=['home','about','story','hive-stories','shop','community','contact','admin'];

test('site keeps isolated top-level screens with Mission and Support folded into Home',()=>{
  for(const id of screenIds)assert.match(html,new RegExp(`<section[^>]*id="${id}"[^>]*data-site-screen`));
  assert.doesNotMatch(html,/<section[^>]*id="mission"[^>]*data-site-screen/);
  assert.doesNotMatch(html,/<section[^>]*id="support"[^>]*data-site-screen/);
  const nav=html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.doesNotMatch(nav,/href="#mission"/);
  assert.doesNotMatch(nav,/href="#support"/);
  assert.match(html,/id="mission"[^>]*data-home-section/);
  assert.match(html,/id="support"[^>]*data-home-section/);
});

test('Home keeps Donald text and uses PayPal buttons instead of a raw donation URL',()=>{
  assert.match(html,/Help Disabled Veterans Find Purpose Through Beekeeping/);
  assert.match(html,/Hello, my name is Donald Schafer, and I’m a disabled U\.S\. Veteran and proud owner of Schafer Farms\./);
  assert.match(html,/This isn’t just a fundraiser — it’s a movement\. A mission\. A chance to give veterans their purpose back and help the earth heal in the process\./);
  assert.match(html,/Donate With PayPal/);
  assert.match(html,/business=E6Y3STY5WYUGU/);
  assert.doesNotMatch(html,/class="home-paypal-link"/);
  assert.doesNotMatch(html,/gofund/i);
});

test('About Don contains the full on-site story and keeps the original article as a source',()=>{
  assert.match(html,/Keeper of the Bees/);
  assert.match(html,/20-acre farm/);
  assert.match(html,/starter beekeeping kits/);
  assert.match(html,/veteran beekeeping network/);
  assert.match(html,/Source: Sweet Mountain Farm/);
  assert.match(html,/sweetmountainfarm\.com\/index\.php\/new\/up-veteran-beekeeper/);
  assert.doesNotMatch(html,/Read Don's Story/);
});

test('screen router supports hidden-state isolation, active nav, browser history, and legacy Home anchors',()=>{
  assert.match(router,/\.hidden=/);
  assert.match(router,/aria-current/);
  assert.match(router,/hashchange/);
  assert.match(router,/popstate/);
  assert.match(router,/history\.replaceState/);
  assert.match(router,/homeSectionIds/);
  assert.match(router,/scrollIntoView/);
});

test('chat search matches display name or message text only',()=>{
  const messages=[
    {id:'1',display_name:'Tester',body:'Checking the hive',guest_id:'special-guest',created_at:'2026-09-04T12:00:00Z'},
    {id:'2',display_name:'Donald',body:'Welcome everyone',guest_id:'tester-id',created_at:'2026-09-04T13:00:00Z'},
    {id:'3',display_name:'Hailey',body:null,guest_id:'bee-name',created_at:'2026-09-04T14:00:00Z'},
  ];
  assert.deepEqual(filterChatMessages(messages,'tester').map(m=>m.id),['1']);
  assert.deepEqual(filterChatMessages(messages,'HIVE').map(m=>m.id),['1']);
  assert.deepEqual(filterChatMessages(messages,'special-guest').map(m=>m.id),[]);
  assert.deepEqual(filterChatMessages(messages,'2026').map(m=>m.id),[]);
  assert.deepEqual(filterChatMessages(messages,'').map(m=>m.id),['1','2','3']);
});

test('community admin exposes live search controls and empty-result copy',()=>{
  assert.match(admin,/Search Community Chat/);
  assert.match(admin,/admin-chat-search/);
  assert.match(admin,/No matching messages\./);
  assert.match(admin,/filterChatMessages/);
});
