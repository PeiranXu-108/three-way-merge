# Three-Way Diff Workspace

This repo contains an open-source three-way diff editor package.

## Requirements

This repository uses **pnpm** for dependency management. Do not run `npm install` in subdirectories (it will fail due to the `workspace:*` protocol). Install and run from the **repository root** with pnpm.

## Structure

- `packages/core` — Publishable React three-column diff/merge component (`three-way-diff-editor`)
- `demo` — Vite demo app

## Development

```bash
# Run from the repo root (do not run npm i inside demo)
pnpm install
pnpm run dev
```

## Build

```bash
pnpm run build
```

