use super::{ClusterContextSummary, EnvironmentTier};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoSessionEntry {
    pub session_name: String,
    pub start_url: String,
    pub sso_region: String,
    pub matching_profiles: Vec<String>,
    pub is_current_match: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwsSsoOrgConfig {
    pub id: String,
    pub alias: String,
    pub start_url: String,
    pub sso_region: String,
    pub status: String,
    pub last_synced: Option<String>,
    pub accounts_count: usize,
    pub clusters_count: usize,
    pub assigned_role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceAuthResponse {
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: String,
    pub device_code: String,
    pub expires_in: i32,
}

use sha1::{Digest, Sha1};

pub fn sha1_hex(input: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn parse_aws_sso_config() -> Vec<SsoSessionEntry> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let path = PathBuf::from(home).join(".aws").join("config");
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut sessions: HashMap<String, (String, String)> = HashMap::new();
    let mut profile_sessions: HashMap<String, String> = HashMap::new();
    let mut profile_direct: HashMap<String, (String, String)> = HashMap::new();

    let mut current_section = String::new();
    let mut current_map: HashMap<String, String> = HashMap::new();

    let process_section =
        |section: &str,
         map: &HashMap<String, String>,
         sessions: &mut HashMap<String, (String, String)>,
         profile_sessions: &mut HashMap<String, String>,
         profile_direct: &mut HashMap<String, (String, String)>| {
            if section.starts_with("sso-session ") {
                let session_name = section
                    .trim_start_matches("sso-session ")
                    .trim()
                    .to_string();
                let start_url = map.get("sso_start_url").cloned().unwrap_or_default();
                let sso_region = map
                    .get("sso_region")
                    .cloned()
                    .unwrap_or_else(|| "us-east-1".to_string());
                if !start_url.is_empty() {
                    sessions.insert(session_name, (start_url, sso_region));
                }
            } else if section.starts_with("profile ") || section == "default" {
                let profile_name = if section == "default" {
                    "default".to_string()
                } else {
                    section.trim_start_matches("profile ").trim().to_string()
                };
                if let Some(sso_sess) = map.get("sso_session") {
                    profile_sessions.insert(profile_name, sso_sess.clone());
                } else if let Some(start_url) = map.get("sso_start_url") {
                    let sso_region = map
                        .get("sso_region")
                        .cloned()
                        .unwrap_or_else(|| "us-east-1".to_string());
                    profile_direct.insert(profile_name, (start_url.clone(), sso_region));
                }
            }
        };

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.starts_with(';') || line.is_empty() {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            if !current_section.is_empty() {
                process_section(
                    &current_section,
                    &current_map,
                    &mut sessions,
                    &mut profile_sessions,
                    &mut profile_direct,
                );
                current_map.clear();
            }
            current_section = line[1..line.len() - 1].trim().to_string();
        } else if let Some((k, v)) = line.split_once('=') {
            current_map.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    if !current_section.is_empty() {
        process_section(
            &current_section,
            &current_map,
            &mut sessions,
            &mut profile_sessions,
            &mut profile_direct,
        );
    }

    let mut result: Vec<SsoSessionEntry> = Vec::new();

    for (session_name, (start_url, sso_region)) in sessions {
        let matching: Vec<String> = profile_sessions
            .iter()
            .filter(|(_, s)| *s == &session_name)
            .map(|(p, _)| p.clone())
            .collect();
        result.push(SsoSessionEntry {
            session_name,
            start_url,
            sso_region,
            matching_profiles: matching,
            is_current_match: false,
        });
    }

    for (profile_name, (start_url, sso_region)) in profile_direct {
        result.push(SsoSessionEntry {
            session_name: profile_name.clone(),
            start_url,
            sso_region,
            matching_profiles: vec![profile_name],
            is_current_match: false,
        });
    }

    result.sort_by(|a, b| a.session_name.cmp(&b.session_name));
    result
}

pub async fn login_aws_sso_native(
    start_url: &str,
    region: &str,
    session_name: &str,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    // 1. Register Client
    let register_url = format!("https://oidc.{}.amazonaws.com/client/register", region);
    let reg_body = serde_json::json!({
        "clientName": "k8s-ui-desktop",
        "clientType": "public",
        "scopes": ["sso:account:access"]
    });

    let reg_resp = client
        .post(&register_url)
        .json(&reg_body)
        .send()
        .await
        .map_err(|e| format!("Failed to register OIDC client with AWS: {}", e))?;

    if !reg_resp.status().is_success() {
        let err_text = reg_resp.text().await.unwrap_or_default();
        return Err(format!("OIDC Client registration failed: {}", err_text));
    }

    let reg_data: serde_json::Value = reg_resp.json().await.map_err(|e| e.to_string())?;
    let client_id = reg_data["clientId"]
        .as_str()
        .ok_or("Missing clientId from AWS OIDC response")?
        .to_string();
    let client_secret = reg_data["clientSecret"]
        .as_str()
        .ok_or("Missing clientSecret from AWS OIDC response")?
        .to_string();
    let client_secret_expires_at = reg_data["clientSecretExpiresAt"].as_i64().unwrap_or(0);

    // 2. Start Device Authorization
    let device_auth_url = format!("https://oidc.{}.amazonaws.com/device_authorization", region);
    let dev_body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "startUrl": start_url
    });

    let dev_resp = client
        .post(&device_auth_url)
        .json(&dev_body)
        .send()
        .await
        .map_err(|e| format!("Failed to initiate device auth: {}", e))?;

    if !dev_resp.status().is_success() {
        let err_text = dev_resp.text().await.unwrap_or_default();
        return Err(format!("Device authorization failed: {}", err_text));
    }

    let dev_data: serde_json::Value = dev_resp.json().await.map_err(|e| e.to_string())?;
    let device_code = dev_data["deviceCode"]
        .as_str()
        .ok_or("Missing deviceCode from AWS OIDC response")?
        .to_string();
    let user_code = dev_data["userCode"].as_str().unwrap_or("").to_string();
    let verification_uri_complete = dev_data["verificationUriComplete"]
        .as_str()
        .unwrap_or_else(|| dev_data["verificationUri"].as_str().unwrap_or(start_url))
        .to_string();
    let interval = dev_data["interval"].as_u64().unwrap_or(2).max(1);
    let expires_in = dev_data["expiresIn"].as_u64().unwrap_or(600);

    // 3. Immediately open the default browser directly to the verification page
    tracing::info!(
        "Launching AWS SSO browser authorization: {}",
        verification_uri_complete
    );
    let _ = std::process::Command::new("open")
        .arg(&verification_uri_complete)
        .spawn();

    // 4. Poll Token Endpoint until the user approves in browser
    let token_url = format!("https://oidc.{}.amazonaws.com/token", region);
    let token_body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
        "deviceCode": device_code
    });

    let start_time = std::time::Instant::now();
    let timeout_duration = std::time::Duration::from_secs(expires_in);

    loop {
        if start_time.elapsed() > timeout_duration {
            return Err("AWS SSO login timed out. Please click login again.".to_string());
        }

        tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

        let token_resp = client.post(&token_url).json(&token_body).send().await;

        if let Ok(resp) = token_resp {
            if resp.status().is_success() {
                let token_data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                let access_token = token_data["accessToken"]
                    .as_str()
                    .ok_or("Missing accessToken in token response")?
                    .to_string();
                let expires_in_sec = token_data["expiresIn"].as_i64().unwrap_or(28800);
                let refresh_token = token_data["refreshToken"].as_str().map(|s| s.to_string());

                let expires_at = chrono::Utc::now() + chrono::Duration::seconds(expires_in_sec);
                let expires_at_str = expires_at.to_rfc3339();

                // 5. Write cache JSON to ~/.aws/sso/cache/
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                let cache_dir = PathBuf::from(home).join(".aws").join("sso").join("cache");
                let _ = std::fs::create_dir_all(&cache_dir);

                let cache_payload = serde_json::json!({
                    "startUrl": start_url,
                    "region": region,
                    "accessToken": access_token,
                    "expiresAt": expires_at_str,
                    "clientId": client_id,
                    "clientSecret": client_secret,
                    "registrationExpiresAt": chrono::DateTime::from_timestamp(client_secret_expires_at, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default(),
                    "refreshToken": refresh_token
                });

                // Write with SHA1 of session_name
                let hash_session = sha1_hex(session_name);
                let file_session = cache_dir.join(format!("{}.json", hash_session));
                let _ = std::fs::write(
                    &file_session,
                    serde_json::to_string_pretty(&cache_payload).unwrap_or_default(),
                );

                // Also write with SHA1 of start_url
                let hash_url = sha1_hex(start_url);
                let file_url = cache_dir.join(format!("{}.json", hash_url));
                let _ = std::fs::write(
                    &file_url,
                    serde_json::to_string_pretty(&cache_payload).unwrap_or_default(),
                );

                return Ok(format!(
                    "Successfully authenticated AWS SSO for '{}' (Code: {})",
                    session_name, user_code
                ));
            } else {
                let status_code = resp.status().as_u16();
                let err_data: serde_json::Value = resp.json().await.unwrap_or_default();
                let err_type = err_data["error"].as_str().unwrap_or("");
                if err_type == "authorization_pending" {
                    // Continue waiting for user to click 'Allow' in browser
                    continue;
                } else if err_type == "slow_down" {
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                    continue;
                } else if err_type == "expired_token" {
                    return Err("SSO verification code expired. Please try again.".to_string());
                } else {
                    return Err(format!(
                        "Authorization error ({}): {}",
                        status_code, err_type
                    ));
                }
            }
        }
    }
}

pub struct AwsSsoManager {
    orgs: Arc<RwLock<Vec<AwsSsoOrgConfig>>>,
}

impl Default for AwsSsoManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AwsSsoManager {
    pub fn new() -> Self {
        let initial_orgs = vec![AwsSsoOrgConfig {
            id: "orgdemo".to_string(),
            alias: "Demo AWS Organization".to_string(),
            start_url: "https://your-org.awsapps.com/start".to_string(),
            sso_region: "us-east-1".to_string(),
            status: "authenticated".to_string(),
            last_synced: Some("Just now".to_string()),
            accounts_count: 2,
            clusters_count: 2,
            assigned_role: Some("AdministratorAccess/devops@demo-org.com".to_string()),
        }];
        Self {
            orgs: Arc::new(RwLock::new(initial_orgs)),
        }
    }

    pub async fn list_orgs(&self) -> Vec<AwsSsoOrgConfig> {
        let read = self.orgs.read().await;
        read.clone()
    }

    pub async fn register_org(
        &self,
        alias: String,
        start_url: String,
        sso_region: String,
    ) -> AwsSsoOrgConfig {
        let id = if let Some(domain) = start_url.strip_prefix("https://") {
            domain.split('.').next().unwrap_or("aws-org").to_string()
        } else {
            format!("org-{}", chrono::Utc::now().timestamp_millis())
        };

        let new_org = AwsSsoOrgConfig {
            id: id.clone(),
            alias,
            start_url,
            sso_region,
            status: "authenticated".to_string(),
            last_synced: Some("Just now".to_string()),
            accounts_count: 2,
            clusters_count: 2,
            assigned_role: Some("AdministratorAccess/devops@demo-org.com".to_string()),
        };

        let mut write = self.orgs.write().await;
        write.retain(|o| o.id != id);
        write.push(new_org.clone());
        new_org
    }

    pub async fn discover_clusters_for_org(&self, org_id: &str) -> Vec<ClusterContextSummary> {
        let read = self.orgs.read().await;
        let target_org = read.iter().find(|o| o.id == org_id);

        if let Some(_org) = target_org {
            vec![
                ClusterContextSummary {
                    id: "eks:111122223333:us-east-1:pdn-acme".to_string(),
                    name: "pdn-acme".to_string(),
                    provider: "eks".to_string(),
                    environment: EnvironmentTier::Production,
                    server_url: "https://B78A1239DF55A2C.gr7.us-east-1.eks.amazonaws.com"
                        .to_string(),
                    current_namespace: "pdn-acme-backend".to_string(),
                    is_active: false,
                },
                ClusterContextSummary {
                    id: "eks:444455556666:us-east-1:qa-acme".to_string(),
                    name: "qa-acme".to_string(),
                    provider: "eks".to_string(),
                    environment: EnvironmentTier::Development,
                    server_url: "https://A94B3C58DF12A1B.gr7.us-east-1.eks.amazonaws.com"
                        .to_string(),
                    current_namespace: "qa-acme-backend".to_string(),
                    is_active: false,
                },
            ]
        } else {
            vec![]
        }
    }
}
