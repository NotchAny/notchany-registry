(() => {
  const config = window.__NOTCHANY_STORE__;
  if (!config) return;
  const account = document.querySelector('[data-account-link]');
  if (account && new URL(account.href).origin === location.origin) {
    fetch('/account/api/session').then(response => response.ok ? response.json() : null).then(session => {
      if (!session) return;
      const label = config.language === 'zh' ? (session.signed_in ? '我的账号' : '登录') : (session.signed_in ? 'My account' : 'Sign in');
      account.title = label; account.setAttribute('aria-label', label);
    }).catch(() => {});
  }
  const state = config.profile;
  if (!state) return;
  const zh = config.language === 'zh';
  const id = new URLSearchParams(location.search).get('id');
  const validID = id && /^[0-9]{1,20}$/.test(id);
  const byID = new Map(state.packages.map(item => [item.package_id, item]));
  const profiles = new Map();
  for (const history of Object.values(state.histories)) {
    for (const user of history.contributors || []) {
      if (/^[0-9]{1,20}$/.test(user.github_user_id)) profiles.set(user.github_user_id, user);
    }
  }
  const message = document.getElementById('profile-message');
  const directory = document.getElementById('profile-directory');
  let selectedPackages = state.namespace ? state.packages : [];
  let activeTab = 'packages';
  let activeKind = 'all';
  const roles = new Map();
  const el = (tag, className, text) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  function announce(text) { message.textContent = text; message.hidden = !text; }
  function displayProfile(user) {
    if (!user) return;
    document.getElementById('profile-name').textContent = user.login;
    document.title = '@' + user.login + ' · NotchAny Store';
    document.getElementById('profile-description').textContent = '@' + user.login;
    const github = document.getElementById('profile-github');
    github.href = 'https://github.com/' + encodeURIComponent(user.login); github.hidden = false;
    const avatar = document.getElementById('profile-avatar');
    avatar.textContent = user.login.slice(0, 1).toUpperCase();
    if (/^https:\/\/avatars\.githubusercontent\.com\//.test(user.avatar_url || '')) {
      const image = el('img'); image.src = user.avatar_url; image.alt = ''; image.width = 184; image.height = 184;
      image.addEventListener('error', () => avatar.replaceChildren(document.createTextNode(user.login.slice(0, 1).toUpperCase())));
      avatar.replaceChildren(image);
    }
  }
  function matches(item) {
    const q = document.getElementById('profile-search').value.trim().toLocaleLowerCase();
    return (!q || (item.search || item.name).toLocaleLowerCase().includes(q)) && (activeKind === 'all' || activeKind === item.kind);
  }
  function packageCard(item) {
    const row = el('article', 'package-row profile-package-row');
    const image = el('img', 'package-icon'); image.src = item.icon; image.alt = ''; image.width = 54; image.height = 54;
    const content = el('div', 'row-copy');
    const heading = el('div', 'row-title');
    const title = el('h3'); const detail = el('a', 'row-detail-link', item.name); detail.href = item.href;
    title.append(detail); heading.append(title, el('span', 'kind-mark', item.kind_label));
    content.append(heading, el('p', 'row-summary', item.summary), el('div', 'row-meta', 'v' + item.version + (roles.has(item.package_id) ? ' · ' + roles.get(item.package_id) : '')));
    const install = el('a', 'open-button install-button', zh ? '安装' : 'Install'); install.href = item.install_href;
    install.dataset.fallbackUrl = item.download_href; install.setAttribute('aria-label', (zh ? '安装 ' : 'Install ') + item.name);
    row.append(image, content, install); return row;
  }
  function render() {
    const packages = document.getElementById('profile-packages');
    const contributions = document.getElementById('profile-contributions');
    packages.replaceChildren(...selectedPackages.filter(matches).map(packageCard));
    if (!packages.children.length) packages.append(el('p', 'profile-empty', zh ? '暂无匹配的作品' : 'No matching packages'));
    contributions.replaceChildren();
    for (const [packageID, history] of Object.entries(state.histories)) {
      const item = byID.get(packageID);
      if (!item || !matches(item)) continue;
      for (const release of history.releases || []) {
        const authors = (release.contributors || []).filter(user => validID ? user.github_user_id === id : state.namespace);
        if (!authors.length) continue;
        const row = el('article', 'profile-contribution');
        const heading = el('a', '', item.name + ' · v' + release.version); heading.href = item.href;
        row.append(heading);
        if (release.pr?.title) row.append(el('p', '', release.pr.title));
        const meta = el('div', 'row-meta');
        meta.append(el('span', '', authors.map(user => '@' + user.login).join(', ')));
        if (release.merged_at) meta.append(el('time', '', release.merged_at.slice(0, 10)));
        if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(release.pr?.url || '')) {
          const pr = el('a', '', zh ? '查看贡献 PR' : 'View contribution PR'); pr.href = release.pr.url; meta.append(pr);
        }
        row.append(meta); contributions.append(row);
      }
    }
    if (!contributions.children.length) contributions.append(el('p', 'profile-empty', zh ? '暂无可展示的已发布贡献记录' : 'No published contributions to display'));
    packages.hidden = activeTab !== 'packages'; contributions.hidden = activeTab !== 'contributions';
  }
  document.querySelectorAll('[data-profile-tab]').forEach(button => button.addEventListener('click', () => {
    activeTab = button.dataset.profileTab;
    document.querySelectorAll('[data-profile-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
    render();
  }));
  document.getElementById('profile-search').addEventListener('input', render);
  document.querySelectorAll('[data-profile-kind]').forEach(button => button.addEventListener('click', () => {
    activeKind = button.dataset.profileKind;
    document.querySelectorAll('[data-profile-kind]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    render();
  }));
  if (state.namespace) {
    document.querySelector('[data-profile-tab="contributions"]').textContent = zh ? '版本贡献' : 'Version contributions';
    render(); return;
  }
  if (!id) {
    document.querySelector('.profile-tools').hidden = true;
    document.getElementById('profile-packages').hidden = true;
    const namespaces = [...new Set(state.packages.map(item => item.owner))];
    const home = document.querySelector('.brand').href;
    for (const namespace of namespaces) {
      const link = el('a', 'profile-person', namespace); link.href = new URL('authors/' + encodeURIComponent(namespace) + '/', home).href; directory.append(link);
    }
    for (const user of profiles.values()) {
      const link = el('a', 'profile-person', '@' + user.login); link.href = '?id=' + encodeURIComponent(user.github_user_id); directory.append(link);
    }
    return;
  }
  if (!validID) { announce(zh ? '贡献者地址无效。' : 'Invalid contributor address.'); document.querySelector('.profile-tools').hidden = true; return; }
  // 切换语言仍定位同一数字身份。
  document.querySelectorAll('.language-popover a').forEach(link => { const url = new URL(link.href); url.searchParams.set('id', id); link.href = url.href; });
  displayProfile(profiles.get(id));
  render();
  async function load() {
    announce(zh ? '正在读取贡献者资料…' : 'Loading contributor…');
    document.getElementById('profile-retry').hidden = true;
    if (!state.market_api) { announce(zh ? '当前显示已发布贡献快照，维护关系暂不可用。' : 'Showing published contributions. Maintainer information is unavailable.'); return; }
    const base = state.market_api.replace(/\/+$/, '');
    const get = async path => {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('unavailable'); return response.json();
    };
    try {
      const body = await get('/v1/market/github-profiles?ids=' + id);
      const user = body.profiles.find(profile => profile.github_user_id === id) || profiles.get(id);
      let failed = false;
      const owned = [];
      const queue = [...state.packages];
      roles.clear();
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const item = queue.shift();
          try {
            const community = await get('/v1/market/packages/' + item.package_id.split('/').map(encodeURIComponent).join('/') + '/community');
            if (community.owner?.github_user_id === id || community.maintainers?.some(member => member.github_user_id === id)) {
              if (community.state === 'unlisted') continue;
              owned.push(item); roles.set(item.package_id, community.owner?.github_user_id === id ? (zh ? '所有者' : 'Owner') : (zh ? '共同维护者' : 'Maintainer'));
            }
          } catch { failed = true; }
        }
      }));
      selectedPackages = state.packages.filter(item => owned.includes(item));
      displayProfile(user); render();
      announce(failed ? (zh ? '部分维护关系暂时无法读取，可重试。' : 'Some maintainer information is unavailable. Retry to refresh.') : !user ? (zh ? '未找到此贡献者的公开资料。' : 'No public profile found for this contributor.') : '');
      document.getElementById('profile-retry').hidden = !failed;
      if (new URL(base || '/', location.origin).origin === location.origin) {
        fetch('/account/api/market/overview').then(response => response.ok ? response.json() : null).then(overview => {
          document.getElementById('profile-manage').hidden = overview?.github?.github_user_id !== id;
        }).catch(() => {});
      }
    } catch {
      announce(zh ? '资料暂时无法读取，已保留发布时的贡献记录。' : 'Profile unavailable. Published contribution records remain visible.');
      document.getElementById('profile-retry').hidden = false;
    }
  }
  document.getElementById('profile-retry').addEventListener('click', load);
  load();
})();
