# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install deps (Node 18+, npm 9+)
npm run dev        # vite dev server on http://localhost:3000
npm run build      # production build -> dist/
npm run serve      # preview the build
```

There is no test runner and no lint script. Two standalone test files run directly with Node:

```bash
node tests/branch-naming.test.mjs   # chat-title fork suffix logic
node tests/token-limits.test.mjs    # model token-limit field detection
```

## Workflow

- **Commit each feature point immediately** — finish one independent, deliverable change, stage and commit it right away, then move on. Don't batch multiple feature points into a single commit.

- **Update the changelog for major features** - the in-app changelog at `src/config/changelog.js` (`changelogData`, rendered by `src/components/ChangelogDialog.vue`) is the user-facing update list. When a change is a notable/user-facing feature or fix (not a pure refactor, chore, or internal fix-of-a-fix), add an entry under the current month's section at the top (newest month first; create a new `## YYYY年M月` section if the month changed). Group related sub-changes under bold category labels and match the existing Chinese style. Do this as part of the same feature commit rather than batching it later.

## Architecture

Vue 3 + Vite app structured as a **microkernel + plugin system**. The runtime chain is:

`main.js` → `AppCore.vue` → mode plugin (`src/modes/*`) → `callAiModel` (`src/core/services/aiService.js`) → protocol driver (`src/utils/providers/*`)

### AppCore and the method-split pattern

`src/AppCore.vue` is the microkernel host. It is an **Options API** component (`data()` + `methods`), and its `methods` are split by concern across `src/appCore/methods/`:

- `configMethods.js` — preset/model/key management, mode switching
- `chatMethods.js` — chat session CRUD, streaming, regenerate, fork, save scheduling
- `uiMethods.js` — sidebar, scroll, modal UI state
- `archiveMethods.js` — archive import/export, encrypted archives, repair

These are merged into one object via `...appCoreMethods` (`appCore/methods/index.js`). When adding AppCore behavior, put it in the matching method file — not in `AppCore.vue` itself. `created()` registers all modes/tools, runs preset migration, then loads chat history.

### Plugin system

`src/core/pluginSystem.js` exports two singletons: `pluginSystem` (modes) and `toolRegistry` (tools). Modes register themselves in `src/modes/index.js` (`registerAllModes()`); each mode's `plugin.js` exports `{ id, name, icon, component, config }`. To add a mode: create `src/modes/YourMode/`, add a `plugin.js`, import & `pluginSystem.register` it in `src/modes/index.js`. `AppCore` renders the active mode's component and passes `config` + `chat` as props; modes communicate back via `emit` (see the `<component :is="currentModeComponent">` event bindings in `AppCore.vue`).

### Preset is the single source of truth

`activePresetId` (in `src/core/store.js`) is the **only** source for API config. `provider`, `apiUrl`, `apiKey`, `isBackendProxy` are all **derived** from the active preset at runtime (`applyCurrentPreset`), never stored independently. The preset registry lives in `src/config/presets/` (`builtin.js` = built-in providers, `index.js` = query/CRUD/capability/URL-matching). Custom presets persist to localStorage under `bs2_custom_presets`. API keys are bucketed **per presetId** in `src/utils/keyManager.js` (`bs2_api_keys` prefix). There is a legacy migration path from old `provider`/`useBackendProxy` config (`resolvePresetIdFromOldConfig`).

### AI service layer and request-format routing

`callAiModel` (`src/core/services/aiService.js`) is the unified entry point. It:
1. Resolves the effective provider from the model name prefix (`gemini-`, `openai/`, `deepseek/`, `anthropic/`, …) or the API URL.
2. Resolves the **request format** via `src/utils/requestFormat.js`: `auto | chat_completions | anthropic_messages | responses`. `auto` picks `anthropic_messages` for Claude models, else `chat_completions`. This is a **second-level route on top of** `preset.protocol` (openai|gemini) — distinct from provider.
3. Routes to one of four drivers in `src/utils/providers/`: `openaiCompatible.js`, `gemini.js`, `anthropic.js`, `openaiResponses.js`.

Fallback behavior: `anthropic_messages` and `responses` fall back to `chat_completions` when the endpoint returns 404/405/5xx. **Prompt-cache availability is tied to the request format** — only the Anthropic Messages path supports manual `cache_control` breakpoints; `getPromptCacheAvailability` in `requestFormat.js` computes whether manual cache controls should show and why not. Backend proxy always forces `chat_completions` and disables manual cache.

### Data persistence

- **Chat history** is in IndexedDB (`bs2-chat-db`, v2): object store `kv` (active chats + current id) and `chatArchive` (cold archive, one record per archived chat). See `src/utils/chatStorage.js`. Vue reactive proxies are JSON round-tripped before IDB writes to avoid structured-clone failures (`toPlainObject`).
- **Config / keys / presets / selected models** are in localStorage with the `bs2_` prefix. `src/core/store.js` persists a whitelisted set of keys via `updateState`; `globalState` is readonly, `writableState` is the mutable escape hatch.
- Archives support optional encryption (`src/utils/secureArchive.js`).

### GameMode runtime

GameMode is the most complex mode: mechanism-pack-driven (`src/gamePacks/`, builtin + imported), with a tool system (`dice`/`table`/`encounter`/`stateCheck`/`patchState`), trigger system (turn conditions, cooldowns, max triggers), state snapshots/rollback, and a leveled run log. Runtime logic lives in `src/utils/gamePackRuntime.js` and `src/modes/GameMode/runtime/` (`responseParser.js` for parsing AI JSON tool calls, `responseFormat.js`). Detailed design is in `docs/GameMode/`.

## Conventions and gotchas

- **Path alias**: `@` → `./src` (configured in `vite.config.js`). Prefer `@/...` imports.
- **Build drops `console` and `debugger`** via `esbuild.drop` — `console.log` is dev-only and will not appear in production. Do not rely on console output for production behavior.
- **localStorage keys** all use the `bs2_` prefix; UI text and comments are in Chinese.
- **PWA**: enabled via `vite-plugin-pwa` (autoUpdate). Manifest/icons are generated from `public/`.
- **State persistence keys** added to `store.js` must be added to the `persistKeys` array in `updateState` to survive reloads.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml` (GitHub Actions): `npm install` → `npm run build` → deploy `dist/` to GitHub Pages at **`ai.tobenot.top`** (CNAME in `public/CNAME`). No manual deploy step. Vite `base` is `/`. Node 20 in CI. The workflow also prunes duplicate `github-pages` artifacts before deploying.

## Documentation

Deeper design docs (Chinese) live in `docs/`:
- `docs/架构说明.md`, `docs/插件开发示例.md`, `docs/新模式开发文档.md` — architecture & plugin development
- `docs/api/API架构梳理.md`, `docs/api/API格式与缓存切换方案.md`, `docs/api/Preset架构改造方案.md`, `docs/api/Responses-API支持.md` — AI call layer & preset system
- `docs/GameMode/` — GameMode design, mechanism-pack authoring, tools, triggers
- `HowToDev.md` — onboarding handover for developers (note: predates GameMode and the newer provider drivers)
