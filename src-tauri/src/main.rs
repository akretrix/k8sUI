// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    k8s_ui::core::install_crypto_provider();
    k8s_ui::run();
}
