#![forbid(unsafe_code)]

pub mod ai;
pub mod commands;
pub mod connector;
pub mod core;
pub mod portforward;
pub mod terminal;

use core::AppState;
use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem};
use tauri::{Emitter, Manager};

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

    #[cfg(target_os = "macos")]
    {
        let items = menu.items()?;
        if let Some(MenuItemKind::Submenu(app_submenu)) = items.first() {
            // Insert Check for Updates right after "About k8s-ui" (index 1)
            let separator = PredefinedMenuItem::separator(handle)?;
            app_submenu.insert(&check_updates, 1)?;
            app_submenu.insert(&separator, 2)?;
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Windows / Linux, add Check for Updates under Help menu
        let items = menu.items()?;
        if let Some(MenuItemKind::Submenu(help_submenu)) = items.last() {
            help_submenu.prepend(&check_updates)?;
        }
    }

    app.set_menu(menu)?;
    Ok(())
}

pub fn run() {
    // Must run before any TLS connection is attempted.
    core::install_crypto_provider();

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            setup_menu(app)?;
            app.manage(AppState::new());
            tracing::info!("k8sUI initialized with zero-trust credential architecture");
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "check-updates" {
                let _ = app.emit("trigger-check-updates", ());
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
