#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Mutex, OnceLock};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
fn sync_global_shortcuts(
    app: tauri::AppHandle,
    quick_add_shortcut: String,
    click_through_shortcut: String,
) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    global_shortcut
        .unregister_all()
        .map_err(|e| format!("Failed to clear previous global shortcuts: {e}"))?;

    let mut requested = Vec::new();
    let mut actions: HashMap<u32, String> = HashMap::new();

    for (shortcut_text, action) in [
        (quick_add_shortcut.trim(), "quick_add"),
        (click_through_shortcut.trim(), "click_through"),
    ] {
        if shortcut_text.is_empty() {
            continue;
        }

        let shortcut = tauri_plugin_global_shortcut::Shortcut::from_str(shortcut_text)
            .map_err(|e| format!("Invalid global shortcut '{shortcut_text}': {e}"))?;
        let id = shortcut.id();
        if actions.insert(id, action.to_string()).is_some() {
            continue;
        }
        requested.push(shortcut);
    }

    if requested.is_empty() {
        return Ok(());
    }

    global_shortcut
        .on_shortcuts(requested, move |app, shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            if let Some(action) = actions.get(&shortcut.id()) {
                let _ = app.emit("neurolog-global-shortcut", action.clone());
            }
        })
        .map_err(|e| format!("Failed to register global shortcuts: {e}"))
}


#[tauri::command]
fn export_backup(data: String, default_filename: String) -> Result<(), String> {
    let path = rfd::FileDialog::new()
        .set_title("Export NeuroLog Backup")
        .set_file_name(&default_filename)
        .add_filter("NeuroLog Backup", &["json"])
        .save_file();

    let Some(path) = path else {
        return Ok(());
    };

    std::fs::write(&path, data).map_err(|e| format!("Failed to write backup file: {e}"))
}

#[tauri::command]
fn import_backup() -> Result<Option<String>, String> {
    let path = rfd::FileDialog::new()
        .set_title("Import NeuroLog Backup")
        .add_filter("NeuroLog Backup", &["json"])
        .pick_file();

    let Some(path) = path else {
        return Ok(None);
    };

    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Failed to read backup file: {e}"))
}

#[tauri::command]
fn set_launch_on_startup(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::env;
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;

        const RUN_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
        const VALUE_NAME: &str = "NeuroLog";

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (run_key, _) = hkcu
            .create_subkey(RUN_PATH)
            .map_err(|e| format!("Failed to open Windows startup registry key: {e}"))?;

        if enabled {
            let exe = env::current_exe()
                .map_err(|e| format!("Failed to locate NeuroLog executable: {e}"))?;
            let command = format!("\"{}\"", exe.to_string_lossy().replace('\"', "\\\""));
            run_key
                .set_value(VALUE_NAME, &command)
                .map_err(|e| format!("Failed to enable NeuroLog startup: {e}"))?;
        } else {
            match run_key.delete_value(VALUE_NAME) {
                Ok(()) => {}
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                Err(err) => return Err(format!("Failed to disable NeuroLog startup: {err}")),
            }
        }

        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Ok(())
    }
}

#[tauri::command]
fn set_click_through(window: tauri::WebviewWindow, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_always_on_top(window: tauri::WebviewWindow, always_on_top: bool) -> Result<(), String> {
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

const NEUROLOG_WINDOW_LABELS: [&str; 9] = [
    "main",
    "expanded",
    "quick-add",
    "settings",
    "stopwatch",
    "about",
    "support",
    "timer-complete",
    "click-through-control",
];

static SURFACE_INTENTS: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();

fn surface_intents() -> &'static Mutex<HashMap<String, bool>> {
    SURFACE_INTENTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_surface_requested(label: &str) -> bool {
    surface_intents()
        .lock()
        .ok()
        .and_then(|map| map.get(label).copied())
        .unwrap_or(label == "main")
}

#[tauri::command]
fn set_surface_intent(label: String, open: bool) -> Result<(), String> {
    if !NEUROLOG_WINDOW_LABELS.contains(&label.as_str()) {
        return Err(format!("Unknown NeuroLog window: {label}"));
    }
    let mut map = surface_intents().lock().map_err(|_| "Surface intent lock poisoned".to_string())?;
    map.insert(label, open);
    Ok(())
}

fn promote_existing_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        // Keep every NeuroLog window in the TOPMOST group, but explicitly move
        // only the requested surface to the top of that group. This is a
        // Z-order promotion, not a permanent per-panel hierarchy.
        use windows_sys::Win32::Foundation::HWND;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SetForegroundWindow, SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE,
        };

        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as HWND;
        let ok = unsafe { SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE) };
        if ok == 0 {
            return Err("SetWindowPos failed while promoting NeuroLog surface".to_string());
        }
        unsafe { SetForegroundWindow(hwnd); }
    }

    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_surface_if_requested(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if !is_surface_requested(&label) {
        return Ok(());
    }
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    promote_existing_window(&window)
}

#[tauri::command]
fn hide_surface(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if !NEUROLOG_WINDOW_LABELS.contains(&label.as_str()) {
        return Err(format!("Unknown NeuroLog window: {label}"));
    }
    if let Ok(mut map) = surface_intents().lock() {
        map.insert(label.clone(), false);
    }
    if let Some(window) = app.get_webview_window(&label) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_all_windows(app: tauri::AppHandle) -> Result<(), String> {
    if let Ok(mut map) = surface_intents().lock() {
        for label in NEUROLOG_WINDOW_LABELS {
            map.insert(label.to_string(), label == "main");
        }
    }
    for label in NEUROLOG_WINDOW_LABELS {
        if label != "main" {
            if let Some(window) = app.get_webview_window(label) {
                window.hide().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn set_window_glass(window: tauri::WebviewWindow, blur: u32, dark: bool, opacity: f64) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::window::{Color, Effect, EffectsBuilder};
        if blur == 0 {
            return window.set_effects(None).map_err(|e| e.to_string());
        }
        let factor = (blur.min(30) as f64) / 30.0;
        let alpha = ((1.0 - factor) * 135.0 + opacity.clamp(0.0, 1.0) * 70.0).round() as u8;
        let color = if dark { Color(18, 18, 22, alpha) } else { Color(248, 250, 252, alpha) };
        let effect = Effect::Acrylic;
        let config = EffectsBuilder::new().effect(effect).color(color).build();
        return window.set_effects(config).map_err(|e| e.to_string());
    }
    #[cfg(not(windows))]
    {
        let _ = (window, blur, dark, opacity);
        Ok(())
    }
}

fn show_and_focus(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_and_focus(app);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            set_launch_on_startup,
            show_window,
            hide_window,
            set_surface_intent,
            show_surface_if_requested,
            hide_surface,
            hide_all_windows,
            set_window_glass,
            sync_global_shortcuts,
            export_backup,
            import_backup
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
                let _ = window.set_skip_taskbar(true);
                let _ = window.set_resizable(false);
            }

            let open_item = MenuItem::with_id(app, "open", "Open NeuroLog", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let click_through_item = MenuItem::with_id(app, "click_through", "Toggle click-through mode", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit NeuroLog", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&open_item, &settings_item, &click_through_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => { let _ = app.emit("neurolog-tray-action", "open"); }
                    "settings" => { let _ = app.emit("neurolog-tray-action", "settings"); }
                    "click_through" => { let _ = app.emit("neurolog-tray-action", "click_through"); }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = tray.app_handle().emit("neurolog-tray-action", "open");
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running neurolog desktop application");
}
