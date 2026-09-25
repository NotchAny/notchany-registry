import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorPage, contributorPage, detailPage, notFoundPage } from '../scripts/site-template.mjs';

const item = { package_id: 'owner/tool', names: { 'zh-Hans': '工具', en: 'Tool' },
  summaries: { 'zh-Hans': '介绍', en: 'Description' }, kind: 'widget',
  version: '1.0.0', icon_path: 'packages/owner/tool/icon.png' };

test('author pages preserve nested assets, package links and language routes', () => {
  for (const lang of ['zh', 'en']) {
    const root = lang === 'zh' ? '../../' : '../../../';
    const html = authorPage({ lang, namespace: 'owner', packages: [item], css: '', js: '' });
    assert.ok(html.includes(`src="${root}assets/${item.icon_path}"`));
    assert.ok(html.includes(`href="${root}${lang === 'en' ? 'en/' : ''}packages/owner/tool/"`));
    assert.ok(html.includes(`href="${root}en/authors/owner/"`));
    assert.ok(html.includes(`href="${root}authors/owner/"`));
    assert.match(html, /class="profile-layout"/);
    assert.match(html, /class="profile-sidebar"/);
    assert.match(html, /class="profile-content"/);
    assert.match(html, /class="profile-github-link" href="https:\/\/github\.com\/owner"[^>]*><svg/);
    assert.doesNotMatch(html, />GitHub (?:主页|profile)<\/a>/);
    assert.doesNotMatch(html, /class="breadcrumbs"|profile-verified|data-author-first-package|data-author-verified/);
    for (const kind of ['all', 'widget', 'action']) {
      assert.match(html, new RegExp(`data-profile-kind="${kind}"[^>]+aria-pressed="${kind === 'all'}"`));
    }
    assert.match(html, /class="row-detail-link"/);
    assert.ok(html.includes(`href="notchany://market/package/owner/tool" data-fallback-url="${root}${lang === 'en' ? 'en/' : ''}download/"`));
  }
});

test('author labels escape content and empty pages remain usable', () => {
  const html = authorPage({ lang: 'zh', namespace: 'owner',
    packages: [{ ...item, names: { 'zh-Hans': '<script>bad</script>' } }], css: '', js: '' });
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  const escapedNamespace = authorPage({ lang: 'zh', namespace: 'x"><img', packages: [], css: '', js: '' });
  assert.match(escapedNamespace, /<h1>@x&quot;&gt;&lt;img<\/h1>/);
  assert.doesNotMatch(escapedNamespace, /<h1>@x"><img/);
  const empty = authorPage({ lang: 'en', namespace: 'owner', packages: [], css: '', js: '' });
  assert.match(empty, /No published packages/);
});

test('404 has a truthful message and depth-independent return links', () => {
  const html = notFoundPage({ css: '' });
  assert.match(html, /页面不存在/);
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /href="https:\/\/notchany.com\/"/);
  assert.match(html, /src="\/assets\/app-icon\.png\?v=balanced-20260925"/);
  assert.doesNotMatch(html, /class="hero-band"|__NOTCHANY_STORE__|href="\.\./);
});

test('contributor pages retain same-origin API configuration and language routes', () => {
  for (const lang of ['zh', 'en']) {
    const html = contributorPage({ lang, packages: [item], histories: {}, marketAPIBase: '/', css: '', js: '' });
    assert.match(html, /"market_api":"\/"/);
    assert.match(html, /id="profile-name"/);
    assert.match(html, /class="profile-layout"/);
    assert.match(html, /class="profile-sidebar"/);
    assert.match(html, /class="profile-content"/);
    assert.match(html, /id="profile-github"[^>]+hidden><svg/);
    assert.match(html, /en\/contributors\//);
    assert.match(html, /id="profile-manage"[^>]+hidden/);
    assert.doesNotMatch(html, /class="breadcrumbs"|profile-verified/);
  }
});

test('package authors and release identities link to distinct namespace and numeric pages', () => {
  const html = detailPage({ lang: 'zh', item, packages: [item], marketAPIBase: '/', css: '', js: '',
    history: { releases: [], contributors: [{ github_user_id: '12345', login: 'renamed-owner' }] } });
  assert.match(html, /href="\.\.\/\.\.\/\.\.\/authors\/owner\/"/);
  assert.match(html, /contributors\/\?id=12345/);
  assert.match(html, /data-market-api="\/"/);
});

test('detail pages omit screenshots, show install counts and keep contributors in the sidebar', () => {
  const html = detailPage({ lang: 'zh', item: { ...item, screenshots: ['screenshots/detail.png'] },
    packages: [item], marketAPIBase: '/', countsURL: 'https://counts.example/counts.json', css: '', js: '',
    history: { releases: [], contributors: [{ github_user_id: '12345', login: 'helper' }] } });

  assert.doesNotMatch(html, /class="screenshots"|screenshots-title|screenshots\/detail\.png/);
  assert.match(html, /class="detail-install-meta" data-download-count="owner\/tool" data-count-style="installs-inline"/);
  const aside = html.slice(html.indexOf('<aside class="side-info"'), html.indexOf('</aside>') + '</aside>'.length);
  assert.match(aside, /class="side-community"/);
  assert.match(aside, /class="contributor-roster"/);
  assert.match(aside, /data-github-user-id="12345"/);
});

test('dynamic contributor packages use the same filters, detail links and install actions', () => {
  const profile = new URL('../site/profile.js', import.meta.url);
  const source = requireSource(profile);
  const store = requireSource(new URL('../site/store.js', import.meta.url));

  assert.match(source, /let activeKind = 'all'/);
  assert.match(source, /button\.dataset\.profileKind/);
  assert.match(source, /el\('a', 'row-detail-link', item\.name\)/);
  assert.match(source, /el\('a', 'open-button install-button'/);
  assert.match(source, /install\.dataset\.fallbackUrl = item\.download_href/);
  assert.doesNotMatch(source, /profile-preview|item\.screenshot|profile-verified/);
  assert.match(store, /event\.target\.closest\("a\[data-fallback-url\]"\)/);
});

function requireSource(url) {
  return readFileSync(url, 'utf8');
}
