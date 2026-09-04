import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../../site-config.js', import.meta.url), 'utf8');
const chat = fs.readFileSync(new URL('../../js/chat.js', import.meta.url), 'utf8');

test('veterans site uses only its dedicated Supabase project', () => {
  assert.match(config, /https:\/\/qnwhxcbjukzzrjoykpau\.supabase\.co/);
  assert.doesNotMatch(config, /zljduaahbyxnuglbugar/);
  assert.doesNotMatch(config, /backend-paused/);
  assert.match(chat, /veterans-chat-post/);
  assert.match(chat, /veterans_chat_messages/);
});
