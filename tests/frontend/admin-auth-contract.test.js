import test from 'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const auth=fs.readFileSync(new URL('../../js/auth.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const adminCss=fs.readFileSync(new URL('../../css/admin-fix.css',import.meta.url),'utf8');

test('admin auth returns to production site instead of localhost',()=>{
  assert.match(auth,/https:\/\/haileybee\.github\.io\/disabled-veterans-to-beekeepers\//);
  assert.doesNotMatch(auth,/localhost:3000/);
});

test('admin dashboard exposes owner management tools',()=>{
  assert.match(admin,/Admin Home/);
  assert.match(admin,/Products/);
  assert.match(admin,/Orders/);
  assert.match(admin,/Hive Stories/);
  assert.match(admin,/Community/);
  assert.match(admin,/Approved Emails/);
});

test('index loads one admin module entrypoint',()=>{
  assert.match(html,/js\/admin\.js\?v=/);
  assert.doesNotMatch(html,/js\/auth\.js\?v=/);
  assert.doesNotMatch(html,/js\/hive-admin\.js\?v=/);
});

test('public admin area stays discreet before sign in',()=>{
  assert.doesNotMatch(html,/<p class="eyebrow">Private Management<\/p>/);
  assert.doesNotMatch(html,/<h2>Owner & Admin<\/h2>/);
  assert.match(auth,/Admin Sign In/);
  assert.match(auth,/Authorized staff only\./);
  assert.match(auth,/admin-gate-card discreet/);
});

test('private management heading appears only in approved admin state',()=>{
  assert.match(auth,/Private Management/);
  assert.match(auth,/Owner & Admin/);
  assert.match(auth,/manage products, orders, Hive Stories, community tools, and approved emails/);
  assert.match(auth,/admin-unlocked/);
});

test('discreet admin styles keep signed-out gate compact',()=>{
  assert.match(adminCss,/admin-gate-card\.discreet/);
  assert.match(adminCss,/admin-section\.admin-unlocked/);
  assert.match(adminCss,/a\[href="#admin"\]/);
});
