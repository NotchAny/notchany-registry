# NotchAny Registry

**English** | [简体中文](README_CN.md)

The public action and widget registry for [NotchAny](https://notchany.com), a macOS notch utility. This repository handles PR-based submissions, CI validation, official publication snapshots, static indexes, and version history.

- **Indexes**: `index/v1/index.json` for older app versions and `index/v2/index.json` with `history_path`
- **History**: `history/v1/<namespace>/<slug>.json` for versions, PR release notes, commits, hashes, and contributors
- **Published packages**: `published/<namespace>/<slug>/package.notchany.json`, an authorized immutable snapshot
- **Candidate source**: `packages/<namespace>/<slug>/package.notchany.json`, the PR-editable area; merging does not publish it directly
- **Metadata**: `packages/<namespace>/<slug>/manifest.json` for localized names, summaries, versions, tags, and related data

The registry is the source of truth for package contents, latest versions, version history, and contribution records. NotchAny Market D1 stores only projections of accounts' numeric GitHub identities, package ownership, maintainer permissions, and invitations. It does not duplicate package contents, release notes, or historical package hashes.

## Directory Layout

```
packages/
  <namespace>/                # Permanently stable after first publication; unaffected by GitHub renames or ownership transfers
    <slug>/                   # Package directory: ^[a-z0-9][a-z0-9-]{1,63}$
      package.notchany.json   # Original .notchany.json envelope exported from NotchAny Settings
      manifest.json           # Store metadata; see schema/manifest.schema.json
      icon.png                # Required: actual installed icon, square PNG, 256-1024 px, <=512 KB
      screenshots/            # Optional: primary-locale screenshots, up to four .png/.jpg files, <=1 MB each
        <locale>/             # Optional: screenshots for another locale, also up to four files per group
```

`manifest.json` has the following shape (`manifest_version: 1`; see the [schema](schema/manifest.schema.json) for all constraints):

```json
{
  "manifest_version": 1,
  "names": { "zh-Hans": "CPU 占用", "en": "CPU Usage" },
  "summaries": { "zh-Hans": "≤80 字的一句话简介", "en": "One-line summary" },
  "descriptions": { "zh-Hans": "markdown 详细说明", "en": "Detailed Markdown description" },
  "version": "1.0.0",
  "tags": ["monitor"],
  "license": "MIT",
  "default_locale": "zh-Hans"
}
```

- `summaries` does not need to be bilingual; one language is sufficient. `default_locale` identifies the package's primary language. When set, `summaries` must include that locale. Names, summaries, and descriptions for other locales are optional, and missing content falls back to an available locale based on the visitor's language.
- Screenshots are grouped by locale. Put primary-locale screenshots directly under `screenshots/` and other locales under `screenshots/<locale>/`. Directory names must be valid locale identifiers such as `en`, `zh-Hant`, or `ja`, may be only one level deep, and must not match the primary locale. A manifest with locale subdirectories must declare `default_locale`. If a locale has no screenshot group, the primary-locale screenshots are shown.

## Publishing Through a PR

1. Export your action or widget from NotchAny Settings to obtain a `.notchany.json` envelope file.
2. Sign in to your NotchAny account, connect GitHub under Market Collaboration, and fork this repository. Add the exported file as `package.notchany.json`, along with `manifest.json` and the release wizard's generated `icon.png`, under `packages/<your GitHub username>/<slug>/`. Screenshots of the package running in NotchAny are recommended. The `icon.png` must come from the same symbol, text, or image icon installed with the action or widget; do not create a separate marketplace cover.
3. Open a PR. CI runs `scripts/check-pr.mjs` automatically. A maintainer reviews and merges the PR after all checks pass.
4. After the PR is merged into `main`, a trusted workflow revalidates the review and maintainer permissions, then creates a separate publication PR. A signed manifest binds the candidate commit to every generated artifact. The publication is validated again before merge; a successful merge exposes the snapshot, both indexes, and history atomically, then explicitly dispatches Market reconciliation and the website deployment. The website is built by a separate private repository from a pinned Registry commit.
5. To update a package, open another PR against the same directory. The `version` in `manifest.json` **must increase strictly**.

Each PR may modify only one package and may touch only `packages/**`. Creating a package requires the PR author to have a connected GitHub identity. An update may be submitted directly by the owner or a maintainer. Other contributors need a valid review of the exact head commit from the current owner or a maintainer and cannot approve their own contribution. Only the owner may unlist a package. Authorization uses numeric GitHub user IDs rather than mutable usernames or the `MAINTAINERS` file. The repository maintenance workflow owns `index/`, `history/`, `schema/`, and `scripts/`.

Run local validation before submitting:

```bash
node scripts/check-pr.mjs      # Validate all packages
npm run build:index            # Rebuild v1/v2 indexes and history; maintainers only
```

## Redaction Requirements

Exported files may include parameter values from your machine. They must be redacted before publication:

- `action.parameter_values` **must be removed**. It contains the current local parameter values and may include personal paths, secrets, or account information. CI rejects any package containing it. Put parameter defaults in the `default` field of the `parameters` declaration.
- Scripts must not embed secrets, tokens, or personal paths. Services that require credentials should direct users to configure parameters or environment variables.
- Packages that send user data to third-party services must identify the service, domain, and transmitted fields in `descriptions`.

## Review Criteria

- Scripts must be readable and must not contain obfuscated, encoded, or compressed content that cannot be audited.
- Packages must not perform behavior unrelated to their descriptions, including undisclosed uploads, writes outside the package's expected files, or system configuration changes.
- Third-party CLI dependencies must be declared in `action.requires` so the app can detect and report them during import.
- `manifest.json` must provide at least the primary locale's name and summary, and its descriptions must match actual behavior.
- Widget authors should run `notchany-cli test-widget` successfully before submitting.

## Security Model

The marketplace trust chain has five layers:

1. **PR review**: Every package must pass automated CI validation and a maintainer's manual review of the complete script before it can enter `main`.
2. **sha256 pinning**: `index/v1/index.json` records each package file's `sha256` and `size_bytes`. The app fetches packages through the anonymous counting Worker when available and falls back to GitHub raw content. It must **verify sha256 before parsing** every source. Installation is rejected if the index and package differ, including CDN synchronization failures or tampering in transit.
3. **Full script confirmation before installation**: Before importing a marketplace package, NotchAny shows the action's **complete script source**, dependency declarations, and permission surface, including file input, live activity, and triggers. The package is stored only after the user confirms it. Scripts run locally as the user, so read the source before confirming.
4. **Traceable versions**: Versions increase strictly. Each history entry records a verifiable merge time, source commit, package sha256, PR title, body, URL, author, and identifiable commit authors. Bare email addresses and authors that cannot be mapped are not published, and history does not provide old package downloads.
5. **Failure isolation**: Indexes, the website, download services, and reconciliation read only the snapshot referenced by `published/state.json`. Failed candidates remain under `packages/` and cannot leak into later site builds. Rollback uses the last successfully published directory, indexes, and history.

## Identity, Roles, and History

- Owners may publish, edit metadata, manage maintainers, transfer ownership, and unlist packages. Maintainers may publish, edit metadata, and manage other maintainers, but cannot remove the owner, transfer ownership, or unlist a package. Contributors receive public attribution but no management permissions.
- Invitations are created on the account website and expire after 14 days. The recipient must sign in and connect the same numeric GitHub identity that was invited.
- A `package_id` and its registry directory are permanently reserved after first publication. GitHub renames, ownership transfers, and unlisting do not change deep links, and an unlisted ID cannot be reused by another account. The owner may relist it with a higher-version PR.
- Release notes are copied verbatim from the merged PR title and body, and pages render only allowlisted, sanitized Markdown. Contributors for each version are ordered with the PR author first, followed by commits in first-appearance order. The package-level contributor union is ordered by most recent contribution.
- The app and Web Store may use the public Market API to refresh usernames, avatars, and the Connected to NotchAny badge. If the API is unavailable, they continue using the publication-time snapshot in history without affecting browsing, verification, or installation of the latest version.

## Website and Download Services

`notchany.com`, the Store frontend, the Store Worker, and the anonymous download-count Worker have moved to the private `NotchAny/notchany-site` repository. Its build checks out a pinned Registry commit and consumes only `published/state.json`, `index/`, `history/`, and `published/`. Candidate packages under `packages/` are never used as website or download sources.

This public repository no longer stores website source code, Cloudflare deployment configuration, or production credentials. Community contributors can review and modify package candidates but cannot change the website delivery chain through a package PR.

After a publication PR is merged, `validate-publication.yml` uses the repository secret `SITE_DEPLOY_TOKEN` to dispatch the Site repository's `deploy.yml`, so new packages go live immediately. The token is a fine-grained PAT scoped only to `NotchAny/notchany-site` with Actions read/write permission; it can trigger deployments but cannot read Cloudflare credentials, and the Site repository accepts only commits from Registry `main` history. If the token is missing, expired, or the dispatch fails, publication still completes and the Site repository's hourly cron refreshes the website as a fallback.

## CI and Market Configuration

GitHub Actions requires the repository variable `MARKET_API_BASE`, such as `https://account.notchany.com`, and the repository secret `MARKET_INTERNAL_HMAC_SECRET`, which must be the same secret of at least 32 bytes used by the Commercial Worker. PR authorization, release registration, and reconciliation all use HMAC with a five-minute validity window. Publication fails closed when Market is unavailable or signature verification fails.

The required status on the default branch is `market/content-and-permission`, and the branch must be up to date with `main`. Standard package PRs, generated publication PRs, and repository maintenance PRs validate package permissions, the signed manifest, and current administrator identity respectively. Maintenance PRs may not include packages or generated artifacts. `pr-validate.yml` runs only trusted scripts from `main`; PR contents are treated as data. Credential-free workflows notify trusted workflows about review events, and open PRs are revalidated every five minutes to cover dismissed reviews, revoked permissions, and disconnected identities.

After content and permission checks pass, a trusted workflow squash-merges a standard package PR at the reviewed head SHA. New packages require a connected GitHub identity. Owners and maintainers may submit updates directly; other contributions first need approval of the current head from the owner or a maintainer. Before merging, the workflow rechecks the head, base, review, and `policy_revision`. If the branch is behind `main`, the workflow synchronizes it and explicitly dispatches the full check suite for the new head; other changes stop the merge.

GitHub Actions must be allowed to create and approve PRs at both the organization and repository levels. Trusted validation and publication workflows need write access to contents, pull requests, statuses, and actions. After the bot merges a standard package PR, it explicitly dispatches `publish-index.yml`. After the bot creates a publication PR, it explicitly dispatches `validate-publication.yml`; after a successful merge, it explicitly dispatches `reconcile-market.yml` and the Site repository's `deploy.yml` rather than relying on bot-triggered push events. Cloudflare deployment credentials exist only in the private Site repository.

The `main` branch protection rules require the strict `market/content-and-permission` status, apply to administrators, require a linear history and resolved conversations, and prohibit force pushes and deletion.

The `Reconcile Market` workflow can run manually or daily to repair state drift when a merge succeeds but its callback fails. During initial backfill, it calls the GitHub API to resolve namespaces to numeric IDs. The workflow uses the built-in `GITHUB_TOKEN`; local runs may provide `GITHUB_API_TOKEN`, with `GITHUB_TOKEN` also supported, for a higher rate limit:

```bash
MARKET_API_BASE=https://account.notchany.com \
MARKET_INTERNAL_HMAC_SECRET='<shared secret>' \
GITHUB_API_TOKEN='<optional token>' \
npm run reconcile:market
```

## Download Counts

The download service source and Cloudflare configuration live in the private Site repository. The service still uses this repository's official index to locate packages under `published/` and verifies their SHA-256 hashes. KV stores only aggregate counts for each package and records no requester IP addresses, user agents, or device information.

## Repository Files

| Path | Description |
| --- | --- |
| `packages/` | Candidate source; the only area standard contribution PRs may modify |
| `published/` | Complete snapshot and state manifest for the latest successful publication |
| `publication/` | Signed publication manifests, generated after first publication |
| `index/v1/index.json` | Static index generated by CI; do not edit manually |
| `index/v2/index.json` | Static index with `history_path`, generated by CI; do not edit manually |
| `history/v1/` | Read-only version history and contributor snapshots for each package, generated by CI |
| `schema/manifest.schema.json` | JSON Schema for manifests, using draft-07 |
| `scripts/check-pr.mjs` | PR and local validation script; Node.js 18 or newer, no dependencies |
| `scripts/build-index.mjs` | Index generation script; Node.js 18 or newer, no dependencies |
| `scripts/authorize-pr.mjs` | Single-package scope and Market permission validation run from the trusted default branch |
| `scripts/notify-release.mjs` | Compatibility entry point that reconciles the published snapshot |
| `scripts/reconcile-market.mjs` | Registry-to-Market state reconciliation that preserves existing owners |
