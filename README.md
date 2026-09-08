# NeuroLog

NeuroLog is a lightweight, offline-first floating desktop notepad and task-intention companion for Windows 10 and 11. It combines a persistent floating pill, task lists, task timers, stopwatch, Creative Time schedules, quick capture, notifications, and native multi-window desktop surfaces.

## Tech Stack

- Tauri v2 + Rust
- React 19 + TypeScript
- Vite + Tailwind CSS

## Development

```text
npm install
npm run tauri dev
```

Browser preview:

```text
npm run dev
```

## Production Build

```text
npm run tauri build
```

Windows installers and release binaries are generated under `src-tauri/target/release/bundle/`.

## Repository

Generated build output, dependencies, local environment files, and editor metadata are excluded through `.gitignore`. Release binaries can be attached separately to GitHub Releases.

## License

MIT — see `LICENSE`.
