#![forbid(unsafe_code)]

pub mod ai;
pub mod commands;
pub mod connector;
pub mod core;
pub mod portforward;
pub mod terminal;

use core::AppState;
#[cfg(target_os = "macos")]
use tauri::menu::PredefinedMenuItem;
use tauri::menu::{Menu, MenuItem, MenuItemKind};
use tauri::{Emitter, Manager};

pub fn get_log_file_path() -> std::path::PathBuf {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let path = std::path::PathBuf::from(home)
                .join("Library")
                .join("Logs")
                .join("k8sUI");
            let _ = std::fs::create_dir_all(&path);
            return path.join("k8sui.log");
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let path = std::path::PathBuf::from(appdata).join("k8sUI");
            let _ = std::fs::create_dir_all(&path);
            return path.join("k8sui.log");
        }
    }
    let fallback = std::env::temp_dir().join("k8sUI");
    let _ = std::fs::create_dir_all(&fallback);
    fallback.join("k8sui.log")
}

#[derive(Clone)]
struct DualWriter {
    file: std::sync::Arc<std::sync::Mutex<Option<std::fs::File>>>,
}

impl std::io::Write for DualWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let _ = std::io::stdout().write(buf);
        if let Ok(mut guard) = self.file.lock() {
            if let Some(ref mut f) = *guard {
                let _ = f.write_all(buf);
            }
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        let _ = std::io::stdout().flush();
        if let Ok(mut guard) = self.file.lock() {
            if let Some(ref mut f) = *guard {
                let _ = f.flush();
            }
        }
        Ok(())
    }
}

fn setup_menu(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();
    let menu = Menu::default(handle)?;
    let check_updates = MenuItem::with_id(
        handle,
        "check-updates",
        "Check for Updates...",
        true,
        None::<&str>,
    )?;
    let open_logs = MenuItem::with_id(
        handle,
        "open-logs",
        "Open App Log File (k8sui.log)",
        true,
        Some("CmdOrCtrl+Shift+L"),
    )?;
    let toggle_devtools = MenuItem::with_id(
        handle,
        "toggle-devtools",
        "Toggle Developer Tools",
        true,
        Some("CmdOrCtrl+Alt+I"),
    )?;
    let open_diagnostics = MenuItem::with_id(
        handle,
        "open-diagnostics",
        "Diagnostics & IPC Monitor...",
        true,
        Some("CmdOrCtrl+Shift+D"),
    )?;

    #[cfg(target_os = "macos")]
    {
        let items = menu.items()?;
        if let Some(MenuItemKind::Submenu(app_submenu)) = items.first() {
            // Insert Check for Updates, Diagnostics, Logs, and DevTools right after "About k8sUI" (index 1)
            let separator = PredefinedMenuItem::separator(handle)?;
            let separator2 = PredefinedMenuItem::separator(handle)?;
            app_submenu.insert(&check_updates, 1)?;
            app_submenu.insert(&separator, 2)?;
            app_submenu.insert(&open_diagnostics, 3)?;
            app_submenu.insert(&open_logs, 4)?;
            app_submenu.insert(&toggle_devtools, 5)?;
            app_submenu.insert(&separator2, 6)?;
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Windows / Linux, add under Help menu
        let items = menu.items()?;
        if let Some(MenuItemKind::Submenu(help_submenu)) = items.last() {
            help_submenu.prepend(&open_diagnostics)?;
            help_submenu.prepend(&toggle_devtools)?;
            help_submenu.prepend(&open_logs)?;
            help_submenu.prepend(&check_updates)?;
        }
    }

    app.set_menu(menu)?;
    Ok(())
}

pub fn run() {
    // Must run before any TLS connection is attempted.
    core::install_crypto_provider();

    let log_path = get_log_file_path();
    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();

    let writer = DualWriter {
        file: std::sync::Arc::new(std::sync::Mutex::new(file)),
    };

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,k8s_ui=debug,kube=info"));

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_ansi(false)
        .with_writer(move || writer.clone())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            setup_menu(app)?;
            app.manage(AppState::new());
            tracing::info!(
                "k8sUI initialized with persistent file logging at {}",
                get_log_file_path().display()
            );
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "check-updates" {
                let _ = app.emit("trigger-check-updates", ());
            } else if id == "open-logs" {
                let path = get_log_file_path();
                #[cfg(target_os = "macos")]
                {
                    let _ = std::process::Command::new("open").arg(&path).spawn();
                }
            } else if id == "toggle-devtools" {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_devtools_open() {
                        window.close_devtools();
                    } else {
                        window.open_devtools();
                    }
                }
            } else if id == "open-diagnostics" {
                let _ = app.emit("trigger-open-diagnostics", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_cluster_health,
            commands::reconnect_cluster,
            commands::get_available_clusters,
            commands::connect_cluster,
            commands::get_active_cluster,
            commands::get_read_only_status,
            commands::set_write_mode,
            commands::list_namespaces,
            commands::list_pods,
            commands::list_resources,
            commands::describe_resource,
            commands::get_resource_events,
            commands::get_resource_yaml,
            commands::dry_run_apply,
            commands::apply_manifest,
            commands::scale_resource,
            commands::get_audit_logs,
            commands::list_aws_sso_orgs,
            commands::register_aws_sso_org,
            commands::discover_aws_sso_clusters,
            commands::start_terminal,
            commands::close_terminal,
            commands::terminal_input,
            commands::terminal_resize,
            commands::start_port_forward,
            commands::stop_port_forward,
            commands::list_port_forwards,
            commands::ask_ai_copilot,
            commands::get_logs,
            commands::list_containers,
            commands::list_custom_resource_types,
            commands::restart_resource,
            commands::delete_resource,
            commands::get_cluster_overview,
            commands::get_secret_data,
            commands::update_secret_data,
            commands::aws_sso_login,
            commands::list_aws_sso_sessions,
            commands::open_terminal_sso_login,
            commands::get_sso_login_command,
            commands::get_helm_release_details,
            commands::install_helm_release,
            commands::upgrade_helm_release,
            commands::rollback_helm_release,
            commands::uninstall_helm_release,
            commands::list_helm_repositories,
            commands::add_helm_repository,
            commands::open_external_url,
            commands::save_file,
            commands::open_log_file,
            commands::open_logs_dir,
            commands::get_backend_logs,
            commands::toggle_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
