# KARUMA Bot Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Aether` の Bot を `KARUMA` に複製し、独立リポジトリとして起動準備と運用ドキュメントを整える

**Architecture:** 既存コードは構造を変えずに複製し、初回は名前・設定・配布情報だけを `KARUMA` 向けへ更新する。将来の VC / 通貨分離に向けた境界メモを追加し、次段階の分割作業を安全に始められる状態にする。

**Tech Stack:** Node.js 20, TypeScript, discord.js v14, MySQL, Railway

---

### Task 1: Repository Bootstrap

**Files:**
- Create: `docs/superpowers/specs/2026-07-01-karuma-bot-design.md`
- Create: `docs/superpowers/plans/2026-07-01-karuma-bot-migration.md`
- Modify: repository root contents under `/Users/shige/Documents/workspace/DiscordBot/KARUMA`

- [ ] **Step 1: Confirm the target repository is effectively empty**

Run: `find /Users/shige/Documents/workspace/DiscordBot/KARUMA -maxdepth 2 -mindepth 1 | sort`
Expected: only `.git` content or newly added docs are present

- [ ] **Step 2: Copy the application files from `Aether` without inherited runtime artifacts**

Run: `rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude '.claude' --exclude '.vscode' /Users/shige/Documents/workspace/DiscordBot/Aether/ /Users/shige/Documents/workspace/DiscordBot/KARUMA/`
Expected: source, package files, README, and Railway config exist in `KARUMA`

- [ ] **Step 3: Verify the copied file layout**

Run: `find /Users/shige/Documents/workspace/DiscordBot/KARUMA -maxdepth 2 -mindepth 1 | sort`
Expected: `src`, `package.json`, `package-lock.json`, `railway.toml`, and docs directories are present

### Task 2: Project Identity And Operator Docs

**Files:**
- Create: `/Users/shige/Documents/workspace/DiscordBot/KARUMA/.env.example`
- Modify: `/Users/shige/Documents/workspace/DiscordBot/KARUMA/package.json`
- Modify: `/Users/shige/Documents/workspace/DiscordBot/KARUMA/README.md`

- [ ] **Step 1: Rename the project metadata**

Update `package.json` so `"name"` becomes `"karuma"` while preserving scripts and dependencies.

- [ ] **Step 2: Add the runtime environment template**

Create `.env.example` with:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
MYSQL_PORT=
TECHNICIAN_IDS=
RAILWAY_PROJECT_TOKEN=
```

- [ ] **Step 3: Rewrite README for `KARUMA` operations**

Document setup, install, build, command registration, required env vars, Railway deployment, and the note that Discord IDs still need `KARUMA` values in `src/constant/id.ts`.

### Task 3: Installability And Sanity Verification

**Files:**
- Modify: `/Users/shige/Documents/workspace/DiscordBot/KARUMA/package-lock.json` only if npm updates it during install

- [ ] **Step 1: Install dependencies in the new repository**

Run: `npm ci`
Working directory: `/Users/shige/Documents/workspace/DiscordBot/KARUMA`
Expected: install completes without adding unexpected dependencies

- [ ] **Step 2: Build the TypeScript project**

Run: `npm run build`
Working directory: `/Users/shige/Documents/workspace/DiscordBot/KARUMA`
Expected: `dist` is generated successfully

- [ ] **Step 3: Inspect the build output needed by scripts**

Run: `find /Users/shige/Documents/workspace/DiscordBot/KARUMA/dist -maxdepth 2 -type f | sort | rg 'registerCommands|index'`
Expected: output paths match `package.json` scripts or reveal any mismatch that must be fixed

### Task 4: Git Baseline And Future Architecture Notes

**Files:**
- Create: `/Users/shige/Documents/workspace/DiscordBot/KARUMA/docs/architecture/future-separation.md`

- [ ] **Step 1: Write the VC / currency separation note**

Create a short architecture memo that groups current services into `vc-domain`, `currency-domain`, and `shared-domain`, and explains when an API becomes worthwhile.

- [ ] **Step 2: Capture repository status for the initial baseline**

Run: `git -C /Users/shige/Documents/workspace/DiscordBot/KARUMA status --short`
Expected: copied files and new docs appear as untracked or modified, ready for initial commit

- [ ] **Step 3: Create the initial commit**

Run:

```bash
git -C /Users/shige/Documents/workspace/DiscordBot/KARUMA add .
git -C /Users/shige/Documents/workspace/DiscordBot/KARUMA commit -m "feat: bootstrap karuma bot from aether"
```

Expected: a single initial commit is created in the `KARUMA` repository
