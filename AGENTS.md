# Quick Doodle project constitution

This file applies to the entire repository. It contains only durable architecture, ownership, code, naming, and verification rules. Each rule starts with an explicit scope so it remains understandable when read without its section heading.

## Maintaining this constitution

- **Repository:** Keep this file independent of the feature, migration, or release currently in progress.
- **Repository:** Do not add task plans, status notes, dependency-version matrices, release procedures, or temporary workarounds here.
- **Repository:** Put temporary implementation plans and working notes under `docs/`; remove them when their work is complete.
- **Repository:** Update this file when an intentional architecture change makes a durable rule or ownership boundary obsolete.

## System architecture

- **Application / Tauri 2:** Quick Doodle is a macOS-first desktop application with a React/TypeScript frontend and a Rust backend.
- **Frontend / React + TypeScript:** The drawing UI enters through `index.html` -> `src/main.tsx`; the independent settings UI enters through `settings.html` -> `src/pages/settings/main.tsx`. Preserve both Vite entry points.
- **Backend / Rust:** Keep `src-tauri/src/main.rs` as a thin executable entry point; application setup belongs in `src-tauri/src/lib.rs` and its modules.
- **Platform code / Rust:** Isolate macOS-specific behavior so shared Rust code continues to compile for every configured desktop target.

## Ownership and repository layout

- **Frontend / React + TypeScript:** Keep shared UI and canvas components in `src/components/`, self-contained features in `src/features/`, Zustand stores in `src/store/`, shared types in `src/types/`, shared constants in `src/config/`, and worker entry points in `src/workers/`.
- **Frontend / React + TypeScript:** Keep component- or feature-specific hooks, helpers, types, and styles beside their owner; promote them to a shared top-level area only when they have multiple real consumers.
- **Settings frontend / React + TypeScript:** Keep the independent settings page and its components, state, hooks, helpers, and services under `src/pages/settings/`.
- **Backend / Rust:** Keep Rust-side UI such as the tray in `src-tauri/src/components/` and settings, shortcuts, persistence, window operations, and native integrations in `src-tauri/src/helpers/`.
- **Backend / Rust:** Keep shared event, menu, and window-label constants in `src-tauri/src/ids.rs`, and managed runtime state in `src-tauri/src/state.rs`.
- **Tauri configuration:** Keep window and plugin permissions in `src-tauri/capabilities/`; grant only the permissions required by the affected window or integration.

## Frontend code and naming

- **Frontend / TypeScript:** Honor all strict compiler checks, including unused-symbol and fallthrough checks; do not bypass errors with broad `any`, `@ts-ignore`, or disabled checks.
- **Frontend / TypeScript:** Use the `@/` alias across top-level `src/` areas and relative imports within the same component, feature, store, or page subtree.
- **Frontend / TypeScript:** Preserve the edited file's established style; the prevailing `src/` style is two-space indentation, double quotes, and semicolons. Avoid repository-wide formatting changes.
- **Frontend / React:** Name components and component directories in PascalCase, hooks with `useX`, and Zustand stores with `useXStore`.
- **Frontend / React:** Clean up event listeners, timers, workers, and Tauri subscriptions when their owning component or service is disposed.
- **Frontend / React:** Guard browser and Tauri globals wherever code can execute outside the corresponding runtime.
- **Frontend / React:** Preserve semantic HTML, keyboard behavior, focus behavior, and accessibility attributes when changing interactive UI.
- **Frontend / module API:** Update an existing barrel file such as `src/components/index.ts`, `src/store/index.ts`, or a local `index.ts` only when the new export belongs to that module's public surface.

## Styling

- **Frontend / CSS:** Keep component styles in the neighboring `styles.css`; put shared theme values in `src/theme.css` and reuse existing `--app-*` custom properties.
- **Settings frontend / CSS:** Follow the existing BEM-like class naming in settings components.
- **Frontend / CSS:** Follow the surrounding component's modifier convention, including established modifiers such as `--hidden` and `--active`.
- **Frontend / CSS:** Preserve reduced-motion behavior when changing animations.
- **Canvas / CSS:** Treat transparency, layering, pointer-event behavior, and z-index relationships as functional behavior, not cosmetic implementation detail.

## Frontend state and canvas behavior

- **Frontend state / Zustand:** Subscribe React components through narrow selectors or exported selector hooks rather than the entire store; non-React orchestration may use `useXStore.getState()` following the established pattern.
- **Frontend state / TypeScript:** Keep a store's state and action interfaces in its neighboring `types.ts` when that store already follows this structure.
- **Canvas model / TypeScript:** Use `Stroke` and related shared types from `src/types/drawingTypes.ts`; treat strokes and stroke arrays as immutable snapshots.
- **Canvas history / Zustand:** Route every user-visible, undoable canvas edit through `useHistoryStore`; create replacement objects and arrays instead of mutating history entries.
- **Canvas interactions / TypeScript:** Keep transient transform or interaction state separate from committed history and commit it when the interaction finishes.
- **Canvas logic / TypeScript:** Keep geometry, drawing, hit-testing, snapping, and recognition calculations in helpers or feature modules rather than JSX components.
- **Web workers / TypeScript:** Keep messages serializable; worker owners must handle disposal, timeouts, and stale asynchronous results.

## Tauri IPC and shared contracts

- **IPC / Rust:** Declare commands with `#[tauri::command]` and register them in the `tauri::generate_handler!` list in `src-tauri/src/lib.rs`.
- **IPC / Rust + TypeScript:** Use `Result<T, String>` for Rust command handlers crossing the frontend boundary, and keep handler and caller contracts synchronized.
- **IPC / Rust + TypeScript:** Treat command names, argument keys, payload fields, event names, shortcut action IDs, window labels, and Serde rename rules as cross-language contracts; update every producer and consumer together.
- **IPC settings / Rust + TypeScript:** Keep `src-tauri/src/helpers/settings_types.rs` and `src/types/settings.ts` synchronized whenever a shared settings payload changes.
- **IPC identifiers / Rust:** Reuse constants from `src-tauri/src/ids.rs` instead of duplicating event, menu, or window-label string literals.
- **Tauri permissions:** Update the applicable file under `src-tauri/capabilities/` when a plugin API requires permission; do not broaden unrelated permissions.

## Settings and runtime state

- **Settings / Rust:** Rust owns persisted defaults, validation, storage, shortcut compilation, and application of settings to the running app.
- **Settings persistence / Rust:** Store settings through `tauri-plugin-store`; every persisted field needs an intentional default and migration path governed by `SETTINGS_SCHEMA_VERSION`.
- **Settings runtime / Rust:** Preserve rollback when applying shortcuts, autostart, tray state, or another fallible runtime setting fails.
- **Shortcuts / Rust + TypeScript:** Keep shortcut action IDs synchronized across Rust validation/runtime code, the tray, settings UI, and canvas keyboard handling.
- **Settings window / Tauri:** Hide the settings window instead of destroying it on close, and preserve restoration of the previously visible main window.
- **Runtime state / Rust:** Synchronize managed state through `src-tauri/src/state.rs`; do not introduce unguarded mutable global state.

## Rust and native code

- **Backend / Rust:** Use Rust edition 2021 and format with `cargo fmt`; `src-tauri/rustfmt.toml` intentionally enables hard tabs.
- **Backend / Rust:** Use snake_case for modules and functions, PascalCase for types, and SCREAMING_SNAKE_CASE for constants.
- **Backend / Rust:** Return or log recoverable runtime errors instead of panicking; reserve `expect` for startup boundaries and true invariants.
- **Backend / Rust:** Keep unit tests beside their implementation in `#[cfg(test)]` modules.
- **Window management / Rust:** Keep window lookup and show/hide/focus behavior in `src-tauri/src/helpers/window_service.rs`.
- **Tray / Rust:** Keep tray construction and updates in `src-tauri/src/components/tray.rs`.
- **Shortcuts / Rust:** Keep shortcut registration and compilation in `src-tauri/src/helpers/shortcuts.rs` and `src-tauri/src/helpers/shortcuts_runtime.rs`.
- **macOS / Rust:** Put macOS-only imports and implementations behind `#[cfg(target_os = "macos")]`; provide a non-macOS stub when shared code calls the function unconditionally.
- **macOS / Rust:** Preserve AppKit and native-window main-thread requirements; report supported, unsupported, or error results through command boundaries instead of crashing.
- **Windows build / Rust:** Preserve the release-only Windows subsystem attribute in `src-tauri/src/main.rs`.

## Configuration, assets, and generated files

- **Window configuration / Tauri + Rust + TypeScript:** Keep window labels synchronized among `src-tauri/tauri.conf.json`, capabilities, Rust lookup code, and frontend behavior.
- **Main window / Tauri:** Preserve the transparency, initial visibility, decorations, sizing restrictions, shadow, and taskbar behavior that implement the drawing overlay unless the task intentionally changes that design.
- **Settings window / Tauri:** Keep the settings window as a separate Tauri window backed by `settings.html`.
- **Assets / Tauri:** Keep bundled icon and resource paths synchronized with `src-tauri/tauri.conf.json`; do not replace icons or demo assets unless the task concerns those assets.
- **Dependencies / JavaScript:** Use npm and commit `package-lock.json`; do not introduce another JavaScript package manager.
- **Generated files / Repository:** Do not hand-edit `dist/`, `src-tauri/target/`, TypeScript build-info files, or generated lockfile contents; regenerate them with their owning tool.

## Verification policy

- **Documentation only:** Inspect the rendered Markdown where relevant and review the diff.
- **Frontend / TypeScript + React + CSS:** Run `npm run lint` and `npm run build`, then smoke-test the affected UI behavior.
- **Backend / Rust + Tauri:** From `src-tauri/`, run `cargo fmt --check`, `cargo check`, `cargo test`, and `cargo clippy`.
- **IPC / Rust + TypeScript:** Run both frontend and Rust verification whenever IPC or shared types change.
- **Canvas / Zustand:** Verify the affected drawing flow and undo/redo behavior after canvas or state changes.
- **Settings / Rust + TypeScript:** Verify load, validation, save, cancel/defaults, persistence after restart, and runtime application after settings or shortcut changes.
- **Windows, tray, or native macOS / Tauri + Rust:** Verify show/hide/focus behavior, tray interaction, settings-window behavior, and the affected native integration.
