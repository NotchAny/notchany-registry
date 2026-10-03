# NotchAny Registry

[NotchAny](https://notchany.com)（macOS 刘海工具）的动作 / 小组件公开 Registry：负责 PR 上架、CI 校验、正式发布快照、静态 index 与版本历史。

- **索引**：`index/v1/index.json`（旧 App）与 `index/v2/index.json`（带 `history_path`）
- **历史**：`history/v1/<namespace>/<slug>.json`（版本、PR 说明、commit、hash 与贡献者）
- **已发布包体**：`published/<namespace>/<slug>/package.notchany.json`（经授权的固定快照）
- **候选源码**：`packages/<namespace>/<slug>/package.notchany.json`（PR 修改区域，合并不等于发布）
- **元数据**：`packages/<namespace>/<slug>/manifest.json`（名称/简介/版本/标签等，按语言码逐条提供）

Registry 是包内容、最新版、版本历史和贡献事实的真源。NotchAny Market D1 只保存账号的 GitHub
数字身份投影、包归属、维护权限与邀请；不会复制包内容、release notes 或历史包 hash。

## 目录规范

```
packages/
  <namespace>/                # 首次发布后永久稳定，不随 GitHub 改名或 Owner 转让移动
    <slug>/                   # 包目录名：^[a-z0-9][a-z0-9-]{1,63}$
      package.notchany.json   # NotchAny 设置页导出的 .notchany.json 原样
      manifest.json           # 上架元数据（格式见 schema/manifest.schema.json）
      icon.png                # 必需：安装后的真实图标，方形 PNG，256–1024px，≤512KB
      screenshots/            # 可选：主语言截图，最多 4 张 .png/.jpg，单张 ≤1MB
        <locale>/             # 可选：其他语言的截图，每组同样最多 4 张
```

`manifest.json` 形状（`manifest_version: 1`，完整约束见 [schema](schema/manifest.schema.json)）：

```json
{
  "manifest_version": 1,
  "names": { "zh-Hans": "CPU 占用", "en": "CPU Usage" },
  "summaries": { "zh-Hans": "≤80 字的一句话简介", "en": "One-line summary" },
  "descriptions": { "zh-Hans": "markdown 详细说明", "en": "…" },
  "version": "1.0.0",
  "tags": ["monitor"],
  "license": "MIT",
  "default_locale": "zh-Hans"
}
```

- `summaries` 不要求双语，只需提供一种语言；`default_locale` 是包的主语言，填写时 `summaries`
  必须包含这个语言的摘要。其他语言的名称、摘要和描述都可以不写，缺失时按访问者的语言回落到已提供的语言。
- 截图按语言分组：主语言截图直接放在 `screenshots/` 下；其他语言放在 `screenshots/<locale>/`，
  目录名是合法语言码（如 `en`、`zh-Hant`、`ja`），且只允许一层、不能与主语言同名。出现语言子目录时
  必须声明 `default_locale`。某语言没有截图组时展示主语言截图。

## 上架流程（PR）

1. 在 NotchAny 设置页导出你的动作/小组件，得到 `.notchany.json` 封套文件。
2. 登录 NotchAny 账号页并在「市场协作」绑定 GitHub；Fork 本仓库，在
   `packages/<你的 GitHub 用户名>/<slug>/` 下放入
   `package.notchany.json`（导出文件原样改名）、`manifest.json` 与发布向导自动生成的
   `icon.png`；建议同时提供真实 NotchAny 运行界面截图。`icon.png` 与动作/小组件安装后
   的 `symbol`、文字或图片图标同源，不要另做一套市场封面。
3. 提交 PR。CI（`scripts/check-pr.mjs`）自动校验，全绿后由 maintainer 审核合并。
4. 合并进 main 后，可信工作流重验 Review 和维护权限，生成独立发布 PR。签名清单绑定候选提交和全部产物；合入前再次校验，成功后一次公开快照、双索引与历史，再显式调度 Market 对账与官网部署。官网由独立私有仓库从固定 Registry commit 构建。
5. 更新包 = 再次 PR 同一目录，`manifest.json` 的 `version` **必须严格递增**。

每个 PR 只能改一个包且只能触及 `packages/**`。创建包要求 PR 作者已绑定 GitHub；更新允许 Owner
或共同维护者直接提交，也允许普通贡献者取得当前 Owner/维护者对对应 head 的有效 Review；普通贡献者不能自批。下架只允许 Owner。权限判断使用 GitHub 数字 user ID，不依赖可变用户名或
`MAINTAINERS` 文件。`index/`、`history/`、`schema/`、`scripts/` 由仓库维护流程生成或维护。
本地可先自检：

```bash
node scripts/check-pr.mjs      # 全量校验所有包
npm run build:index            # 重建 v1/v2 index 与 history（maintainer 用）
```

## 脱敏要求（硬校验）

导出文件可能带上你本机的参数值，上架前必须脱敏：

- `action.parameter_values` **必须删除**——它是你的本机参数当前值（可能含个人路径、
  密钥、账号信息），CI 检测到即拒绝。参数默认值请写在 `parameters` 声明的 `default` 里。
- 脚本内不得内嵌任何密钥/token/个人路径；需要密钥的服务应引导用户配置参数或环境变量。
- 会把用户数据发给第三方服务的包，必须在 `descriptions` 里写明服务名、域名与发送字段。

## 审核标准

- 脚本可读、无混淆、无编码/压缩后的不可审计内容；
- 不做与描述无关的事：不偷偷联网上传、不写入包外文件、不修改系统配置；
- 依赖第三方 CLI 的在 `action.requires` 中声明（App 导入时会检测提示）；
- `manifest.json` 至少提供主语言的名称与摘要，描述与实际行为一致；
- 小组件类建议先用 `notchany-cli test-widget` 自测通过再提交。

## 安全模型

市场的信任链条：

1. **PR 审核**：所有包经 CI 机器校验 + maintainer 人工审核脚本全文后才进入 main。
2. **sha256 锁定**：`index/v1/index.json` 记录每个包文件的 `sha256` 与 `size_bytes`；
   App 优先经匿名计数 Worker、失败时经 GitHub raw 拉取包体；每个来源都必须
   **先校验 sha256** 再解析——index 与包体
   不一致（如 CDN 缓存不同步、中间人篡改）时拒绝安装。
3. **安装前脚本全文确认**：NotchAny 导入市场包时向用户展示动作的**完整脚本源码**、
   依赖声明与权限面（文件输入/实况/触发器），用户确认后才落库。脚本以用户身份在本机
   执行——请始终读一遍再确认。
4. **版本可追溯**：`version` 严格递增；每版 history 固化可验证的合并时间、源 commit、当版包 sha256、
   PR 标题/正文/URL/作者和可识别的 commit 作者。裸邮箱与无法映射的作者不公开，历史不提供旧包下载。
5. **失败隔离**：索引、官网、下载服务与对账只读 `published/state.json` 对应的快照。失败的候选留在 `packages/`，后续建站不能带出；回退使用上次成功公开提交的发布目录、双索引与历史。

## 身份、角色与历史

- Owner 可发布、改资料、管理维护者、转让、下架；共同维护者可发布、改资料和管理其他维护者，
  但不能移除 Owner、转让或下架；贡献者只公开署名，没有管理权限。
- 邀请在账号 Web 页创建，14 天过期；接受者必须登录并绑定被邀请的同一 GitHub 数字 ID。
- `package_id` 和 Registry 目录首次发布后永久保留。GitHub 改名、Owner 转让和下架都不会改变深链，
  下架后也不能被其他人复用；Owner 可用更高版本 PR 重新上架。
- 版本说明逐字来自合并 PR 标题和正文，页面只渲染白名单清洗后的 Markdown。每版贡献者按 PR 作者
  优先、commit 首次出现顺序排列；包级贡献者并集按最近贡献时间排列。
- App 与 Web 可用 Market 公共接口刷新用户名、头像和「已绑定 NotchAny」标识；接口失败时继续使用
  history 的发布时快照，不影响浏览、校验或安装最新版。

## 官网与下载服务

`notchany.com`、Store 前端、Store Worker 与匿名下载计数 Worker 已迁移到私有仓库
`NotchAny/notchany-site`。该仓库构建时检出一个确定的 Registry commit，只消费
`published/state.json`、`index/`、`history/` 与 `published/`；不会把候选 `packages/` 作为网页或下载来源。

本公开仓库不再保存官网源码、Cloudflare 部署配置或生产凭据。社区贡献者可以审阅和修改包候选，
但不能借包 PR 改动官网发布链。

发布 PR 合入后，`validate-publication.yml` 用 repository secret `SITE_DEPLOY_TOKEN` 调度 Site 仓库的
`deploy.yml`，新包即刻上架。该 token 是只授权 `NotchAny/notchany-site`、仅含 Actions 读写权限的
fine-grained PAT，只能触发部署，不能读取 Cloudflare 凭据；Site 仓库只接受 Registry main 历史上的提交。
未配置、过期或调度失败时发布照常完成，官网由 Site 仓库的整点 cron 兜底刷新。

## CI 与 Market 配置

GitHub Actions 必须配置仓库 variable `MARKET_API_BASE`（如 `https://account.notchany.com`）和
repository secret `MARKET_INTERNAL_HMAC_SECRET`（与 Commercial Worker 同一份至少 32 字节密钥）。
PR 授权、release 登记和 reconciliation 都使用带 5 分钟时间窗的 HMAC；Market 不可用或验签失败时
发布流程 fail closed。

默认分支必需状态为 `market/content-and-permission`，并要求分支与 main 同步。普通包 PR、生成发布 PR、仓库维护 PR 分别校验包权限、签名清单及当前管理员身份；维护 PR 不得夹带包或生成产物。
`pr-validate.yml` 只运行 main 上的可信脚本；PR 内容作为数据。Review 事件通过无凭据工作流通知可信工作流；每五分钟重验公开 PR，覆盖撤回 Review、撤权及身份解绑。
普通包 PR 在内容与权限校验通过后由可信 workflow 以受审 head SHA 自动 squash merge：首次创建要求作者已绑定 GitHub；Owner/共同维护者更新可直接合并；其他贡献必须先取得当前 Owner 或共同维护者对当前 head 的批准。合并前再次核对 head、base、Review 与 `policy_revision`；分支落后于 main 时由 workflow 先同步并显式调度新 head 的全套校验，其他变化则停止合并。
组织与仓库两级都需开启 Actions「允许创建和批准 PR」，并赋可信检查与发布工作流 contents、pull-requests、statuses、actions 写权限。机器人合并普通包 PR 后显式调度 `publish-index.yml`；机器人创建发布 PR 后显式调度 `validate-publication.yml`，成功合入后显式调度 `reconcile-market.yml` 与 Site 仓库的 `deploy.yml`，不依赖机器人触发 push 事件。Cloudflare 部署凭据只存在于私有 Site 仓库。

`main` 分支保护：必需状态 `market/content-and-permission`（strict）、管理员同样受限、线性历史、
对话须解决，禁止强推与删除。

`Reconcile Market` workflow 可手动或每日运行，修复合并成功但回调失败造成的状态漂移。首次回填会
调用 GitHub API 将 namespace 解析为数字 ID；workflow 使用内置 `GITHUB_TOKEN`，本地执行可传
`GITHUB_API_TOKEN`（也兼容 `GITHUB_TOKEN`）提高配额：

```bash
MARKET_API_BASE=https://account.notchany.com \
MARKET_INTERNAL_HMAC_SECRET='<shared secret>' \
GITHUB_API_TOKEN='<optional token>' \
npm run reconcile:market
```

## 下载计数

下载服务源码与 Cloudflare 配置位于私有 Site 仓库。服务仍只依据本仓库正式 index 定位
`published/` 包体并校验 SHA-256；KV 只保存每个包的聚合次数，不记录请求者 IP、User-Agent 或设备信息。

## 本仓库文件

| 路径 | 说明 |
| --- | --- |
| `packages/` | 候选源码（普通贡献 PR 的唯一可改区域） |
| `published/` | 最近成功发布的完整包快照和状态清单 |
| `publication/` | 签名发布清单（首次发布后生成） |
| `index/v1/index.json` | 静态索引（CI 生成，勿手改） |
| `index/v2/index.json` | 带 `history_path` 的静态索引（CI 生成，勿手改） |
| `history/v1/` | 每包只读版本历史与贡献者快照（CI 生成，勿手改） |
| `schema/manifest.schema.json` | manifest 的 JSON Schema（draft-07） |
| `scripts/check-pr.mjs` | PR / 本地校验脚本（Node ≥18，零依赖） |
| `scripts/build-index.mjs` | index 生成脚本（Node ≥18，零依赖） |
| `scripts/authorize-pr.mjs` | 可信默认分支运行的单包范围与 Market 权限校验 |
| `scripts/notify-release.mjs` | 兼容入口，按已发布快照对账 |
| `scripts/reconcile-market.mjs` | Registry → Market 状态对账（不覆盖既有 Owner） |
