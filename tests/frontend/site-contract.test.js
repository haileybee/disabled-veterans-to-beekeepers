import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const config = fs.readFileSync(new URL('site-config.js', root), 'utf8');
const chat = fs.readFileSync(new URL('js/chat.js', root), 'utf8');

function read(page) {
  return fs.readFileSync(new URL(page, root), 'utf8');
}

test('site includes shop community admin and PayPal donation on their own screens', () => {
  assert.match(read('shop.html'), /id="shop"/);
  assert.match(read('community.html'), /id="community"/);
  assert.match(read('admin.html'), /id="admin"/);
  assert.match(read('support.html'), /data-paypal-donate/);
  assert.match(read('support.html'), /business=E6Y3STY5WYUGU/);
});

test('community feature contract remains one photo per message', () => {
  assert.match(chat, /imageDataUrl/);
  assert.doesNotMatch(chat, /imageDataUrls/);
});

test('committed config has no private credentials', () => {
  assert.doesNotMatch(config, /SERVICE_ROLE/);
  assert.doesNotMatch(config, /PAYPAL_CLIENT_SECRET/);
});

test('veterans site is isolated from MoMHQ and connected to its dedicated Supabase project', () => {
  assert.doesNotMatch(config, /zljduaahbyxnuglbugar/);
  assert.match(config, /qnwhxcbjukzzrjoykpau/);
  assert.match(config, /sb_publishable_/);
  assert.doesNotMatch(config, /backend-paused/);
});
