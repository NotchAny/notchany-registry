(() => {
  const config = window.__NOTCHANY_STORE__;
  if (!config) return;

  const byId = (id) => document.getElementById(id);
  const locale = config.language === "zh" ? "zh-CN" : "en-US";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const text = config.copy;
  let counts = null;
  let countsStatus = "loading";

  function normalizeState(params = new URLSearchParams(location.search)) {
    const sort = ["all", "recent", "popular"].includes(params.get("sort")) ? params.get("sort") : "all";
    const kind = ["all", "widget", "action"].includes(params.get("kind")) ? params.get("kind") : "all";
    const rawPage = Number.parseInt(params.get("page") || "1", 10);
    return {
      q: (params.get("q") || "").trim(),
      sort,
      kind,
      tag: (params.get("tag") || "").trim().toLocaleLowerCase(),
      page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    };
  }

  let state = normalizeState();

  function serializeState(next) {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.sort !== "all") params.set("sort", next.sort);
    if (next.kind !== "all") params.set("kind", next.kind);
    if (next.tag) params.set("tag", next.tag);
    if (next.page > 1) params.set("page", String(next.page));
    return params.toString();
  }

  function syncURL(mode = "replace") {
    const query = serializeState(state);
    const url = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
    history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }

  function stableCompare(a, b) {
    return a.package_id.localeCompare(b.package_id, "en");
  }

  function catalog() {
    const query = state.q.toLocaleLowerCase();
    const items = config.packages.filter((item) => {
      if (state.kind !== "all" && item.kind !== state.kind) return false;
      if (state.tag && !item.tags.some((tag) => tag.toLocaleLowerCase() === state.tag)) return false;
      return !query || item.search.includes(query);
    });
    items.sort((a, b) => {
      if (state.sort === "recent") {
        return Date.parse(b.published_at) - Date.parse(a.published_at) || stableCompare(a, b);
      }
      if (state.sort === "popular" && counts) {
        return (counts[b.package_id] || 0) - (counts[a.package_id] || 0)
          || Date.parse(b.updated_at) - Date.parse(a.updated_at)
          || stableCompare(a, b);
      }
      return stableCompare(a, b);
    });
    const pageCount = Math.max(1, Math.ceil(items.length / 12));
    state.page = Math.min(Math.max(state.page, 1), pageCount);
    return {
      items: items.slice((state.page - 1) * 12, state.page * 12),
      total: items.length,
      pageCount,
    };
  }

  function escapeHTML(value) {
    const node = document.createElement("span");
    node.textContent = String(value);
    return node.innerHTML;
  }

  function formatCount(value) {
    return new Intl.NumberFormat(locale, { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
  }

  function packageRow(item) {
    const count = counts?.[item.package_id];
    return `<article class="package-row">
      <img class="package-icon" src="${item.icon}" alt="" width="54" height="54">
      <div class="row-copy">
        <div class="row-title"><h3>${escapeHTML(item.name)}</h3><span class="kind-mark">${escapeHTML(item.kind_label)}</span></div>
        <p class="row-summary">${escapeHTML(item.summary)}</p>
        <div class="row-meta"><a href="${escapeHTML(new URL('authors/' + encodeURIComponent(item.owner) + '/', document.querySelector('.brand').href).href)}">${escapeHTML(item.owner)}</a>${count === undefined ? "" : `<span>${formatCount(count)} ${escapeHTML(text.downloads)}</span>`}</div>
      </div>
      <a class="open-button" href="${item.href}" aria-label="${escapeHTML(`${text.open} ${item.name}`)}">${escapeHTML(text.open)}</a>
    </article>`;
  }

  function renderDetailCount() {
    const targets = [...document.querySelectorAll("[data-download-count]")];
    if (!targets.length) return;
    for (const target of targets) {
      const count = counts?.[target.dataset.downloadCount];
      if (count === undefined) {
        target.textContent = target.dataset.countStyle?.startsWith("installs")
          ? (countsStatus === "loading" ? text.count_loading : text.count_unavailable)
          : "";
      } else {
        const formatted = formatCount(count);
        target.textContent = target.dataset.countStyle === "installs"
          ? text.count_value.replace("{count}", formatted)
          : target.dataset.countStyle === "installs-inline"
            ? text.count_inline.replace("{count}", formatted)
            : `${formatted} ${text.downloads}`;
      }
    }
  }

  function renderPagination(pageCount) {
    const root = byId("pagination");
    root.hidden = pageCount <= 1;
    if (pageCount <= 1) {
      root.replaceChildren();
      return;
    }
    const buttons = [];
    for (let page = 1; page <= pageCount; page += 1) {
      buttons.push(`<button class="page-button" type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`);
    }
    root.innerHTML = buttons.join("");
  }

  function render() {
    if (!byId("catalog-list")) {
      renderDetailCount();
      return;
    }
    document.querySelectorAll("[data-store-search]").forEach((input) => {
      if (input.value !== state.q) input.value = state.q;
    });
    document.querySelectorAll("[data-sort]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.sort === state.sort)));
    document.querySelectorAll("[data-kind]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.kind === state.kind)));
    document.querySelectorAll("[data-tag]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.tag === state.tag)));
    byId("clear-filters").hidden = !state.q && state.sort === "all" && state.kind === "all" && !state.tag;

    const result = catalog();
    syncURL();
    const resultCount = byId("result-count");
    resultCount.innerHTML = text.result.replace("{count}", `<strong>${result.total}</strong>`);

    const status = byId("popular-status");
    status.hidden = state.sort !== "popular" || countsStatus === "ready";
    if (!status.hidden) {
      status.innerHTML = countsStatus === "loading"
        ? escapeHTML(text.popular_loading)
        : `${escapeHTML(text.popular_unavailable)} <button class="retry-button" id="retry-counts" type="button">${escapeHTML(text.retry)}</button>`;
    }

    const list = byId("catalog-list");
    if (state.sort === "popular" && countsStatus === "error") {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><strong>${escapeHTML(text.popular_unavailable_title)}</strong>${escapeHTML(text.popular_unavailable_body)}</div>`;
      renderPagination(1);
    } else if (result.total === 0) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><strong>${escapeHTML(text.empty_title)}</strong>${escapeHTML(text.empty_body)}</div>`;
      renderPagination(1);
    } else {
      list.innerHTML = result.items.map(packageRow).join("");
      renderPagination(result.pageCount);
    }
  }

  function update(patch, mode = "replace") {
    state = { ...state, ...patch };
    syncURL(mode);
    render();
  }

  async function loadCounts() {
    countsStatus = "loading";
    render();
    if (!config.counts_url) {
      countsStatus = "error";
      render();
      return;
    }
    try {
      const response = await fetch(config.counts_url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid counts");
      counts = body;
      countsStatus = "ready";
    } catch {
      countsStatus = "error";
    }
    render();
  }

  const searches = [...document.querySelectorAll("[data-store-search]")];
  const primarySearch = byId("store-search") || searches[0];
  const revealCatalog = () => byId("catalog")?.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  });
  searches.forEach((search) => {
    search.addEventListener("input", () => update({ q: search.value, page: 1 }));
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      update({ q: search.value, page: 1 }, "push");
      requestAnimationFrame(revealCatalog);
    });
  });

  const languageMenu = byId("language-menu");
  const languageToggle = byId("language-toggle");
  const languagePopover = byId("language-popover");
  const languageOptions = [...(languagePopover?.querySelectorAll('[role="menuitem"]') || [])];
  const setLanguageMenuOpen = (open, focusOption = false) => {
    if (!languageToggle || !languagePopover) return;
    languageToggle.setAttribute("aria-expanded", String(open));
    languagePopover.hidden = !open;
    if (open && focusOption) (languagePopover.querySelector('[aria-current="page"]') || languageOptions[0])?.focus();
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("#language-toggle")) {
      setLanguageMenuOpen(languageToggle?.getAttribute("aria-expanded") !== "true");
      return;
    }
    if (languageMenu && !languageMenu.contains(event.target)) setLanguageMenuOpen(false);
    const sort = event.target.closest("[data-sort]");
    if (sort) update({ sort: sort.dataset.sort, page: 1 }, "push");
    const kind = event.target.closest("[data-kind]");
    if (kind) update({ kind: kind.dataset.kind, page: 1 }, "push");
    const tag = event.target.closest("[data-tag]");
    if (tag) update({ tag: state.tag === tag.dataset.tag ? "" : tag.dataset.tag, page: 1 }, "push");
    const page = event.target.closest("[data-page]");
    if (page) {
      update({ page: Number(page.dataset.page) }, "push");
      byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (event.target.closest("#clear-filters")) update({ q: "", sort: "all", kind: "all", tag: "", page: 1 }, "push");
    if (event.target.closest("#retry-counts")) loadCounts();
  });
  document.addEventListener("keydown", (event) => {
    const languageMenuOpen = languageToggle?.getAttribute("aria-expanded") === "true";
    if (event.key === "Escape" && languageMenuOpen) {
      event.preventDefault();
      setLanguageMenuOpen(false);
      languageToggle.focus();
      return;
    }
    if (languageToggle && document.activeElement === languageToggle && ["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setLanguageMenuOpen(true, true);
      return;
    }
    if (languageMenuOpen && languageOptions.includes(document.activeElement) && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const current = languageOptions.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? languageOptions.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + languageOptions.length) % languageOptions.length;
      languageOptions[next]?.focus();
      return;
    }
    if ((event.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName)) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
      event.preventDefault();
      primarySearch?.focus();
      primarySearch?.select();
    }
    const activeSearch = searches.includes(document.activeElement) ? document.activeElement : primarySearch;
    if (event.key === "Escape" && activeSearch && (searches.includes(document.activeElement) || state.q)) {
      event.preventDefault();
      update({ q: "", page: 1 }, "push");
      activeSearch.focus();
    }
  });
  addEventListener("popstate", () => {
    state = normalizeState();
    render();
  });

  const menuDate = byId("mac-menu-date");
  const menuTime = byId("mac-menu-time");
  if (menuDate && menuTime) {
    const dateFormatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "short" });
    const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const updateClock = () => {
      const now = new Date();
      menuDate.textContent = dateFormatter.format(now);
      menuTime.textContent = timeFormatter.format(now);
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  const notch = byId("demo-notch");
  if (notch) {
    let engaged = false;
    let introTimer;
    let closeTimer;
    const setOpen = (open) => {
      notch.classList.toggle("is-open", open);
      notch.setAttribute("aria-expanded", String(open));
    };
    const clearTimers = () => {
      clearTimeout(introTimer);
      clearTimeout(closeTimer);
    };
    const introStorageKey = "notchany-store-intro";
    let shouldPlayIntro = !reducedMotion;
    try {
      shouldPlayIntro = shouldPlayIntro && sessionStorage.getItem(introStorageKey) !== "shown";
      sessionStorage.setItem(introStorageKey, "shown");
    } catch {
      // sessionStorage 被禁用时，本次页面仍只自动演示一次。
    }
    if (shouldPlayIntro && !document.hidden) {
      introTimer = setTimeout(() => {
        if (engaged) return;
        setOpen(true);
        closeTimer = setTimeout(() => {
          if (!engaged) setOpen(false);
        }, 2600);
      }, 900);
    }
    notch.addEventListener("pointerenter", () => {
      engaged = true;
      clearTimers();
      setOpen(true);
    });
    notch.addEventListener("pointerleave", () => {
      engaged = false;
      clearTimers();
      closeTimer = setTimeout(() => {
        if (!engaged) setOpen(false);
      }, 220);
    });
    notch.addEventListener("focusin", () => {
      engaged = true;
      clearTimers();
      setOpen(true);
    });
    notch.addEventListener("focusout", (event) => {
      if (notch.contains(event.relatedTarget)) return;
      engaged = false;
      clearTimers();
      closeTimer = setTimeout(() => setOpen(false), 220);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimers();
        setOpen(false);
      }
    });
  }

  const demoKeys = [...document.querySelectorAll(".mac-key")];
  const keysByCode = new Map(demoKeys.map((key) => [key.dataset.code, key]));
  const releaseKey = (key) => key?.classList.remove("pressed");
  demoKeys.forEach((key) => {
    key.addEventListener("pointerdown", () => key.classList.add("pressed"));
    key.addEventListener("pointerup", () => releaseKey(key));
    key.addEventListener("pointercancel", () => releaseKey(key));
    key.addEventListener("pointerleave", () => releaseKey(key));
  });
  document.addEventListener("keydown", (event) => keysByCode.get(event.code)?.classList.add("pressed"));
  document.addEventListener("keyup", (event) => releaseKey(keysByCode.get(event.code)));
  addEventListener("blur", () => demoKeys.forEach(releaseKey));

  const trackpad = byId("trackpad");
  trackpad?.addEventListener("pointerdown", () => trackpad.classList.add("pressed"));
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    trackpad?.addEventListener(eventName, () => trackpad.classList.remove("pressed"));
  }

  let cancelPendingLaunch = () => {};
  document.addEventListener("click", (event) => {
    const launch = event.target.closest("a[data-fallback-url]");
    if (!launch) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    cancelPendingLaunch();
    const fallbackURL = launch.dataset.fallbackUrl;
    if (!fallbackURL) return;
    const timer = setTimeout(() => {
      if (!document.hidden && document.hasFocus()) location.assign(fallbackURL);
    }, 1600);
    const onVisibilityChange = () => {
      if (document.hidden) cancel();
    };
    const cancel = () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      removeEventListener("blur", cancel);
      removeEventListener("pagehide", cancel);
      cancelPendingLaunch = () => {};
    };
    cancelPendingLaunch = cancel;
    document.addEventListener("visibilitychange", onVisibilityChange);
    addEventListener("blur", cancel, { once: true });
    addEventListener("pagehide", cancel, { once: true });
  });

  const identityAvatarFallback = () => Object.assign(document.createElement("span"), {
    className: "identity-avatar",
  });
  const watchIdentityAvatar = (avatar) => {
    const fail = () => avatar.replaceWith(identityAvatarFallback());
    avatar.addEventListener("error", fail, { once: true });
    if (avatar.complete && avatar.naturalWidth === 0) fail();
  };
  document.querySelectorAll(".identity img").forEach(watchIdentityAvatar);

  const community = document.querySelector("[data-community-package]");
  if (community?.dataset.marketApi) {
    const profileElement = (profile, role) => {
      const node = document.createElement("a");
      node.className = "identity";
      node.href = new URL("contributors/?id=" + encodeURIComponent(profile.github_user_id), document.querySelector(".brand").href).href;
      node.dataset.githubUserId = profile.github_user_id;
      const avatar = document.createElement(profile.avatar_url ? "img" : "span");
      avatar.className = profile.avatar_url ? "" : "identity-avatar";
      if (profile.avatar_url) {
        avatar.src = profile.avatar_url;
        avatar.alt = "";
        avatar.width = 30;
        avatar.height = 30;
        watchIdentityAvatar(avatar);
      }
      const copy = document.createElement("span");
      const login = document.createElement("strong");
      login.dataset.identityLogin = "";
      login.textContent = `@${profile.login}`;
      const meta = document.createElement("small");
      meta.textContent = `${role}${profile.notchany_verified ? ` · ${text.verified}` : ""}`;
      copy.append(login, meta);
      node.append(avatar, copy);
      return node;
    };

    const updateSnapshots = (profiles) => {
      const byGitHubID = new Map(profiles.map((profile) => [profile.github_user_id, profile]));
      document.querySelectorAll("[data-github-user-id]").forEach((node) => {
        const profile = byGitHubID.get(node.dataset.githubUserId);
        if (!profile) return;
        const login = node.querySelector("[data-identity-login]");
        if (login) login.textContent = `@${profile.login}`;
        const verified = node.querySelector("[data-identity-verified]");
        if (verified) verified.hidden = !profile.notchany_verified;
        const currentAvatar = node.querySelector("img, .identity-avatar");
        if (profile.avatar_url) {
          let image = node.querySelector("img");
          if (!image) {
            image = document.createElement("img");
            image.alt = "";
            image.width = 30;
            image.height = 30;
            currentAvatar?.replaceWith(image);
            watchIdentityAvatar(image);
          }
          image.src = profile.avatar_url;
        } else if (currentAvatar?.tagName === "IMG") {
          currentAvatar.replaceWith(identityAvatarFallback());
        }
      });
    };

    const loadCommunity = async () => {
      try {
        const base = community.dataset.marketApi.replace(/\/+$/, "");
        const packageID = community.dataset.communityPackage;
        const parts = packageID.split("/").map(encodeURIComponent);
        const communityResponse = await fetch(`${base}/v1/market/packages/${parts[0]}/${parts[1]}/community`);
        if (!communityResponse.ok) throw new Error(`HTTP ${communityResponse.status}`);
        const body = await communityResponse.json();
        const owner = community.querySelector("[data-community-owner]");
        const maintainers = community.querySelector("[data-community-maintainers]");
        if (body.owner) {
          owner.replaceChildren(profileElement(body.owner, body.state === "unclaimed" ? text.unclaimed : text.owner));
        } else {
          const unclaimed = document.createElement("span");
          unclaimed.className = "community-status";
          unclaimed.textContent = text.unclaimed;
          owner.replaceChildren(unclaimed);
        }
        const memberProfiles = Array.isArray(body.maintainers) ? body.maintainers : [];
        maintainers.replaceChildren(...memberProfiles.map((profile) => profileElement(profile, text.maintainers)));

        const ids = [...new Set([...document.querySelectorAll("[data-github-user-id]")]
          .map((node) => node.dataset.githubUserId)
          .filter(Boolean))];
        if (ids.length) {
          const profilesResponse = await fetch(`${base}/v1/market/github-profiles?ids=${encodeURIComponent(ids.join(","))}`);
          if (profilesResponse.ok) updateSnapshots((await profilesResponse.json()).profiles || []);
        }
      } catch {
        // Registry 快照仍可用；Owner/维护者保留明确的服务不可用状态。
      }
    };
    loadCommunity();
  }

  render();
  loadCounts();
})();
