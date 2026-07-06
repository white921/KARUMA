# KARUMA Stability Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add observability and runtime controls so Railway/Discord instability can be diagnosed before splitting the bot into more services.

**Architecture:** Keep one Discord bot process for now. Add pure, tested state transitions in `BotHealthMonitor`, lazy/configurable MySQL pool setup in `DbService`, and environment-gated startup for schedule/checker work.

**Tech Stack:** Node.js 20, TypeScript, discord.js v14, mysql2, node:test.

---

### Task 1: Runtime Config Tests

**Files:**
- Modify: `test/runtimeOptimization.test.js`
- Modify: `src/util/runtimeConfig.ts`

- [ ] Add tests for runtime feature flags and positive integer env parsing.
- [ ] Run `npm run build && node --test test/runtimeOptimization.test.js` and confirm the new tests fail before implementation.
- [ ] Implement `isRuntimeFeatureEnabled`.
- [ ] Run the same command and confirm it passes.

### Task 2: Health State Tests

**Files:**
- Modify: `test/botHealthMonitor.test.js`
- Modify: `src/service/botHealthMonitor.ts`

- [ ] Add tests for ACK duration tracking and watchdog lag tracking.
- [ ] Run `npm run build && node --test test/botHealthMonitor.test.js` and confirm failure before implementation.
- [ ] Extend `BotHealthState` and state transition helpers.
- [ ] Run the same command and confirm it passes.

### Task 3: DB Pool Configuration

**Files:**
- Modify: `test/runtimeOptimization.test.js`
- Modify: `src/service/dbService.ts`

- [ ] Add tests for `resolveMysqlConnectionLimit` and `resolveMysqlSlowAcquireLogMs`.
- [ ] Run `npm run build && node --test test/runtimeOptimization.test.js` and confirm failure before implementation.
- [ ] Make the MySQL pool lazy, configurable, and able to log slow connection acquisition.
- [ ] Run the same command and confirm it passes.

### Task 4: Startup Gating

**Files:**
- Modify: `src/index.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Gate `handleSchedule` behind `ENABLE_SCHEDULES`.
- [ ] Gate `HotelVcService.startExpiredVcChecker` behind `ENABLE_EXPIRED_VC_CHECKER`.
- [ ] Document the new environment variables.
- [ ] Run `npm test` and confirm build plus tests pass.
