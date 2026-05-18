# Tunel Manager Ligolo E2E Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Ligolo-ng integration and topology view work reliably against real proxy/agent/listener data.

**Architecture:** Keep the current React/Vite app structure, but remove render feedback loops from the topology canvas, make auth refresh use the persisted session API URL/token, and constrain interface creation to platform-safe defaults. Verification combines TypeScript/build/lint checks with a local Ligolo-like mock API and browser inspection.

**Tech Stack:** React 18, Vite, TypeScript, HeroUI, SWR, Ligolo-ng HTTP API.

---

### Task 1: Regression Harness

**Files:**

- Use existing app without production changes.
- Runtime-only mock API on `127.0.0.1:18080`.

- [x] Start a mock Ligolo API that returns one real-looking agent, 21 interfaces, and two listeners.
- [x] Start Vite on `127.0.0.1:5173`.
- [x] Navigate to `/topology` with a stored session and verify the current build shows the known React maximum update-depth error / session reload failure.

### Task 2: Topology Render Loop

**Files:**

- Modify: `src/pages/topology/index.tsx`

- [x] Replace inline ref callbacks with stable per-node ref callbacks.
- [x] Track the previously registered DOM element per node and avoid disconnect/measure cycles for the same element.
- [x] Keep ResizeObserver only for real size changes.
- [x] Re-test `/topology` with the mock API; expected: nodes and multiple tunnel lines render, no ErrorBoundary.

### Task 3: Auth/API Session Correctness

**Files:**

- Modify: `src/contexts/Auth.tsx`
- Modify: `src/hooks/useApi.ts`

- [x] Stop using `useApi()` inside `AuthProvider`, because the provider cannot consume its own context.
- [x] Add direct auth login/ping fetches using the persisted `session.apiUrl` and `session.authToken`.
- [x] Include `apiUrl` in `useApi` callback dependencies and handle non-JSON/no-content responses without swallowing Ligolo API errors.
- [x] Re-test refresh with a custom API URL.

### Task 4: Interface Naming and UI Warnings

**Files:**

- Modify: `src/pages/interfaces/modal.tsx`
- Modify: `src/pages/topology/index.tsx`
- Modify: `src/pages/agents/index.tsx`
- Modify: `src/pages/agents/agentRow.tsx`

- [x] Generate macOS-safe `utunN` interface names when `navigator.platform` is Darwin-like.
- [x] Keep non-macOS names compatible with the existing 15-char schema.
- [x] Use root-served public asset URLs instead of importing from `public`.
- [x] Fix Fragment/Table row keys and HeroUI dropdown `textValue` warnings in touched surfaces.

### Task 5: Full Verification

**Files:**

- No additional source files expected.

- [x] Run `npm run build`.
- [x] Run read-only ESLint.
- [x] Browser-test `/agents` and `/topology` with the mock API.
- [x] If feasible, install Ligolo v0.8.3 temporarily and retest real proxy/agent/listener flow.
- [x] Report exact remaining limitations.
