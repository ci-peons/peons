# Peon registry: design

| | |
|---|---|
| Status | Approved in brainstorm, awaiting implementation plan |
| Date | 2026-09-19 |
| Supersedes | RFC-0001 section 6.6 and the "storing peons in our registry rather than in git" entry in section 13 |
| Companion spec | `2026-09-19-peon-core-design.md` |
| Depends on | `@peons/schema` from the core spec |

## 1. Purpose

A hosted package registry for peons with npm semantics: unique names, scoped ownership, immutable versions, content-hash integrity, `peons add <name>`, `peons publish`, search, and a website for browsing. This replaces the RFC's git-native registry by founder decision.

## 2. Decisions made in this brainstorm

| Decision | Choice |
|---|---|
| Namespace | npm-style. `@username/name` is owned by the user. Unscoped names are reserved for the official `ci-peons` account at launch. |
| Backend | Supabase: Postgres with RLS, Storage for tarballs, Auth with GitHub OAuth, two Edge Functions. |
| Publisher auth | GitHub OAuth through the website with a localhost callback to the CLI. `PEONS_TOKEN` for headless use. |
| Website | Yes, npm-like: search, package pages, publisher pages. Next.js on Vercel. |
| Reads | Directly through PostgREST with the anon key, shared by CLI and website. |
| Writes | Only through the `publish` and `cli-token` Edge Functions using the service role. |

## 3. Data model

Postgres schema `public`, all tables with RLS enabled.

### 3.1 profiles

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | equals `auth.users.id` |
| username | citext, unique | GitHub login at first sign-in, lowercase |
| display_name | text | |
| avatar_url | text | |
| created_at | timestamptz | |

Created by a trigger on `auth.users` insert. Username collisions with an existing profile (a renamed GitHub account) get a numeric suffix and a notice on the profile page.

### 3.2 packages

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | citext, unique | full name including scope |
| scope | citext, nullable | username without `@`, null for unscoped |
| owner_id | uuid, fk profiles | |
| latest_version | text | denormalised, set by publish |
| downloads | bigint | incremented by RPC |
| created_at | timestamptz | |

### 3.3 package_versions

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| package_id | uuid, fk | |
| version | text | strict semver; unique with package_id |
| manifest | jsonb | parsed frontmatter, validated by `@peons/schema` |
| readme | text | the markdown body |
| checks | jsonb | `[{ id, title }]` extracted from the body |
| permissions | jsonb | copy of `manifest.permissions` for display and lockfile |
| tarball_path | text | `tarballs/<sha256>.tgz` |
| integrity | text | `sha256-<base64>` |
| size_bytes | integer | |
| fixture_counts | jsonb | `{ shouldFlag, shouldPass }` |
| published_by | uuid, fk profiles | |
| published_at | timestamptz | |
| deprecated | text, nullable | the only mutable column |

A `BEFORE UPDATE` trigger raises unless the only changed column is `deprecated`. A `BEFORE DELETE` trigger raises unconditionally. Immutability is enforced in the database.

### 3.4 cli_tokens

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| user_id | uuid, fk profiles | |
| token_hash | text, unique | sha256 of the plaintext |
| name | text | e.g. hostname at login |
| created_at | timestamptz | |
| last_used_at | timestamptz | |
| revoked_at | timestamptz, nullable | |

Plaintext tokens are `peons_` plus 40 random base62 characters, shown once.

### 3.5 Storage

Bucket `tarballs`, public read, no listing. Object key is the sha256 hex of the tarball, so a URL is proof of content and can be cached indefinitely. Uploads only through the publish function.

### 3.6 RLS

- `profiles`, `packages`, `package_versions`: `SELECT` for `anon` and `authenticated`. No `INSERT`, `UPDATE` or `DELETE` policies; only the service role writes.
- `cli_tokens`: `SELECT` own rows for `authenticated` (so the website can list and revoke tokens). Writes only via service role.

## 4. API

### 4.1 Reads (PostgREST)

The CLI and website use the anon key. Views expose only what clients need:

- `package_summaries`: name, scope, description (from latest manifest), latest_version, downloads, owner username, updated_at.
- `package_detail(name)`: RPC returning the package, owner, and all versions with manifest, checks, permissions, integrity, deprecated, published_at.
- `search_packages(q, limit)`: RPC using `pg_trgm` similarity over name, description and check titles, ordered by similarity then downloads.
- `record_download(name, version)`: RPC, security definer, increments `packages.downloads`. Called by the CLI after a verified install, fire and forget.

### 4.2 publish (Edge Function)

`PUT /v1/packages/{name}/{version}`, `Authorization: Bearer peons_...`, body is multipart: `tarball` binary and `integrity` claimed sha256. The server parses `peon.md` from the tarball itself; the client never sends a separate manifest, so there is nothing to keep consistent.

Steps, in order, any failure returns a 4xx with a machine-readable `code`:

1. Hash the bearer token, look up an unrevoked `cli_tokens` row, load the profile. Update `last_used_at`.
2. Validate `name`: npm rules. If scoped, scope must equal the caller's username. If unscoped, the caller must be the configured admin account (`ci-peons`).
3. Tarball size at most 2 MB. Compute sha256 of the tarball bytes; must equal the claimed `integrity`.
4. Decompress, list entries: every path must be `peon.md` or under `fixtures/should-flag/` or `fixtures/should-pass/`. No symlinks, no other files.
5. Parse `peon.md` with `@peons/schema` to get the manifest, readme and checks. `manifest.name` must equal the URL name and `manifest.version` the URL version. Count fixtures for `fixture_counts`.
6. Refuse with 409 if the version exists.
7. Upload the tarball to `tarballs/<sha256>.tgz` (idempotent if present).
8. In one transaction: upsert `packages` (create on first publish with `owner_id` = caller), insert `package_versions`, set `latest_version` to the highest non-prerelease version.
9. Return `{ name, version, integrity, url }`.

### 4.3 cli-token (Edge Function)

`POST /v1/cli-token`, authenticated with the Supabase session from the website. Body `{ name }`. Mints a token, stores the hash, returns the plaintext once.

`DELETE /v1/cli-token/{id}` sets `revoked_at`. Used by `peons logout` (with the bearer token identifying itself) and by the website token page.

### 4.4 deprecate

`POST /v1/packages/{name}/{version}/deprecate`, bearer token, body `{ message }`. Owner only. Lives in the publish function under a different route to keep one deploy unit.

## 5. Authentication flow

`peons login`:

1. CLI generates `state`, starts an HTTP listener on `127.0.0.1` on a random port, and opens `https://<site>/cli/login?port=<n>&state=<state>` in the browser. Prints the URL for copy-paste.
2. The page signs the user in with Supabase GitHub OAuth if needed. On first login the profile trigger creates the username.
3. The page calls `cli-token` with `name = "cli on <hostname>"` supplied by the CLI as a query param, receives the plaintext, and redirects to `http://127.0.0.1:<n>/callback?token=...&state=...`.
4. CLI verifies `state`, writes `~/.config/peons/config.json` (mode 600) with `{ registry, token, username }`, responds with a small "you can close this tab" page, and prints "Logged in as @username".
5. Timeout after five minutes with a message suggesting `PEONS_TOKEN`.

Token precedence: `PEONS_TOKEN` env, then config file. `peons whoami` calls `GET /v1/whoami` on the publish function, which resolves the bearer token to a username; PostgREST cannot authenticate CLI tokens, so every token-authenticated call goes through the Edge Functions.

## 6. CLI commands

All in the `peons` binary, using `@peons/registry-client` for reads and downloads and the publish function for writes. TTY mode uses `@clack/prompts`; plain mode prints lines.

| Command | Behaviour |
|---|---|
| `peons add <name>[@version] [--no-save]` | Resolve version (latest when omitted, exact otherwise; ranges are not supported in v1). Fetch the version row, download the tarball, verify sha256 against `integrity`, extract to `.peons/installed/<name>/<version>/`, write or update `peons.lock`, append `use:` to `peons.yaml` unless `--no-save`, print the permissions notice, call `record_download`. If the version is deprecated, print the message and require `--force`. |
| `peons remove <name>` | Remove from `peons.yaml`, `peons.lock` and `.peons/installed/`. |
| `peons update [name]` | Resolve latest for one or all installed packages. For each with a newer version: show the permissions diff; if any glob was added or widened, ask to confirm in TTY mode and require `--yes` in plain mode. Then perform the add steps. |
| `peons search <query>` | Table of name, description, version, downloads. `--json` for machines. |
| `peons info <name>[@version]` | Description, versions with dates, checks, permissions, publisher, install command, deprecation notices. |
| `peons publish [dir] [--skip-test] [--allow-no-fixtures] [--dry-run]` | Load and validate the peon. Run `peons test` unless skipped. Build a deterministic tarball: entries sorted by path, mtime zeroed, uid and gid zeroed, mode normalised, gzip with fixed header. Compute sha256. Call publish. Print the package URL. `--dry-run` stops after printing the tarball listing and hash. |
| `peons deprecate <name>@<version> <message>` | Calls the deprecate route. |
| `peons login` / `logout` / `whoami` | Section 5. |

### 6.1 peons.lock

```yaml
lockfile: 1
registry: https://registry.peons.dev
packages:
  a11y:
    version: 1.0.0
    integrity: sha256-...
    permissions:
      read: ["**/*.{tsx,jsx,html,css}", "docs/a11y/**"]
```

The core loader (companion spec, 4.4) checks the installed directory's content hash against `integrity` and the on-disk manifest's `permissions` against the lock entry. Either mismatch is exit 2.

Content hash of an installed directory: sha256 over the deterministic tarball rebuilt from the directory, which is the same procedure `publish` uses, so local and remote hashes agree by construction.

## 7. Website

Next.js App Router on Vercel. Server components read Supabase with the anon key through the same views as the CLI. Client components only for search-as-you-type and the copy button.

Routes:

| Route | Content |
|---|---|
| `/` | Search box, recently published, most installed, a short "what is a peon" panel with the install snippet. |
| `/package/[...name]` | Header with name, version, install command with copy, publisher. Tabs or sections: README rendered from the body (sanitised markdown, no raw HTML), Checks list with ids and titles, Permissions panel highlighted, Versions with dates and deprecation notices, Fixtures counts. `?v=<version>` selects a version. |
| `/~[username]` | Avatar, display name, list of packages. |
| `/search?q=` | Results list. |
| `/cli/login` | The handoff page from Section 5. Requires sign-in; shows the token name and a confirm button before minting. |
| `/settings/tokens` | List and revoke the signed-in user's CLI tokens. |

Design: the deck brief palette (paper `#FFFFFF`, panel `#F1F3F5`, ink `#10202F`, muted `#5B6B7A`, amber `#D9981F` accent with `#7A5200` for amber text, teal `#2A8F86` second data colour), IBM Plex Sans, no gradients. Structure close to npmjs.com, quieter. Dark mode via `prefers-color-scheme` with the same tokens inverted.

## 8. Name policy

- Lowercase, URL-safe, at most 214 characters, matching npm's validation.
- Scoped: `@username/name`. Scope must equal the publisher's username. Organisation scopes are not in v1.
- Unscoped: publishable only by the `ci-peons` admin account, configured by a single environment variable holding the admin profile id. Attempts by others return `403 UNSCOPED_RESERVED` with a message suggesting the scoped name.
- Names are never released or transferred in v1.

## 9. Testing strategy

- Database: `pgTAP` tests for the immutability triggers, RLS (anon can read, cannot write), the profile trigger, `search_packages`, and `record_download`.
- Edge functions: unit tests with a mocked Supabase client for each failure branch of publish (bad token, wrong scope, invalid manifest, bad tarball entry, hash mismatch, duplicate version) and the success path. One integration test against a local Supabase stack that publishes, reads back, downloads and verifies the hash.
- CLI: `add` and `publish` against a mocked registry client; a round-trip test that publishes a fixture peon to the local stack, adds it into a temp repo, and asserts the lockfile and installed hash match.
- Website: Playwright smoke for the package page and the login handoff against the local stack.
- Deterministic tarball: the same directory packed twice on different days yields the same bytes.

## 10. Operations

- Environments: local (Supabase CLI), staging, production. Migrations in `apps/registry/supabase/migrations`, applied by CI on merge to main.
- Rate limits: publish is limited per token to 30 per hour by a counter table checked inside the function. Reads rely on Supabase's built-in limits at launch.
- Backups: Supabase daily backups. Tarballs are content-addressed, so a restore only has to restore rows.
- Secrets: service role key and admin profile id as Edge Function secrets; never in the CLI or website.
- Metrics to watch at launch: publishes per day, installs per day, publish failure codes, p95 of `search_packages`.

## 11. Out of scope

Organisation scopes, name transfers and disputes, fixture evaluation on the registry's own infrastructure and the verified badge, private registries, download statistics beyond a counter, webhooks, a public write API beyond the CLI, and a mirror or CDN in front of Storage.
