import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const pages = [
  'index.html',
  'schafer-brothers.html',
  'hive-stories.html',
  'shop.html',
  'community.html',
  'support.html',
  'contact.html',
  'admin.html'
];
const navTargets = [...pages];

for (const page of pages) {
  test(`${page} has shared page navigation`, () => {
    assert.equal(fs.existsSync(new URL(page, root)), true);
    const html = fs.readFileSync(new URL(page, root), 'utf8');
    for (const href of navTargets) {
      assert.match(html, new RegExp(`href=["']${href.replace('.', '\\.')}`));
    }
    assert.doesNotMatch(html, /href=["']#(?:about|story|hive-stories|mission|shop|community|support|contact|admin)/);
  });
}

test('home contains About Don and Our Mission and excludes full feature screens', () => {
  const html = fs.readFileSync(new URL('index.html', root), 'utf8');
  assert.match(html, /About Don/);
  assert.match(html, /Our Mission/);
  assert.doesNotMatch(html, /id="community"/);
  assert.doesNotMatch(html, /id="shop"/);
  assert.doesNotMatch(html, /id="admin"/);
});

test('feature pages load their required feature modules', () => {
  const community = fs.readFileSync(new URL('community.html', root), 'utf8');
  const shop = fs.readFileSync(new URL('shop.html', root), 'utf8');
  const hive = fs.readFileSync(new URL('hive-stories.html', root), 'utf8');
  const admin = fs.readFileSync(new URL('admin.html', root), 'utf8');
  assert.match(community, /js\/chat\.js/);
  assert.match(shop, /js\/store\.js/);
  assert.match(shop, /js\/checkout\.js/);
  assert.match(hive, /js\/hive-stories\.js/);
  assert.match(admin, /js\/auth\.js/);
  assert.match(admin, /js\/admin\.js/);
  assert.match(admin, /js\/hive-admin\.js/);
});

test('About Don and The Mission are not separate primary nav destinations', () => {
  const html = fs.readFileSync(new URL('index.html', root), 'utf8');
  const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.doesNotMatch(nav, />About Don</);
  assert.doesNotMatch(nav, />The Mission</);
});
