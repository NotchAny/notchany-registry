import { pick, relatedPackages, searchText } from "./site-lib.mjs";
import { REGISTRY_URL } from "./registry-repo.mjs";

const SITE_URL = (process.env.NOTCHANY_SITE_URL || "https://notchany.com").replace(/\/+$/, "");
const ACCOUNT_URL = process.env.NOTCHANY_ACCOUNT_URL || "https://account.notchany.com/account";
const REPO_URL = REGISTRY_URL;
const APP_URL = "https://github.com/glzlaohuai/NotchAny";
const APP_ICON_ASSET = "assets/app-icon.png?v=balanced-20260925";

const COPY = {
  zh: {
    hero_kicker: "为 macOS 刘海而生", hero_title: "NotchAny Store", hero_body: "发现小组件与动作，把常用信息和工作流放进刘海。每个包都可检查、可调整、由你确认安装。",
    tray_empty: "第一批作品即将上架",
    browse: "浏览内容库", submit: "提交作品", github: "GitHub 源码", language: "English", language_menu: "切换语言", download_app: "下载 App", featured: "精选", featured_note: "来自不同使用场景的三个起点。",
    search: "搜索名称、简介、作者、包 ID 或标签", all_packages: "内容库", all_packages_note: "浏览社区发布的小组件与动作。",
    sort: "排序", all: "全部", recent: "最新", popular: "热门", type: "类型", widget: "小组件", action: "动作", tags: "标签",
    clear: "清除条件", result: "找到 {count} 个包", downloads: "下载", installs: "下载安装次数", count_value: "{count} 次", count_inline: "下载安装 {count} 次", count_loading: "正在读取…", count_unavailable: "暂不可用", open: "打开", install: "安装", retry: "重试",
    popular_loading: "正在读取下载量…", popular_unavailable: "热门排序暂不可用。", popular_unavailable_title: "暂时无法读取热门排序", popular_unavailable_body: "下载计数服务没有响应。你仍可使用全部、最新、搜索和筛选。",
    empty_title: "没有匹配的包", empty_body: "换个关键词，或清除一项筛选条件。", featured_kind: "精选",
    footer: "NotchAny Store", source: "源码", privacy: "隐私与发布规则",
    back: "返回 Store", by: "作者", version: "版本", updated: "更新", size: "包大小", license: "许可", requirements: "依赖", none: "无额外依赖",
    open_app: "在 NotchAny 中打开", project_home: "项目主页",
    download_kicker: "NotchAny for Mac", download_title: "先安装 NotchAny", download_body: "NotchAny Store 中的小组件与动作需要通过 Mac App 查看和安装。安装完成后，返回 Store 再次打开即可。",
    download_now: "下载 NotchAny", download_pending: "下载地址准备中", download_pending_note: "正式版本开放下载后，此按钮会直接提供最新版 App。", download_requirement: "需要 macOS 15 Sequoia 或更高版本",
    about: "关于这个包", safety: "运行与安全", safety_shell: "此包包含可执行脚本。NotchAny 会在安装前展示完整脚本，并要求你确认；请只运行你已阅读并信任的内容。",
    safety_plain: "安装前可检查包内容，NotchAny 仍会要求你确认安装。",
    info: "包信息", package_id: "包 ID", source_code: "查看包源码", report: "反馈问题", improve: "提出改进", related: "你可能也需要",
    community: "协作与贡献", owner: "Owner", maintainers: "共同维护者", contributors: "贡献者", verified: "已绑定 NotchAny", unclaimed: "待认领", community_unavailable: "协作身份暂不可用",
    history: "版本记录", release_fallback: "版本 {version}", release_empty: "暂无版本说明",
    author_title: "作者", author_creator: "NotchAny Store 创作者", author_works: "作品", author_packages: "{count} 个包", author_github: "GitHub 主页", author_note: "这位作者发布的小组件与动作。", author_empty: "暂无该类型作品",
  },
  en: {
    hero_kicker: "Built for the macOS notch", hero_title: "NotchAny Store", hero_body: "Discover widgets and actions that put useful information and workflows in the notch. Every package stays inspectable, editable, and yours to approve.",
    tray_empty: "First packages arriving soon",
    browse: "Browse library", submit: "Submit a package", github: "GitHub source", language: "中文", language_menu: "Change language", download_app: "Download App", featured: "Featured", featured_note: "Three starting points for different workflows.",
    search: "Search names, descriptions, authors, package IDs, or tags", all_packages: "Library", all_packages_note: "Browse community widgets and actions.",
    sort: "Sort", all: "All", recent: "Latest", popular: "Popular", type: "Type", widget: "Widgets", action: "Actions", tags: "Tags",
    clear: "Clear filters", result: "{count} packages", downloads: "downloads", installs: "Downloads & installs", count_value: "{count}", count_inline: "{count} downloads & installs", count_loading: "Loading…", count_unavailable: "Unavailable", open: "Open", install: "Install", retry: "Retry",
    popular_loading: "Loading download counts…", popular_unavailable: "Popular sorting is unavailable.", popular_unavailable_title: "Popular sorting is temporarily unavailable", popular_unavailable_body: "The download-count service did not respond. All, Latest, search, and filters still work.",
    empty_title: "No matching packages", empty_body: "Try another term or clear one of the filters.", featured_kind: "Featured",
    footer: "NotchAny Store", source: "Source", privacy: "Privacy and publishing rules",
    back: "Back to Store", by: "By", version: "Version", updated: "Updated", size: "Package size", license: "License", requirements: "Requirements", none: "No extra requirements",
    open_app: "Open in NotchAny", project_home: "Project page",
    download_kicker: "NotchAny for Mac", download_title: "Install NotchAny first", download_body: "Widgets and actions from NotchAny Store are viewed and installed through the Mac app. Once installed, return to the Store and open the package again.",
    download_now: "Download NotchAny", download_pending: "Download coming soon", download_pending_note: "This button will provide the latest app as soon as the release is available.", download_requirement: "Requires macOS 15 Sequoia or later",
    about: "About this package", safety: "Runtime and safety", safety_shell: "This package contains an executable script. NotchAny shows the full script and asks for confirmation before installation. Run only code you have read and trust.",
    safety_plain: "You can inspect the package before installing, and NotchAny still asks you to confirm.",
    info: "Package information", package_id: "Package ID", source_code: "View package source", report: "Report an issue", improve: "Suggest an improvement", related: "You may also need",
    community: "Collaboration & contributions", owner: "Owner", maintainers: "Maintainers", contributors: "Contributors", verified: "Linked to NotchAny", unclaimed: "Unclaimed", community_unavailable: "Collaboration identity unavailable",
    history: "Version history", release_fallback: "Version {version}", release_empty: "No release notes",
    author_title: "Author", author_creator: "NotchAny Store creator", author_works: "Packages", author_packages: "{count} packages", author_github: "GitHub profile", author_note: "Widgets and actions published by this author.", author_empty: "No packages of this type",
  },
};

// 首页产品段文案只在服务端渲染，不进入客户端 JSON。页面上的每个数字都须能在 App 或商业化规格中找到出处，
// 价格只由选档页从 Lemon Squeezy 读取，这里不写。
const LANDING = {
  zh: {
    nav_features: "功能", nav_buy: "购买", nav_trial: "免费试用",
    hero_kicker: "为 macOS 刘海而生",
    hero_title: "让刘海成为 Mac 上最优雅的效率入口",
    hero_lede: "悬停展开自定义工具托盘；拖文件过去，它伸手接住并处理。",
    hero_meta_os: "需要 macOS 15 Sequoia 或更高版本", hero_meta_notch: "没有刘海的 Mac 也能用",
    cta_trial: "免费试用 14 天", cta_buy: "购买", cta_watch: "观看视频",
    drop_eyebrow: "悬停与拖放", drop_title: "悬停即开，放下即处理",
    drop_body: "指针移到刘海，托盘从刘海里自然长出，一点即达。把文件拖过去，投放网格只列出能处理它的动作；松手即开始，进度和结果都在刘海里。",
    drop_facts: ["按文件类型匹配动作", "真实刘海与虚拟刘海一致"],
    builtins_eyebrow: "开箱即用", builtins_title: "<em>38</em> 个内置动作，<em>5</em> 个内置小组件",
    builtins_body: "图片、通用、音视频、PDF、网络、系统与快捷入口七组动作；CPU、内存、系统盘、音乐与 Agent 任务监控五个小组件，随手放进托盘。",
    music_eyebrow: "音乐", music_title: "正在播放，就在刘海里",
    music_body: "Apple Music 的封面、歌词与播放控制都在托盘里。播放时刘海旁的声纹轻轻起伏，只看播放状态，不采集任何音频。",
    notify_eyebrow: "通知", notify_title: "通知，长在刘海上",
    notify_body: "长任务的进度从刘海旁延伸出来，完成后留下未读；悬停展开列表，打开、重试一键直达。固定到桌面的小组件也带着自己的通知。",
    effects_eyebrow: "全屏特效", effects_title: "大事发生，整块屏幕都告诉你",
    effects_body: "完成是一次柔和的绿光，等待是两下轻提醒，失败是两下紧凑的红色警示；成功时还能来一场彩纸。",
    effects_facts: ["可调低强度", "可完全关闭"],
    agent_eyebrow: "AI Agent", agent_title: "每个 AI 会话，一眼看全",
    agent_body: "会话按项目分组，运行、等待确认、完成一目了然。需要你时刘海先提醒，点一下跳回对应会话。",
    agent_facts: ["Claude Code", "Codex", "Gemini CLI", "Kimi Code"],
    ai_eyebrow: "让 AI 来做", ai_title: "一句话，让 AI 帮你做",
    ai_body: "说一句「做个番茄钟小组件，放进刘海」，AI 助手就能创建小组件、调整参数并摆进托盘。",
    ai_facts: ["CLI", "MCP", "Skill"],
    customize_eyebrow: "自定义", customize_title: "摆成你的样子",
    customize_body: "长按托盘进入编辑：在吸附网格里拖动、拉角调整大小，拖出刘海就固定到桌面。在小组件工作台改一行样式，右侧预览即时同步。",
    publish_eyebrow: "Store", publish_title: "上架 Store，和社区一起改",
    publish_body: "在 App 里一键发布自己的小组件与动作；别人的改进以 Pull Request 回到原作，每个版本和贡献者都有记录。",
    publish_link: "浏览 Store",
    buy_eyebrow: "购买", buy_title: "一次买断，按设备数选择",
    buy_body: "先免费试用 14 天，全部功能都能用。满意再买：一次付费，没有订阅。",
    tier_unit_1: "台 Mac", tier_unit_n: "台 Mac", tier_detail: "可同时在 {n} 台 Mac 上激活", tier_badge: "推荐",
    buy_tier_note: "三档功能相同，只差可以同时激活的设备数。",
    buy_cta: "购买 NotchAny",
    buy_price_note: "价格在下一步的选档页显示。设备不够时再买一份即可，档位之间不提供升级。",
    faq_title: "常见问题",
    faq: [
      ["需要什么系统？", "macOS 15 Sequoia 或更高版本。"],
      ["我的 Mac 没有刘海，也能用吗？", "能。没有刘海的屏幕会显示一枚与真刘海尺寸一致的「虚拟刘海」，默认开启，可在设置中关闭；外接显示器同样适用。"],
      ["试用期怎么算？到期后会怎样？", "首次启动起 14 天，全部功能可用。到期后托盘和设置照常使用，执行动作时会提示购买，不会反复弹窗。"],
      ["一份授权能在几台 Mac 上用？", "按所购档位，可同时在 1、3 或 5 台 Mac 上激活。换电脑时在账号页解绑旧设备即可；需要更多设备就再买一份。"],
      ["需要一直联网吗？", "不需要。联网时授权会自动续期；离线可以使用 30 天，之后还有 7 天宽限。"],
      ["Store 里的动作安全吗？", "每次安装都需要你确认；包含脚本的动作会先展示完整脚本，读过再装。"],
      ["怎么让 AI 助手帮我配置？", "在设置中开启「允许 AI 助手连接」，Claude Code、Codex 等助手就能通过命令行工具、MCP 或 Skill 创建动作、调整托盘。"],
    ],
    store_title: "社区的小组件与动作",
    store_body: "发现小组件与动作，把常用信息和工作流放进刘海。每个包都可检查、可调整、由你确认安装。",
    store_enter: "进入 Store",
    store_empty_title: "Store 刚刚开放",
    store_empty_body: "第一批社区作品正在路上。你也可以在 App 里把自己的小组件或动作发布到这里。",
  },
  en: {
    nav_features: "Features", nav_buy: "Buy", nav_trial: "Free trial",
    hero_kicker: "Made for the Mac notch",
    hero_title: "Your notch, put to work.",
    hero_lede: "Hover to open a tray of your own tools. Drag a file over, and the notch reaches out, catches it, and gets it done.",
    hero_meta_os: "Requires macOS 15 Sequoia or later", hero_meta_notch: "Works on Macs without a notch, too",
    cta_trial: "Try free for 14 days", cta_buy: "Buy", cta_watch: "Watch the film",
    drop_eyebrow: "Hover & drop", drop_title: "Hover to open. Drop to process.",
    drop_body: "Move the pointer to the notch and the tray grows right out of it. Drag a file over and the drop grid shows only the actions that can handle it. Let go, and progress and results stay in the notch.",
    drop_facts: ["Actions matched by file type", "Real and virtual notch behave the same"],
    builtins_eyebrow: "Built in", builtins_title: "<em>38</em> actions. <em>5</em> widgets. All built in.",
    builtins_body: "Seven groups of actions: images, general, audio & video, PDF, network, system and shortcuts. Plus CPU, memory, disk, music and agent-monitor widgets, ready for your tray.",
    music_eyebrow: "Music", music_title: "Now playing, in your notch.",
    music_body: "Apple Music artwork, lyrics and controls live in the tray. While music plays, a soft waveform moves beside the notch, driven by playback state and never by recording audio.",
    notify_eyebrow: "Notifications", notify_title: "Notifications, grown from the notch.",
    notify_body: "Progress for long tasks extends right out of the notch and leaves an unread mark when it's done. Hover to open the list and act in one click. Widgets pinned to the desktop carry their own notifications.",
    effects_eyebrow: "Screen effects", effects_title: "Big moments light up the screen.",
    effects_body: "Done blooms once in soft green. Waiting pulses twice, gently. Failure flashes a tight red warning. Success can even bring confetti.",
    effects_facts: ["Turn it down", "Or off entirely"],
    agent_eyebrow: "AI agents", agent_title: "Every AI agent, one glance.",
    agent_body: "Sessions grouped by project: running, waiting and done at a glance. When one needs you, the notch speaks up first, and one click takes you back.",
    agent_facts: ["Claude Code", "Codex", "Gemini CLI", "Kimi Code"],
    ai_eyebrow: "Let AI do it", ai_title: "Just ask. AI builds it.",
    ai_body: "Say “make a pomodoro widget and put it in my notch,” and your AI assistant creates it, tunes it and places it in the tray.",
    ai_facts: ["CLI", "MCP", "Skill"],
    customize_eyebrow: "Customize", customize_title: "Make it yours.",
    customize_body: "Long-press the tray to edit: drag on a snapping grid, resize from the corner, drag out of the notch to pin to the desktop. Change a line in the widget workbench and the preview updates live.",
    publish_eyebrow: "Store", publish_title: "Publish to the Store. Improve it together.",
    publish_body: "Publish your widgets and actions right from the app. Improvements from others come back as pull requests, with every release and contributor on record.",
    publish_link: "Browse the Store",
    buy_eyebrow: "Buy", buy_title: "Buy once. Choose how many Macs.",
    buy_body: "Try every feature free for 14 days. If you love it, pay once. No subscription.",
    tier_unit_1: "Mac", tier_unit_n: "Macs", tier_detail: "Activate on up to {n} Macs", tier_detail_1: "Activate on 1 Mac", tier_badge: "Recommended",
    buy_tier_note: "Every tier has every feature. Only the number of active Macs differs.",
    buy_cta: "Buy NotchAny",
    buy_price_note: "Prices appear on the next page. Need more Macs later? Buy another license; tiers can't be upgraded.",
    faq_title: "Questions",
    faq: [
      ["What do I need?", "macOS 15 Sequoia or later."],
      ["My Mac has no notch. Does it work?", "Yes. Screens without a notch get a virtual notch the same size as the real one. It's on by default, can be turned off in Settings, and works on external displays too."],
      ["How does the trial work?", "You get 14 days with every feature, starting from first launch. Afterward the tray and settings keep working, and running an action asks you to buy. No pop-up barrage."],
      ["How many Macs can one license cover?", "Depending on your tier, 1, 3 or 5 Macs at the same time. Switching Macs? Unlink the old one on your account page. Need more? Buy another license."],
      ["Do I need to stay online?", "No. Your license renews quietly while you're online and keeps working offline for 30 days, plus a 7-day grace period."],
      ["Are Store packages safe?", "Every install needs your confirmation. Packages that include scripts show you the full script first."],
      ["How do I let an AI assistant set things up?", "Turn on AI assistant access in Settings. Assistants like Claude Code and Codex can then create actions and arrange your tray through the CLI, MCP or Skill."],
    ],
    store_title: "Widgets and actions from the community",
    store_body: "Discover widgets and actions that put useful information and workflows in the notch. Every package stays inspectable, editable, and yours to approve.",
    store_enter: "Explore the Store",
    store_empty_title: "The Store just opened",
    store_empty_body: "The first community packages are on their way. You can also publish your own widgets and actions here, right from the app.",
  },
};

const FILM_LENGTH = "0:55";
const TIERS = [1, 3, 5];
const RECOMMENDED_TIER = 3;

function escapeHTML(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function inlineJSON(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function renderInline(value) {
  return escapeHTML(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(value) {
  const output = [];
  for (const block of String(value || "").split(/\n{2,}/)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((line) => /^[-*] /.test(line))) {
      output.push(`<ul>${lines.map((line) => `<li>${renderInline(line.replace(/^[-*] /, ""))}</li>`).join("")}</ul>`);
    } else {
      output.push(`<p>${lines.map(renderInline).join("<br>")}</p>`);
    }
  }
  return output.join("\n");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function date(value, lang) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function identity(identity, role, copy) {
  if (!identity) return "";
  const avatar = identity.avatar_url
    ? `<img src="${escapeHTML(identity.avatar_url)}" alt="" width="30" height="30">`
    : `<span class="identity-avatar" aria-hidden="true"></span>`;
  return `<a class="identity" href="${SITE_URL}/${copy === COPY.en ? "en/" : ""}contributors/?id=${encodeURIComponent(identity.github_user_id)}" data-github-user-id="${escapeHTML(identity.github_user_id)}">${avatar}<span><strong data-identity-login>@${escapeHTML(identity.login)}</strong><small>${escapeHTML(role)}<span data-identity-verified hidden> · ${copy.verified}</span></small></span></a>`;
}

function historySections(history, copy, lang) {
  const releases = Array.isArray(history?.releases) ? history.releases : [];
  const contributors = Array.isArray(history?.contributors) ? history.contributors : [];
  const contributorHTML = contributors.length
    ? `<div class="identity-list contributor-list">${contributors.map((user) => identity(user, copy.contributors, copy)).join("")}</div>`
    : "";
  const releasesHTML = releases.map((release) => {
    const title = release.pr?.title || copy.release_fallback.replace("{version}", release.version);
    const body = release.pr?.body ? renderMarkdown(release.pr.body) : `<p>${copy.release_empty}</p>`;
    const linkedTitle = release.pr?.url
      ? `<a href="${escapeHTML(release.pr.url)}">${escapeHTML(title)}</a>`
      : escapeHTML(title);
    const timestamp = release.merged_at ? `<time datetime="${escapeHTML(release.merged_at)}">${date(release.merged_at, lang)}</time>` : "";
    return `<article class="release"><div class="release-marker" aria-hidden="true"></div><div class="release-copy"><div class="release-heading"><h3>${linkedTitle}</h3><span>v${escapeHTML(release.version)}</span></div>${timestamp}<div class="release-notes">${body}</div>${release.contributors?.length ? `<div class="release-contributors">${release.contributors.map((user) => identity(user, copy.contributors, copy)).join("")}</div>` : ""}</div></article>`;
  }).join("");
  return { contributorHTML, releasesHTML };
}

function kindLabel(item, lang) {
  return item.kind === "widget" ? COPY[lang].widget.replace(/s$/, "") : COPY[lang].action.replace(/s$/, "");
}

function pageHead({ lang, title, description, canonicalPath, alternatePath, imagePath, css, siteName = "NotchAny Store", extraHead = "" }) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  const alternate = `${SITE_URL}${alternatePath}`;
  const zhURL = lang === "zh" ? canonical : alternate;
  const enURL = lang === "en" ? canonical : alternate;
  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-Hans" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="description" content="${escapeHTML(description)}">
  <meta name="theme-color" content="#09090A">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="zh-Hans" href="${zhURL}">
  <link rel="alternate" hreflang="en" href="${enURL}">
  <link rel="alternate" hreflang="x-default" href="${zhURL}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHTML(siteName)}">
  <meta property="og:title" content="${escapeHTML(title)}">
  <meta property="og:description" content="${escapeHTML(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/${imagePath}">
  <meta property="og:locale" content="${lang === "zh" ? "zh_CN" : "en_US"}">
  <title>${escapeHTML(title)}</title>
  <style>${css}</style>${extraHead}
</head>`;
}

const NAV_ICONS = {
  browse: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
  submit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l3 1.71"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/><path d="M16 19h6"/><path d="M19 16v6"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.91-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.94a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.23 10.23 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"/></svg>',
  language: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
};

const SUBMIT_URL = `${REPO_URL}#%E6%8F%90%E4%BA%A4%E4%B8%80%E4%B8%AA%E5%8C%85`;

// 首页导航从纯黑产品段起步（data-tone="dark"），store.js 在 Store 底板滑到导航下方时切回页面外观；
// .brand 的 href 必须保持首页地址，客户端靠它解析作者与贡献者链接。
function nav({ lang, root, detailPackageID = "", sectionPath = "", landing = false }) {
  const copy = COPY[lang];
  const home = `${root}${lang === "en" ? "en/" : ""}`;
  const pagePath = detailPackageID ? `packages/${detailPackageID}/` : sectionPath;
  const languageLinks = { zh: `${root}${pagePath}`, en: `${root}en/${pagePath}` };
  const download = `${root}${lang === "en" ? "en/" : ""}download/`;
  const landingCopy = LANDING[lang];
  const leading = landing
    ? `<a class="nav-text optional" href="#features">${landingCopy.nav_features}</a>
      <a class="nav-text" href="${home}store/">Store</a>
      <a class="nav-text optional" href="#buy">${landingCopy.nav_buy}</a>
      <span class="nav-sep" aria-hidden="true"></span>`
    : `<a class="nav-icon-button" href="${home}store/" aria-label="${copy.browse}" title="${copy.browse}">${NAV_ICONS.browse}</a>
      <a class="nav-icon-button optional" href="${SUBMIT_URL}" aria-label="${copy.submit}" title="${copy.submit}">${NAV_ICONS.submit}</a>`;
  const cta = landing
    ? `<a class="nav-download-button nav-trial" href="${download}">${landingCopy.nav_trial}</a>`
    : `<a class="nav-download-button" href="${download}" aria-label="${copy.download_app}" title="${copy.download_app}">${NAV_ICONS.download}<span>${copy.download_app}</span></a>`;
  return `<header class="site-nav"${landing ? ' id="site-nav" data-tone="dark"' : ""}><nav class="shell nav-inner" aria-label="${lang === "zh" ? "主导航" : "Main navigation"}">
    <a class="brand" href="${home}"><img src="${root}${APP_ICON_ASSET}" alt="" width="26" height="26"><strong>NotchAny</strong>${landing ? "" : "<span>Store</span>"}</a>
    <div class="nav-links">
      ${leading}
      <a class="nav-icon-button optional" href="${REPO_URL}" aria-label="${copy.github}" title="${copy.github}">${NAV_ICONS.github}</a>
      <a class="nav-account-button" data-account-link href="${escapeHTML(ACCOUNT_URL)}?lang=${lang}" aria-label="${lang === "zh" ? "我的账号" : "My account"}" title="${lang === "zh" ? "我的账号" : "My account"}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></svg></a>
      <div class="language-menu" id="language-menu">
        <button class="nav-icon-button" id="language-toggle" type="button" aria-label="${copy.language_menu}" title="${copy.language_menu}" aria-haspopup="menu" aria-expanded="false">${NAV_ICONS.language}</button>
        <div class="language-popover" id="language-popover" role="menu" hidden>
          <a href="${languageLinks.zh}" role="menuitem" lang="zh-Hans"${lang === "zh" ? ' aria-current="page"' : ""}>中文</a>
          <a href="${languageLinks.en}" role="menuitem" lang="en"${lang === "en" ? ' aria-current="page"' : ""}>English</a>
        </div>
      </div>
      ${cta}
    </div>
  </nav></header>`;
}

function footer({ lang, label = COPY[lang].footer }) {
  const copy = COPY[lang];
  return `<footer class="site-footer"><div class="shell footer-inner"><span>${label}</span><div class="footer-links"><a href="${REPO_URL}">${copy.source}</a><a href="${REPO_URL}#%E4%B8%8B%E8%BD%BD%E8%AE%A1%E6%95%B0">${copy.privacy}</a></div></div></footer>`;
}

function icon(item, root, className = "package-icon") {
  if (item.icon_path) return `<img class="${className}" src="${root}assets/${item.icon_path}" alt="" width="54" height="54">`;
  return `<span class="${className} fallback" aria-hidden="true">${item.kind === "widget" ? "▦" : "▶"}</span>`;
}

function profilePackageRow(item, lang, root) {
  const copy = COPY[lang];
  const name = pick(item.names, lang);
  const detailURL = `${root}${lang === "en" ? "en/" : ""}packages/${item.package_id}/`;
  const downloadURL = `${root}${lang === "en" ? "en/" : ""}download/`;
  return `<article class="package-row profile-package-row" data-profile-kind="${escapeHTML(item.kind)}">
    ${icon(item, root)}<div class="row-copy"><div class="row-title"><h3><a class="row-detail-link" href="${detailURL}">${escapeHTML(name)}</a></h3><span class="kind-mark">${escapeHTML(kindLabel(item, lang))}</span></div>
    <p class="row-summary">${escapeHTML(pick(item.summaries, lang))}</p><div class="row-meta"><span>v${escapeHTML(item.version)}</span></div></div>
    <a class="open-button install-button" href="notchany://market/package/${escapeHTML(item.package_id)}" data-fallback-url="${downloadURL}" aria-label="${escapeHTML(`${copy.install} ${name}`)}">${copy.install}</a>
  </article>`;
}

// 旧 App 按首发命名空间链接；不可借第一个包的现任 Owner 推断整页身份。
export function authorPage({ lang, namespace, packages, css, js, histories = {}, marketAPIBase = "" }) {
  const copy = COPY[lang];
  const root = lang === "zh" ? "../../" : "../../../";
  const sectionPath = `authors/${encodeURIComponent(namespace)}/`;
  const path = `/${lang === "en" ? "en/" : ""}${sectionPath}`;
  const alternate = `/${lang === "zh" ? "en/" : ""}${sectionPath}`;
  const label = lang === "zh" ? "发布作品" : "Published packages";
  const description = lang === "zh"
    ? `${namespace} 命名空间下的已发布小组件与动作。`
    : `Published widgets and actions in the ${namespace} namespace.`;
  const rows = packages.map(item => profilePackageRow(item, lang, root)).join("");
  return `${pageHead({ lang, title: `@${namespace} · NotchAny Store`, description,
    canonicalPath: path, alternatePath: alternate, imagePath: APP_ICON_ASSET, css })}
<body>${nav({ lang, root, sectionPath })}
<main class="shell profile-main" data-profile-page><div class="profile-layout">
  <aside class="profile-sidebar"><span class="profile-avatar fallback" aria-hidden="true">@</span><div class="profile-identity">
    <h1>@${escapeHTML(namespace)}</h1><p>${lang === "zh" ? "NotchAny Store 命名空间" : "NotchAny Store namespace"}</p></div>
    <div class="profile-stats"><span>${packages.length} ${lang === "zh" ? "个作品" : "packages"}</span></div>
    <a class="profile-github-link" href="https://github.com/${encodeURIComponent(namespace)}" aria-label="${copy.author_github}" title="${copy.author_github}">${NAV_ICONS.github}</a>
  </aside>
  <section class="profile-content"><div class="profile-section-head"><h2>${label}</h2></div>${profileControls(lang)}
    <div class="profile-package-list" id="profile-packages">${rows || `<p class="profile-empty">${lang === "zh" ? "暂无已发布作品" : "No published packages"}</p>`}</div><div id="profile-contributions" hidden></div><p id="profile-message" role="status" hidden></p>
  </section>
</div>
</main>${footer({ lang })}
<script>window.__NOTCHANY_STORE__=${inlineJSON({ language: lang, copy, packages: [], counts_url: "", profile: { namespace, packages: packages.map(item => profilePackage(item, lang, root)), histories, market_api: marketAPIBase } })};</script><script>${js}</script></body></html>`;
}

function profilePackage(item, lang, root) {
  return { ...packageClientData(item, lang, root), version: item.version,
    install_href: `notchany://market/package/${item.package_id}`,
    download_href: `${root}${lang === "en" ? "en/" : ""}download/` };
}

function profileControls(lang) {
  const zh = lang === "zh";
  return `<div class="profile-tools"><div class="profile-tabs" role="tablist" aria-label="${zh ? "贡献者内容" : "Contributor content"}"><button role="tab" data-profile-tab="packages" aria-selected="true">${zh ? "作品" : "Packages"}</button><button role="tab" data-profile-tab="contributions" aria-selected="false">${zh ? "参与贡献" : "Contributions"}</button></div><div class="profile-filters"><input id="profile-search" type="search" placeholder="${zh ? "搜索作品" : "Search packages"}" aria-label="${zh ? "搜索作品" : "Search packages"}"><div class="segment profile-kind-filter" role="group" aria-label="${zh ? "作品类型" : "Package type"}"><button type="button" data-profile-kind="all" aria-pressed="true">${zh ? "全部" : "All"}</button><button type="button" data-profile-kind="widget" aria-pressed="false">${zh ? "小组件" : "Widgets"}</button><button type="button" data-profile-kind="action" aria-pressed="false">${zh ? "动作" : "Actions"}</button></div></div></div>`;
}

export function contributorPage({ lang, packages, histories, marketAPIBase, css, js }) {
  const root = lang === "zh" ? "../" : "../../";
  const copy = COPY[lang];
  return `${pageHead({ lang, title: `${copy.contributors} · NotchAny Store`, description: copy.community,
    canonicalPath: `/${lang === "en" ? "en/" : ""}contributors/`, alternatePath: `/${lang === "zh" ? "en/" : ""}contributors/`, imagePath: APP_ICON_ASSET, css })}
<body>${nav({ lang, root, sectionPath: "contributors/" })}<main class="shell profile-main" data-profile-page>
<div class="profile-layout"><aside class="profile-sidebar"><span class="profile-avatar fallback" id="profile-avatar" aria-hidden="true">@</span><div class="profile-identity"><h1 id="profile-name">${copy.contributors}</h1><p id="profile-description">${copy.community}</p></div><div class="profile-actions"><a class="profile-github-link" id="profile-github" aria-label="${copy.author_github}" title="${copy.author_github}" hidden>${NAV_ICONS.github}</a><a id="profile-manage" href="${ACCOUNT_URL}?section=packages" hidden>${lang === "zh" ? "管理作品" : "Manage packages"}</a></div></aside>
<section class="profile-content"><div class="profile-section-head"><h2>${copy.author_works}</h2></div>${profileControls(lang)}<div id="profile-directory"></div><div class="profile-package-list" id="profile-packages"></div><div id="profile-contributions" hidden></div><p id="profile-message" role="status" hidden></p><button id="profile-retry" type="button" class="open-button" hidden>${copy.retry}</button></section></div>
</main>${footer({ lang })}<script>window.__NOTCHANY_STORE__=${inlineJSON({ language: lang, copy, packages: [], counts_url: "", profile: { packages: packages.map(item => profilePackage(item, lang, root)), histories, market_api: marketAPIBase } })};</script><script>${js}</script></body></html>`;
}

export function notFoundPage({ css }) {
  return `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>页面不存在 · NotchAny Store</title><style>${css}</style></head><body>
<main class="shell detail-main"><div class="breadcrumbs"><a href="${SITE_URL}/store/">NotchAny Store</a></div>
<header class="detail-hero"><img class="package-icon" src="/${APP_ICON_ASSET}" alt="" width="54" height="54">
<div class="detail-title"><h1>页面不存在</h1><p>地址可能已失效。请返回 Store 查找作品。</p><p lang="en">Page not found. Return to the Store to browse packages.</p>
<div class="detail-meta"><a href="${SITE_URL}/store/">返回 Store</a><a href="${SITE_URL}/en/store/" lang="en">Browse in English</a></div></div></header>
</main></body></html>`;
}

const KEYBOARD_ROWS = [
  [
    ["esc", "Escape", "escape"], ["F1", "F1"], ["F2", "F2"], ["F3", "F3"],
    ["F4", "F4"], ["F5", "F5"], ["F6", "F6"], ["F7", "F7"],
    ["F8", "F8"], ["F9", "F9"], ["F10", "F10"], ["F11", "F11"], ["F12", "F12"],
  ],
  [
    ["`", "Backquote"], ["1", "Digit1"], ["2", "Digit2"], ["3", "Digit3"], ["4", "Digit4"],
    ["5", "Digit5"], ["6", "Digit6"], ["7", "Digit7"], ["8", "Digit8"], ["9", "Digit9"],
    ["0", "Digit0"], ["−", "Minus"], ["=", "Equal"], ["delete", "Backspace", "delete"],
  ],
  [
    ["tab", "Tab", "tab"], ["Q", "KeyQ"], ["W", "KeyW"], ["E", "KeyE"], ["R", "KeyR"],
    ["T", "KeyT"], ["Y", "KeyY"], ["U", "KeyU"], ["I", "KeyI"], ["O", "KeyO"],
    ["P", "KeyP"], ["[", "BracketLeft"], ["]", "BracketRight"], ["\\", "Backslash", "backslash"],
  ],
  [
    ["caps", "CapsLock", "caps"], ["A", "KeyA"], ["S", "KeyS"], ["D", "KeyD"], ["F", "KeyF"],
    ["G", "KeyG"], ["H", "KeyH"], ["J", "KeyJ"], ["K", "KeyK"], ["L", "KeyL"],
    [";", "Semicolon"], ["'", "Quote"], ["return", "Enter", "return"],
  ],
  [
    ["shift", "ShiftLeft", "shift"], ["Z", "KeyZ"], ["X", "KeyX"], ["C", "KeyC"], ["V", "KeyV"],
    ["B", "KeyB"], ["N", "KeyN"], ["M", "KeyM"], [",", "Comma"], [".", "Period"],
    ["/", "Slash"], ["shift", "ShiftRight", "shift"],
  ],
  [
    ["fn", "Fn"], ["control", "ControlLeft", "control"], ["option", "AltLeft", "option"],
    ["command", "MetaLeft", "command"], ["", "Space", "space"], ["command", "MetaRight", "command"],
    ["option", "AltRight", "option"], ["◀", "ArrowLeft"], ["▲", "ArrowUp"], ["▼", "ArrowDown"], ["▶", "ArrowRight"],
  ],
];

function keyboard() {
  return KEYBOARD_ROWS.map((row) => `<div class="keyboard-row">${row.map(([label, code, width = ""]) =>
    `<button class="mac-key" type="button" data-code="${code}" data-width="${width}" aria-label="${label || "Space"}"><span>${label}</span></button>`
  ).join("")}</div>`).join("");
}

function packageClientData(item, lang, root) {
  return {
    package_id: item.package_id,
    owner: item.package_id.split("/")[0],
    kind: item.kind,
    kind_label: kindLabel(item, lang),
    name: pick(item.names, lang),
    summary: pick(item.summaries, lang),
    tags: item.tags || [],
    published_at: item.published_at,
    updated_at: item.updated_at,
    search: searchText(item),
    icon: item.icon_path ? `${root}assets/${item.icon_path}` : `${root}${APP_ICON_ASSET}`,
    href: `${root}${lang === "en" ? "en/" : ""}packages/${item.package_id}/`,
  };
}

function featuredCards(featured, lang, root) {
  const copy = COPY[lang];
  return featured.map((item) => `<a class="featured-card" href="${root}${lang === "en" ? "en/" : ""}packages/${item.package_id}/">
    ${icon(item, root)}<div><span class="eyebrow">${copy.featured_kind} · ${kindLabel(item, lang)}</span><h3>${escapeHTML(pick(item.names, lang))}</h3><p>${escapeHTML(pick(item.summaries, lang))}</p></div>
  </a>`).join("");
}

function featuredPackages(packages, featuredIDs) {
  return featuredIDs.map((id) => packages.find((item) => item.package_id === id)).filter(Boolean);
}

// 首页 = 产品落地段 + Store 入口底板；搜索与完整内容库只在 /store/。落地素材按内容哈希落在 landingAssets 下，可长期缓存。
export function homePage({ lang, packages, featuredIDs, css, js, landingAssets = "assets/landing" }) {
  const copy = COPY[lang];
  const L = LANDING[lang];
  const root = lang === "zh" ? "" : "../";
  const current = lang === "zh" ? "/" : "/en/";
  const alternate = lang === "zh" ? "/en/" : "/";
  const assets = `${root}${landingAssets}`;
  const download = `${root}${lang === "en" ? "en/" : ""}download/`;
  const store = `${root}${lang === "en" ? "en/" : ""}store/`;
  const buy = escapeHTML(`${ACCOUNT_URL}/buy?lang=${lang}`);
  const featured = featuredPackages(packages, featuredIDs);

  const facts = (items) => items?.length ? `<ul class="lp-facts">${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : "";
  const media = (name, reveal) => `<figure class="lp-media${reveal ? " reveal" : ""}"><video data-loop muted loop playsinline preload="none" aria-hidden="true" poster="${assets}/loops/${lang}/${name}.webp" src="${assets}/loops/${lang}/${name}.mp4"></video></figure>`;
  // 标题可含内联 <em>，按可信 HTML 输出；其余文案一律转义
  const feature = (name, extra = "") => `<section class="lp-feature" id="f-${name}"><div class="shell">
      <header class="lp-head reveal"><div><p class="lp-eyebrow">${escapeHTML(L[`${name}_eyebrow`])}</p><h2 class="display">${L[`${name}_title`]}</h2></div>
        <div><p class="lp-body">${escapeHTML(L[`${name}_body`])}</p>${facts(L[`${name}_facts`])}${extra}</div></header>
      ${media(name, true)}
    </div></section>`;
  const card = (name, id = name) => `<article class="lp-card reveal" id="f-${id}">
        <div class="lp-card-copy"><p class="lp-eyebrow">${escapeHTML(L[`${name}_eyebrow`])}</p><h2 class="display">${L[`${name}_title`]}</h2><p class="lp-body">${escapeHTML(L[`${name}_body`])}</p>${facts(L[`${name}_facts`])}</div>
        <div class="lp-media-wrap">${media(name, false)}</div>
      </article>`;
  const tiers = TIERS.map((count) => {
    const recommended = count === RECOMMENDED_TIER;
    const detail = count === 1 && L.tier_detail_1 ? L.tier_detail_1 : L.tier_detail.replace("{n}", count);
    return `<div class="tier${recommended ? " recommended" : ""}">${recommended ? `<span class="tier-badge">${escapeHTML(L.tier_badge)}</span>` : ""}<div class="tier-count display"><strong>${count}</strong><span>${escapeHTML(count === 1 ? L.tier_unit_1 : L.tier_unit_n)}</span></div><p>${escapeHTML(detail)}</p></div>`;
  }).join("");
  const faq = L.faq.map(([question, answer], index) => `<details${index === 0 ? " open" : ""}><summary>${escapeHTML(question)}</summary><p>${escapeHTML(answer)}</p></details>`).join("");

  return `${pageHead({ lang, title: `NotchAny · ${L.hero_title}`, description: L.hero_lede, canonicalPath: current, alternatePath: alternate, imagePath: APP_ICON_ASSET, css,
    siteName: "NotchAny", extraHead: `<script>document.documentElement.classList.add("js")</script>` })}
<body class="landing">
${nav({ lang, root, landing: true })}
<main>
  <section class="lp-hero"><div class="shell">
    <p class="lp-kicker">${escapeHTML(L.hero_kicker)}</p>
    <h1 class="display">${escapeHTML(L.hero_title)}</h1>
    <p class="lp-lede">${escapeHTML(L.hero_lede)}</p>
    <div class="lp-actions">
      <a class="lp-btn primary" href="${download}">${escapeHTML(L.cta_trial)}</a>
      <a class="lp-btn secondary" href="${buy}">${escapeHTML(L.cta_buy)}</a>
      <button class="lp-btn ghost" type="button" data-watch><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="play-ring" cx="12" cy="12" r="10.5"/><path class="play-tri" d="M10 8.2v7.6l6-3.8z"/></svg><span>${escapeHTML(L.cta_watch)}</span><span class="muted">${FILM_LENGTH}</span></button>
    </div>
    <p class="lp-meta"><span>${escapeHTML(L.hero_meta_os)}</span><span class="lp-meta-sep" aria-hidden="true"> · </span><span>${escapeHTML(L.hero_meta_notch)}</span></p>
  </div>
  <div class="shell lp-film"><div class="film-frame" id="film">
    <img id="film-poster" src="${assets}/hero-poster.webp" alt="" width="1600" height="900" fetchpriority="high">
    <video id="film-video" controls playsinline preload="none" hidden data-src="${assets}/${lang === "zh" ? "video.mp4" : "video-en.mp4"}"></video>
    <button class="film-play" type="button" data-play aria-label="${escapeHTML(L.cta_watch)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg></button>
    <span class="film-length">${FILM_LENGTH}</span>
  </div></div></section>
  <div id="features">
    ${feature("drop")}
    ${feature("builtins")}
    <section class="lp-feature" id="f-glance"><div class="shell lp-pair">
      ${card("music")}
      ${card("notify")}
    </div></section>
    ${feature("effects")}
    <section class="lp-feature" id="f-ai"><div class="shell lp-pair">
      ${card("agent")}
      ${card("ai", "assist")}
    </div></section>
    ${feature("customize")}
    ${feature("publish", `<a class="lp-link" href="${store}">${escapeHTML(L.publish_link)}</a>`)}
  </div>
  <section class="lp-buy" id="buy"><div class="shell">
    <header class="lp-center-head reveal"><p class="lp-eyebrow">${escapeHTML(L.buy_eyebrow)}</p><h2 class="display">${escapeHTML(L.buy_title)}</h2><p class="lp-body">${escapeHTML(L.buy_body)}</p></header>
    <div class="lp-tiers reveal">${tiers}</div>
    <p class="lp-tier-note">${escapeHTML(L.buy_tier_note)}</p>
    <div class="lp-actions"><a class="lp-btn primary" href="${buy}">${escapeHTML(L.buy_cta)}</a><a class="lp-btn secondary" href="${download}">${escapeHTML(L.cta_trial)}</a></div>
    <p class="lp-meta">${escapeHTML(L.buy_price_note)}</p>
  </div></section>
  <section class="lp-faq" id="faq"><div class="shell lp-faq-grid">
    <h2 class="display reveal">${escapeHTML(L.faq_title)}</h2>
    <div class="faq-list reveal">${faq}</div>
  </div></section>
  <section class="store-sheet" id="store"><div class="shell">
    <header class="store-head"><div><p class="store-kicker">NotchAny Store</p><h2 class="display">${escapeHTML(L.store_title)}</h2><p class="sub">${escapeHTML(L.store_body)}</p></div><a class="lp-btn primary store-enter" href="${store}">${escapeHTML(L.store_enter)}</a></header>
    ${featured.length ? `<div class="featured-grid">${featuredCards(featured, lang, root)}</div>` : ""}
  </div></section>
</main>
${footer({ lang, label: "NotchAny" })}
<script>window.__NOTCHANY_STORE__=${inlineJSON({ language: lang, copy, packages: [], counts_url: "" })};</script>
<script>${js}</script>
</body></html>`;
}

// 按句包成行内块：宽屏只在句间换行，避免中文逐字折行把「刘海」这类词拆开。
function sentenceSpans(text, lang) {
  return text.split(/(?<=[。！？])|(?<=[.!?])\s+/).map((sentence) => `<span>${escapeHTML(sentence)}</span>`).join(lang === "zh" ? "" : " ");
}

// 独立 Store 页：顶部模拟 MacBook，刘海托盘演示精选作品（无精选时取最新 3 个），下方为精选与完整内容库。
export function storePage({ lang, packages, featuredIDs, countsURL, css, js }) {
  const copy = COPY[lang];
  const L = LANDING[lang];
  const root = lang === "zh" ? "../" : "../../";
  const current = `${lang === "zh" ? "" : "/en"}/store/`;
  const alternate = `${lang === "zh" ? "/en" : ""}/store/`;
  const download = `${root}${lang === "en" ? "en/" : ""}download/`;
  const featured = featuredPackages(packages, featuredIDs);
  const trayPackages = featured.length ? featured : [...packages].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 3);
  const tags = [...new Set(packages.flatMap((item) => item.tags || []))].sort();
  const tray = trayPackages.length
    ? trayPackages.map((item) => `<a class="demo-tray-item" href="${root}${lang === "en" ? "en/" : ""}packages/${item.package_id}/" title="${escapeHTML(pick(item.names, lang))}">
    ${icon(item, root, "demo-tray-icon")}<span>${escapeHTML(pick(item.names, lang))}</span>
  </a>`).join("")
    : `<p class="demo-tray-empty">${escapeHTML(copy.tray_empty)}</p>`;
  const search = (id, className, shortcut) => `<label class="search-box${className}"><span hidden>${copy.search}</span><input id="${id}" data-store-search type="search" autocomplete="off" aria-label="${escapeHTML(copy.search)}" placeholder="${escapeHTML(copy.search)}">${shortcut ? `<span class="search-key"><kbd>⌘ K</kbd> / <kbd>/</kbd></span>` : ""}</label>`;
  const catalog = packages.length
    ? `<div class="section-head"><div><h2>${copy.all_packages}</h2><p>${copy.all_packages_note}</p></div>${search("library-search", " catalog-search", false)}</div>
    <div class="catalog-tools">
      <div class="tool-row"><span class="tool-label">${copy.sort}</span><div class="segment" aria-label="${copy.sort}"><button type="button" data-sort="all">${copy.all}</button><button type="button" data-sort="recent">${copy.recent}</button><button type="button" data-sort="popular">${copy.popular}</button></div></div>
      <div class="tool-row"><span class="tool-label">${copy.type}</span><div class="segment" aria-label="${copy.type}"><button type="button" data-kind="all">${copy.all}</button><button type="button" data-kind="widget">${copy.widget}</button><button type="button" data-kind="action">${copy.action}</button></div></div>
      <div class="tool-row"><span class="tool-label">${copy.tags}</span>${tags.map((tag) => `<button class="chip" type="button" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join("")}<button class="clear-button" id="clear-filters" type="button">${copy.clear}</button></div>
    </div>
    <div class="result-line"><span id="result-count" aria-live="polite"></span><span class="popular-status" id="popular-status"></span></div>
    <div class="catalog-list" id="catalog-list"></div><nav class="pagination" id="pagination" aria-label="${lang === "zh" ? "分页" : "Pagination"}"></nav>`
    : `<div class="store-empty">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>
      <strong>${escapeHTML(L.store_empty_title)}</strong><p>${escapeHTML(L.store_empty_body)}</p>
      <div class="store-links"><a class="store-button primary" href="${download}">${escapeHTML(L.cta_trial)}</a><a class="store-button" href="${SUBMIT_URL}">${copy.submit}</a></div>
    </div>`;

  return `${pageHead({ lang, title: copy.hero_title, description: copy.hero_body, canonicalPath: current, alternatePath: alternate, imagePath: APP_ICON_ASSET, css })}
<body>
${nav({ lang, root, sectionPath: "store/" })}
<main>
  <section class="hero-band"><div class="shell hero">
    <div class="hero-copy"><p class="hero-kicker">${escapeHTML(copy.hero_kicker)}</p><h1>${escapeHTML(copy.hero_title)}</h1><p class="hero-subtitle">${sentenceSpans(copy.hero_body, lang)}</p>
      ${packages.length ? search("store-search", "", true) : ""}
    </div>
    <div class="mac-scene" id="mac-scene">
      <div class="macbook">
        <div class="mac-display">
          <div class="mac-desktop" style="--desktop-wallpaper:url('${root}assets/macos-desktop-wallpaper.webp')">
            <div class="mac-menu-bar">
              <div class="menu-left"><img src="${root}${APP_ICON_ASSET}" alt="" width="14" height="14"><strong>NotchAny</strong><span>${lang === "zh" ? "文件" : "File"}</span><span>${lang === "zh" ? "编辑" : "Edit"}</span><span>${lang === "zh" ? "显示" : "View"}</span></div>
              <div class="menu-right"><span class="menu-control" aria-hidden="true"></span><span id="mac-menu-date"></span><strong id="mac-menu-time"></strong></div>
            </div>
            <div class="notch-hot-zone" id="notch-stage">
              <div class="demo-notch" id="demo-notch" aria-expanded="false">
                <span class="notch-camera" aria-hidden="true"></span>
                <div class="demo-tray-items">${tray}</div>
              </div>
            </div>
            <div class="desktop-dock" aria-hidden="true"><img src="${root}${APP_ICON_ASSET}" alt=""><span class="dock-app dock-app-coral"></span><span class="dock-app dock-app-paper"></span><span class="dock-divider"></span><span class="dock-trash"></span></div>
          </div>
        </div>
        <div class="mac-hinge"></div>
        <div class="keyboard-deck" id="keyboard-deck">
          <div class="speaker speaker-left"></div><div class="speaker speaker-right"></div>
          <div class="keyboard">${keyboard()}</div>
          <button class="trackpad" id="trackpad" type="button" aria-label="${lang === "zh" ? "触控板" : "Trackpad"}"></button>
        </div>
        <div class="mac-lip"></div>
      </div>
    </div>
  </div></section>
  ${featured.length ? `<section class="section" id="featured-section"><div class="shell"><div class="section-head"><div><h2>${copy.featured}</h2><p>${copy.featured_note}</p></div></div><div class="featured-grid">${featuredCards(featured, lang, root)}</div></div></section>` : ""}
  <section class="section" id="catalog"><div class="shell">
    ${catalog}
  </div></section>
</main>
${footer({ lang })}
<script>window.__NOTCHANY_STORE__=${inlineJSON({ language: lang, copy, packages: packages.map((item) => packageClientData(item, lang, root)), counts_url: packages.length ? countsURL || "" : "" })};</script>
<script>${js}</script>
</body></html>`;
}

export function downloadPage({ lang, css, js, downloadURL = "" }) {
  const copy = COPY[lang];
  const root = lang === "zh" ? "../" : "../../";
  const current = `${lang === "zh" ? "" : "/en"}/download/`;
  const alternate = `${lang === "zh" ? "/en" : ""}/download/`;
  const downloadControl = downloadURL
    ? `<a class="primary-button download-primary" href="${escapeHTML(downloadURL)}">${NAV_ICONS.download}<span>${copy.download_now}</span></a>`
    : `<button class="primary-button download-primary" type="button" disabled aria-disabled="true">${NAV_ICONS.download}<span>${copy.download_pending}</span></button>`;
  return `${pageHead({ lang, title: `${copy.download_title} · NotchAny`, description: copy.download_body, canonicalPath: current, alternatePath: alternate, imagePath: APP_ICON_ASSET, css })}
<body>
${nav({ lang, root, sectionPath: "download/" })}
<main class="download-main">
  <section class="shell download-hero">
    <img class="download-app-icon" src="${root}${APP_ICON_ASSET}" alt="" width="96" height="96">
    <p class="download-kicker">${copy.download_kicker}</p>
    <h1>${copy.download_title}</h1>
    <p class="download-body">${copy.download_body}</p>
    <div class="download-actions">${downloadControl}<a class="download-project-link" href="${APP_URL}">${copy.project_home}</a></div>
    <p class="download-note">${downloadURL ? copy.download_requirement : copy.download_pending_note}</p>
    <p class="download-requirement">${copy.download_requirement}</p>
  </section>
</main>
${footer({ lang, root })}
<script>window.__NOTCHANY_STORE__=${inlineJSON({ language: lang, copy, packages: [], counts_url: "" })};</script>
<script>${js}</script>
</body></html>`;
}

export function detailPage({ lang, item, packages, history = { releases: [], contributors: [] }, marketAPIBase = "", countsURL, css, js }) {
  const copy = COPY[lang];
  const root = lang === "zh" ? "../../../" : "../../../../";
  const path = `${lang === "zh" ? "" : "/en"}/packages/${item.package_id}/`;
  const alternate = `${lang === "zh" ? "/en" : ""}/packages/${item.package_id}/`;
  const name = pick(item.names, lang);
  const summary = pick(item.summaries, lang);
  const owner = item.package_id.split("/")[0];
  const related = relatedPackages(item, packages).map((other) => `<a class="related-item" href="${root}${lang === "en" ? "en/" : ""}packages/${other.package_id}/">${icon(other, root)}<span><strong>${escapeHTML(pick(other.names, lang))}</strong><span>${kindLabel(other, lang)}</span></span></a>`).join("");
  const requirements = item.requires?.length ? item.requires.map(escapeHTML).join(", ") : copy.none;
  const sourceURL = `${REPO_URL}/tree/main/published/${item.package_id}`;
  const issueURL = `${REPO_URL}/issues/new?title=${encodeURIComponent(`[${item.package_id}] `)}`;
  const download = `${root}${lang === "en" ? "en/" : ""}download/`;
  const description = pick(item.descriptions, lang) || summary;
  const historyHTML = historySections(history, copy, lang);
  return `${pageHead({ lang, title: `${name} · NotchAny Store`, description: summary, canonicalPath: path, alternatePath: alternate, imagePath: item.icon_path ? `assets/${item.icon_path}` : APP_ICON_ASSET, css })}
<body>
${nav({ lang, root, detailPackageID: item.package_id })}
<main class="shell detail-main">
  <header class="detail-hero package-hero">
    ${icon(item, root)}
    <div class="detail-title"><h1>${escapeHTML(name)}</h1><p>${escapeHTML(summary)}</p><div class="detail-meta"><span>${copy.by} <a href="${root}${lang === "en" ? "en/" : ""}authors/${encodeURIComponent(owner)}/">${escapeHTML(owner)}</a></span><span class="detail-install-meta" data-download-count="${escapeHTML(item.package_id)}" data-count-style="installs-inline">${copy.count_loading}</span></div></div>
    <div class="detail-action"><a class="primary-button" id="open-in-notchany" href="notchany://market/package/${escapeHTML(item.package_id)}" data-fallback-url="${download}">${copy.open_app}</a></div>
  </header>
  <div class="detail-layout"><article>
    <div class="prose"><h2>${copy.about}</h2>${renderMarkdown(description)}<h2>${copy.safety}</h2><p class="risk-note"><strong>${item.action_kind === "shell" ? copy.safety_shell : copy.safety_plain}</strong></p></div>
    ${historyHTML.releasesHTML ? `<section class="history-section"><h2>${copy.history}</h2><div class="release-list">${historyHTML.releasesHTML}</div></section>` : ""}
  </article>
  <aside class="side-info" aria-label="${copy.info}">
    <section class="side-community" data-community-package="${escapeHTML(item.package_id)}" data-market-api="${escapeHTML(marketAPIBase)}"><h2>${copy.community}</h2><div class="contributor-roster"><div class="identity-list" data-community-owner><span class="community-status">${copy.community_unavailable}</span></div><div class="identity-list" data-community-maintainers></div>${historyHTML.contributorHTML}</div></section>
    <div class="side-details">
      <div class="info-group"><span class="info-label">${copy.package_id}</span><code class="info-value">${escapeHTML(item.package_id)}</code></div>
      <div class="info-group"><span class="info-label">${copy.version}</span><span class="info-value">${escapeHTML(item.version)}</span></div>
      <div class="info-group"><span class="info-label">${copy.updated}</span><span class="info-value">${date(item.updated_at, lang)}</span></div>
      <div class="info-group"><span class="info-label">${copy.size}</span><span class="info-value">${formatBytes(item.size_bytes)}</span></div>
      <div class="info-group"><span class="info-label">${copy.license}</span><span class="info-value">${escapeHTML(item.license)}</span></div>
      <div class="info-group"><span class="info-label">${copy.requirements}</span><span class="info-value">${requirements}</span></div>
      <div class="info-group"><a class="info-link" href="${sourceURL}">${copy.source_code}</a><a class="info-link" href="${issueURL}">${copy.report}</a><a class="info-link" href="${issueURL}">${copy.improve}</a></div>
    </div>
  </aside></div>
  ${related ? `<section class="related"><h2>${copy.related}</h2><div class="related-list">${related}</div></section>` : ""}
</main>
${footer({ lang, root })}
<script>window.__NOTCHANY_STORE__=${inlineJSON({ language: lang, copy, packages: [], counts_url: countsURL || "" })};</script>
<script>${js}</script>
</body></html>`;
}
