import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync(new URL('../../js/auth.js',import.meta.url),'utf8');

test('admin gate uses username and password instead of email magic links',()=>{
  assert.match(auth,/name="username"/);
  assert.match(auth,/name="password"/);
  assert.match(auth,/type="password"/);
  assert.match(auth,/veterans-admin-login/);
  assert.doesNotMatch(auth,/signInWithOtp/);
  assert.doesNotMatch(auth,/Email Sign-In Link/);
});
