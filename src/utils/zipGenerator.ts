import JSZip from 'jszip';

export async function generateProjectZip(): Promise<Blob> {
  const zip = new JSZip();

  // Root configuration files
  zip.file('package.json', JSON.stringify({
    name: 'neurolog',
    private: true,
    version: '1.2.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      preview: 'vite preview',
      tauri: 'tauri'
    },
    dependencies: {
      '@tauri-apps/api': '^2.2.0',
      '@tauri-apps/plugin-global-shortcut': '^2.2.0',
      '@tauri-apps/plugin-notification': '^2.2.1',
      '@tauri-apps/plugin-shell': '^2.2.0',
      'jszip': '^3.10.1',
      'lucide-react': '^0.546.0',
      'motion': '^12.23.24',
      'react': '^19.0.1',
      'react-dom': '^19.0.1'
    },
    devDependencies: {
      '@tailwindcss/vite': '^4.1.14',
      '@tauri-apps/cli': '^2.2.7',
      '@types/node': '^22.14.0',
      '@types/react': '^19.0.1',
      '@types/react-dom': '^19.0.1',
      '@vitejs/plugin-react': '^5.0.4',
      'tailwindcss': '^4.1.14',
      'typescript': '~5.8.2',
      'vite': '^6.2.3'
    }
  }, null, 2));

  zip.file('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      useDefineForClassFields: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      paths: {
        '@/*': ['./src/*']
      }
    },
    include: ['src']
  }, null, 2));

  zip.file('vite.config.ts', `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    clearScreen: false,
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
`);

  zip.file('index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NeuroLog</title>
    <meta name="description" content="A lightweight floating desktop notepad and task-intention companion for Windows." />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-transparent text-slate-100 antialiased overflow-hidden select-none">
    <div id="root" class="w-full h-full bg-transparent"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

  zip.file('.gitignore', `node_modules
dist
dist-ssr
*.local
src-tauri/target
.DS_Store
`);

  zip.file('README.md', `# NeuroLog — Lightweight Floating Desktop Notepad & Task-Intention Companion

NeuroLog is a lightweight, offline-first floating desktop notepad and task-intention companion for Windows 10 & 11, built with Tauri v2, Rust, React, and TypeScript.

## Quick Start
1. \`npm install\`
2. \`npm run tauri dev\` (or \`npm run dev\` for browser preview)
3. Production build: \`npm run tauri build\`
`);

  // Tauri Rust files
  const tauriFolder = zip.folder('src-tauri');
  if (tauriFolder) {
    tauriFolder.file('Cargo.toml', `[package]
name = "neurolog"
version = "1.2.0"
description = "Lightweight floating desktop notepad and task-intention companion for Windows"
authors = ["Tanvir Mahtab"]
edition = "2021"

[lib]
name = "neurolog_lib"
crate-type = ["rlib"]

[profile.dev]
debug = 1
incremental = false

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-notification = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-shell = "2"
tauri-plugin-single-instance = "2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`);

    tauriFolder.file('build.rs', `fn main() {
    tauri_build::build()
}
`);

    tauriFolder.file('tauri.conf.json', JSON.stringify({
      "$schema": "https://schema.tauri.app/config/2",
      "productName": "NeuroLog",
      "version": "1.2.0",
      "identifier": "com.neurolog.desktop",
      "build": {
        "beforeDevCommand": "npm run dev",
        "devUrl": "http://localhost:3000",
        "beforeBuildCommand": "npm run build",
        "frontendDist": "../dist"
      },
      "app": {
        "withGlobalTauri": true,
        "windows": [
          {"label":"main","title":"NeuroLog","width":180,"height":46,"minWidth":120,"minHeight":40,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"focus":false,"center":false,"shadow":false},
          {"label":"expanded","title":"NeuroLog","width":420,"height":560,"minWidth":340,"minHeight":400,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"visible":false,"center":false,"shadow":false},
          {"label":"quick-add","title":"NeuroLog Quick Add","width":380,"height":460,"minWidth":320,"minHeight":360,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"visible":false,"center":false,"shadow":false},
          {"label":"settings","title":"NeuroLog Settings","width":500,"height":580,"minWidth":420,"minHeight":420,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"visible":false,"center":false,"shadow":false},
          {"label":"stopwatch","title":"NeuroLog Stopwatch","width":360,"height":460,"minWidth":300,"minHeight":360,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"visible":false,"center":false,"shadow":false},
          {"label":"about","title":"About NeuroLog","width":440,"height":560,"minWidth":360,"minHeight":400,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"visible":false,"center":false,"shadow":false},
          {"label":"support","title":"NeuroLog Support","width":380,"height":360,"minWidth":320,"minHeight":280,"resizable":false,"fullscreen":false,"transparent":true,"decorations":false,"alwaysOnTop":true,"skipTaskbar":true,"visible":false,"center":false,"shadow":false}
        ],
        "security": {"csp": null},
        "trayIcon": {"iconPath":"icons/icon.png","iconAsTemplate":true,"tooltip":"NeuroLog - Floating Task Intention Companion"}
      },
      "bundle": {"active":true,"targets":"all","icon":["icons/32x32.png","icons/128x128.png","icons/128x128@2x.png","icons/icon.icns","icons/icon.ico","icons/icon.png"]},
      "plugins": {}
    }, null, 2));

    const tauriCapabilities = tauriFolder.folder('capabilities');
    if (tauriCapabilities) {
      tauriCapabilities.file('default.json', JSON.stringify({
        "$schema": "../gen/schemas/desktop-schema.json",
        "identifier": "default",
        "description": "Default permissions for NeuroLog",
        "windows": ["main","expanded","quick-add","settings","stopwatch","about","support"],
        "permissions": [
          "core:default",
          "core:window:allow-set-always-on-top",
          "core:window:allow-set-ignore-cursor-events",
          "core:window:allow-show",
          "core:window:allow-hide",
          "core:window:allow-set-focus",
          "core:window:allow-set-position",
          "core:window:allow-set-size",
          "core:window:allow-set-resizable",
          "core:window:allow-start-dragging",
          "global-shortcut:allow-register",
          "global-shortcut:allow-unregister",
          "global-shortcut:allow-is-registered",
          "notification:default",
          "shell:default"
        ]
      }, null, 2));
    }

    const tauriSrc = tauriFolder.folder('src');
    if (tauriSrc) {
      tauriSrc.file('main.rs', `// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    neurolog_lib::run();
}
`);

      tauriSrc.file('lib.rs', `use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[tauri::command]
fn set_click_through(window: tauri::WebviewWindow, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_always_on_top(window: tauri::WebviewWindow, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

fn show_and_focus(app: &tauri::AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_and_focus(app, "main")))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![set_click_through, set_always_on_top, show_window, hide_window])
        .setup(|app| {
            for label in ["main", "expanded", "quick-add", "settings", "stopwatch", "about", "support"] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window.set_always_on_top(true);
                    let _ = window.set_skip_taskbar(true);
                    let _ = window.set_resizable(false);
                    if label != "main" { let _ = window.hide(); }
                }
            }

            let open_item = MenuItem::with_id(app, "open", "Open NeuroLog", true, None::<&str>)?;
            let quick_add_item = MenuItem::with_id(app, "quick_add", "Quick Add (Ctrl+Alt+N)", true, None::<&str>)?;
            let pause_item = MenuItem::with_id(app, "pause_timers", "Pause Timers", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let about_item = MenuItem::with_id(app, "about", "About NeuroLog", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit NeuroLog", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&open_item, &quick_add_item, &pause_item, &settings_item, &about_item, &quit_item])?;
            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_and_focus(app, "main"),
                    "quick_add" => show_and_focus(app, "quick-add"),
                    "settings" => show_and_focus(app, "settings"),
                    "about" => show_and_focus(app, "about"),
                    "pause_timers" => { if let Some(window) = app.get_webview_window("main") { let _ = window.emit("toggle-pause-timer", ()); } },
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|app, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event { show_and_focus(app, "main"); }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running neurolog desktop application");
}
`);
    }
  }

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
