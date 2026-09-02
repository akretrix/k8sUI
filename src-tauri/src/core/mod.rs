pub mod audit;
pub mod credentials;
pub mod redact;
pub mod resource_manager;
pub mod session;

use crate::connector::aws_sso::AwsSsoManager;
use std::sync::Arc;

pub struct AppState {
    pub session: Arc<session::SessionManager>,
    pub audit: Arc<audit::AuditLogger>,
    pub credentials: Arc<credentials::CredentialVault>,
    pub aws_sso: Arc<AwsSsoManager>,
    pub terminal: Arc<crate::terminal::TerminalManager>,
    pub port_forward: Arc<crate::portforward::PortForwardManager>,
    pub ai: Arc<crate::ai::AiCopilotService>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            session: Arc::new(session::SessionManager::new()),
            audit: Arc::new(audit::AuditLogger::new()),
            credentials: Arc::new(credentials::CredentialVault::new()),
            aws_sso: Arc::new(AwsSsoManager::new()),
            terminal: Arc::new(crate::terminal::TerminalManager::new()),
            port_forward: Arc::new(crate::portforward::PortForwardManager::new()),
            ai: Arc::new(crate::ai::AiCopilotService::new()),
        }
    }
}

/// Selects the TLS backend for the whole process.
///
/// Both `ring` (via kube's rustls-tls) and `aws-lc-rs` (via the AWS SDK) are in
/// the dependency graph. rustls 0.23 will not choose between two providers: it
/// panics on the first handshake with "Could not automatically determine the
/// process-level CryptoProvider". Since every cluster connection is HTTPS, that
/// panic makes the app incapable of reaching any real cluster — the failure looks
/// like "no data" rather than "TLS is broken", which is what makes it costly.
///
/// Idempotent: the second call is a no-op, so tests and examples can call it freely.
pub fn install_crypto_provider() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        if rustls::crypto::ring::default_provider()
            .install_default()
            .is_err()
        {
            tracing::debug!("rustls CryptoProvider was already installed");
        }

        // On macOS/Linux, GUI apps spawned outside a terminal often inherit a minimal PATH
        // (/usr/bin:/bin). Kubernetes exec credential plugins (aws, az, gcloud, kubelogin)
        // live in /opt/homebrew/bin, /usr/local/bin, or ~/.local/bin. Ensure they are reachable.
        if let Ok(current_path) = std::env::var("PATH") {
            let home = std::env::var("HOME").unwrap_or_default();
            let extra_paths = [
                "/opt/homebrew/bin".to_string(),
                "/opt/homebrew/sbin".to_string(),
                "/usr/local/bin".to_string(),
                format!("{}/.local/bin", home),
                format!("{}/bin", home),
            ];
            let mut parts: Vec<String> = current_path.split(':').map(|s| s.to_string()).collect();
            for p in extra_paths {
                if !parts.contains(&p) && std::path::Path::new(&p).exists() {
                    parts.insert(0, p);
                }
            }
            std::env::set_var("PATH", parts.join(":"));
        }
    });
}
