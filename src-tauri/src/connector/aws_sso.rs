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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwsSsoProfileDetail {
    pub profile_name: String,
    pub session_name: Option<String>,
    pub account_id: Option<String>,
    pub role_name: Option<String>,
    pub region: Option<String>,
    pub start_url: Option<String>,
}

pub fn normalize_start_url(url: &str) -> String {
    let u = url.trim();
    let u = u.strip_prefix("https://").unwrap_or(u);
    let u = u.strip_prefix("http://").unwrap_or(u);
    let u = u.trim_end_matches('/');
    let u = u.trim_end_matches('#');
    let u = u.trim_end_matches('/');
    let u = u.strip_suffix("/start").unwrap_or(u);
    u.trim_end_matches('/').to_lowercase()
}

pub fn parse_aws_sso_profiles() -> Vec<AwsSsoProfileDetail> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let path = PathBuf::from(home).join(".aws").join("config");
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut session_info: HashMap<String, (String, String)> = HashMap::new();
    let mut profile_maps: Vec<(String, HashMap<String, String>)> = Vec::new();

    let mut current_section = String::new();
    let mut current_map: HashMap<String, String> = HashMap::new();

    let mut process_sec = |section: &str, map: &HashMap<String, String>| {
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
                session_info.insert(session_name, (start_url, sso_region));
            }
        } else if section.starts_with("profile ") || section == "default" {
            let profile_name = if section == "default" {
                "default".to_string()
            } else {
                section.trim_start_matches("profile ").trim().to_string()
            };
            profile_maps.push((profile_name, map.clone()));
        }
    };

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.starts_with(';') || line.is_empty() {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            if !current_section.is_empty() {
                process_sec(&current_section, &current_map);
                current_map.clear();
            }
            current_section = line[1..line.len() - 1].trim().to_string();
        } else if let Some((k, v)) = line.split_once('=') {
            current_map.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    if !current_section.is_empty() {
        process_sec(&current_section, &current_map);
    }

    let mut result = Vec::new();
    for (prof_name, map) in profile_maps {
        let session_name = map.get("sso_session").cloned();
        let account_id = map.get("sso_account_id").cloned();
        let role_name = map.get("sso_role_name").cloned();
        let mut region = map.get("region").cloned();
        let mut start_url = map.get("sso_start_url").cloned();

        if let Some(ref sname) = session_name {
            if let Some((s_url, s_reg)) = session_info.get(sname) {
                if start_url.is_none() {
                    start_url = Some(s_url.clone());
                }
                if region.is_none() {
                    region = Some(s_reg.clone());
                }
            }
        }

        if session_name.is_some() || account_id.is_some() || start_url.is_some() {
            result.push(AwsSsoProfileDetail {
                profile_name: prof_name,
                session_name,
                account_id,
                role_name,
                region,
                start_url,
            });
        }
    }

    result
}

pub fn find_profiles_for_org(start_url: &str, alias: &str) -> Vec<AwsSsoProfileDetail> {
    let profiles = parse_aws_sso_profiles();
    let norm_target = normalize_start_url(start_url);
    let alias_lower = alias.to_lowercase();
    let alias_prefix = alias_lower.strip_suffix("-group").unwrap_or(&alias_lower);

    let mut matching: Vec<AwsSsoProfileDetail> = profiles
        .iter()
        .filter(|p| {
            if let Some(ref u) = p.start_url {
                let norm_u = normalize_start_url(u);
                if norm_u == norm_target
                    || norm_u.contains(&norm_target)
                    || norm_target.contains(&norm_u)
                {
                    return true;
                }
            }
            if let Some(ref s) = p.session_name {
                let s_lower = s.to_lowercase();
                if s_lower == alias_lower
                    || s_lower.contains(alias_prefix)
                    || alias_lower.contains(&s_lower)
                {
                    return true;
                }
            }
            if p.profile_name.to_lowercase().starts_with(alias_prefix) {
                return true;
            }
            false
        })
        .cloned()
        .collect();

    let mut seen = std::collections::HashSet::new();
    matching.retain(|p| seen.insert(p.profile_name.clone()));
    matching
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

                // Auto-discover accounts & write profiles to ~/.aws/config!
                let _ =
                    discover_and_save_sso_profiles_from_token(&access_token, region, session_name)
                        .await;

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

pub fn get_aws_cli_bin() -> std::path::PathBuf {
    if std::path::Path::new("/opt/homebrew/bin/aws").exists() {
        std::path::PathBuf::from("/opt/homebrew/bin/aws")
    } else if std::path::Path::new("/usr/local/bin/aws").exists() {
        std::path::PathBuf::from("/usr/local/bin/aws")
    } else {
        std::path::PathBuf::from("aws")
    }
}

pub fn is_aws_cli_installed() -> bool {
    let bin = get_aws_cli_bin();
    if bin.is_absolute() && bin.exists() {
        return true;
    }
    let path_env = std::env::var("PATH").unwrap_or_default();
    let extended = format!("/opt/homebrew/bin:/usr/local/bin:{}", path_env);
    for dir in extended.split(':') {
        let p = std::path::Path::new(dir).join("aws");
        if p.exists() && p.is_file() {
            return true;
        }
    }
    false
}

pub fn create_tokio_aws_command() -> tokio::process::Command {
    let bin = get_aws_cli_bin();
    let mut cmd = tokio::process::Command::new(bin);
    let path_env = std::env::var("PATH").unwrap_or_default();
    let extended_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", path_env);
    cmd.env("PATH", extended_path);
    cmd
}

pub fn ensure_sso_session_in_aws_config(
    session_name: &str,
    start_url: &str,
    sso_region: &str,
) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let aws_dir = PathBuf::from(home).join(".aws");
    if !aws_dir.exists() {
        let _ = std::fs::create_dir_all(&aws_dir);
    }
    let config_path = aws_dir.join("config");
    let content = std::fs::read_to_string(&config_path).unwrap_or_default();

    let session_header = format!("[sso-session {}]", session_name);
    if content.contains(&session_header) {
        return Ok(());
    }

    let mut new_content = content;
    if !new_content.is_empty() && !new_content.ends_with('\n') {
        new_content.push('\n');
    }
    new_content.push_str(&format!(
        "\n[sso-session {}]\nsso_start_url = {}\nsso_region = {}\nsso_registration_scopes = sso:account:access\n",
        session_name, start_url, sso_region
    ));

    std::fs::write(&config_path, new_content)
        .map_err(|e| format!("Failed to update ~/.aws/config: {}", e))
}

pub fn append_sso_profile_to_aws_config(
    profile_name: &str,
    session_name: &str,
    account_id: &str,
    role_name: &str,
    region: &str,
) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let aws_dir = PathBuf::from(home).join(".aws");
    if !aws_dir.exists() {
        let _ = std::fs::create_dir_all(&aws_dir);
    }
    let config_path = aws_dir.join("config");
    let content = std::fs::read_to_string(&config_path).unwrap_or_default();

    let profile_header = format!("[profile {}]", profile_name);
    if content.contains(&profile_header) {
        return Ok(());
    }

    let mut new_content = content;
    if !new_content.is_empty() && !new_content.ends_with('\n') {
        new_content.push('\n');
    }
    new_content.push_str(&format!(
        "\n[profile {}]\nsso_session = {}\nsso_account_id = {}\nsso_role_name = {}\nregion = {}\noutput = json\n",
        profile_name, session_name, account_id, role_name, region
    ));

    std::fs::write(&config_path, new_content)
        .map_err(|e| format!("Failed to append profile to ~/.aws/config: {}", e))
}

pub fn get_cached_sso_token(session_name: &str, start_url: &str) -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let cache_dir = PathBuf::from(home).join(".aws").join("sso").join("cache");
    if !cache_dir.exists() {
        return None;
    }

    let hashes = [sha1_hex(session_name), sha1_hex(start_url)];
    for h in hashes {
        let file = cache_dir.join(format!("{}.json", h));
        if let Ok(content) = std::fs::read_to_string(&file) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(token) = v.get("accessToken").and_then(|t| t.as_str()) {
                    if let Some(exp_str) = v.get("expiresAt").and_then(|e| e.as_str()) {
                        if let Ok(exp_dt) = chrono::DateTime::parse_from_rfc3339(exp_str) {
                            if exp_dt > chrono::Utc::now() {
                                return Some(token.to_string());
                            }
                        }
                    } else {
                        return Some(token.to_string());
                    }
                }
            }
        }
    }
    None
}

pub async fn discover_and_save_sso_profiles_from_token(
    access_token: &str,
    sso_region: &str,
    session_name: &str,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let accounts_url = format!(
        "https://portal.sso.{}.amazonaws.com/assignment/accounts?maxResults=100",
        sso_region
    );
    let resp = match client
        .get(&accounts_url)
        .header("x-amz-sso_bearer_token", access_token)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Failed to query AWS SSO accounts: {}", e);
            return Ok(vec![]);
        }
    };

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        tracing::warn!("AWS SSO accounts query returned error: {}", err);
        return Ok(vec![]);
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let account_list = match data["accountList"].as_array() {
        Some(a) => a,
        None => return Ok(vec![]),
    };

    let mut created_profiles = Vec::new();

    for acc in account_list {
        let account_id = match acc["accountId"].as_str() {
            Some(id) => id,
            None => continue,
        };
        let account_name = acc["accountName"].as_str().unwrap_or(account_id);
        let clean_acc = account_name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>();

        let roles_url = format!(
            "https://portal.sso.{}.amazonaws.com/assignment/accounts/{}/roles?maxResults=20",
            sso_region, account_id
        );

        let roles_resp = client
            .get(&roles_url)
            .header("x-amz-sso_bearer_token", access_token)
            .send()
            .await;

        let role_list = match roles_resp {
            Ok(r) if r.status().is_success() => {
                let r_data: serde_json::Value = r.json().await.unwrap_or_default();
                r_data["roleList"].as_array().cloned().unwrap_or_default()
            }
            _ => vec![],
        };

        let roles_to_add: Vec<String> = if role_list.is_empty() {
            vec!["AdministratorAccess".to_string()]
        } else {
            role_list
                .iter()
                .filter_map(|r| r["roleName"].as_str().map(|s| s.to_string()))
                .collect()
        };

        for role_name in roles_to_add {
            let prof_name = format!("{}-{}", session_name, clean_acc);
            if append_sso_profile_to_aws_config(
                &prof_name,
                session_name,
                account_id,
                &role_name,
                sso_region,
            )
            .is_ok()
            {
                created_profiles.push(prof_name);
            }
        }
    }

    Ok(created_profiles)
}

pub fn read_kubeconfig_resilient() -> Result<kube::config::Kubeconfig, String> {
    if let Ok(config) = kube::config::Kubeconfig::read() {
        return Ok(config);
    }

    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let kube_path = PathBuf::from(home).join(".kube").join("config");
    let content = match std::fs::read_to_string(&kube_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("Could not read kubeconfig file: {}", e)),
    };

    let repaired = content
        .lines()
        .map(|line| {
            let trimmed = line.trim();
            if trimmed == "a" {
                "      args:"
            } else if trimmed == "oken" || trimmed == "- oken" {
                "      - get-token"
            } else {
                line
            }
        })
        .collect::<Vec<&str>>()
        .join("\n");

    if let Ok(config) = serde_yaml::from_str::<kube::config::Kubeconfig>(&repaired) {
        return Ok(config);
    }

    serde_yaml::from_str::<kube::config::Kubeconfig>(&content)
        .map_err(|e| format!("Failed to parse kubeconfig: {}", e))
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
        let sessions = parse_aws_sso_config();
        let mut initial_orgs = Vec::new();

        for s in &sessions {
            let matching_profiles = find_profiles_for_org(&s.start_url, &s.session_name);
            let unique_accounts: std::collections::HashSet<_> = matching_profiles
                .iter()
                .filter_map(|p| p.account_id.as_ref())
                .collect();
            let assigned_role = matching_profiles
                .iter()
                .find_map(|p| p.role_name.clone())
                .unwrap_or_else(|| "AdministratorAccess".to_string());

            let domain_id = if let Some(domain) = s.start_url.strip_prefix("https://") {
                domain
                    .split('.')
                    .next()
                    .unwrap_or(&s.session_name)
                    .to_string()
            } else {
                s.session_name.clone()
            };

            if !initial_orgs
                .iter()
                .any(|o: &AwsSsoOrgConfig| o.id == domain_id)
            {
                initial_orgs.push(AwsSsoOrgConfig {
                    id: domain_id,
                    alias: s.session_name.clone(),
                    start_url: s.start_url.clone(),
                    sso_region: s.sso_region.clone(),
                    status: "authenticated".to_string(),
                    last_synced: Some("Just now".to_string()),
                    accounts_count: unique_accounts.len().max(1),
                    clusters_count: 0,
                    assigned_role: Some(assigned_role),
                });
            }
        }

        if initial_orgs.is_empty() {
            initial_orgs.push(AwsSsoOrgConfig {
                id: "orgdemo".to_string(),
                alias: "Demo AWS Organization".to_string(),
                start_url: "https://your-org.awsapps.com/start".to_string(),
                sso_region: "us-east-1".to_string(),
                status: "authenticated".to_string(),
                last_synced: Some("Just now".to_string()),
                accounts_count: 2,
                clusters_count: 2,
                assigned_role: Some("AdministratorAccess/devops@demo-org.com".to_string()),
            });
        }

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
        mut sso_region: String,
    ) -> AwsSsoOrgConfig {
        // Ensure sso-session is present in ~/.aws/config so AWS CLI knows about this org!
        let _ = ensure_sso_session_in_aws_config(&alias, &start_url, &sso_region);

        // If a valid cached token already exists for this session, auto-discover & save profiles!
        if let Some(cached_token) = get_cached_sso_token(&alias, &start_url) {
            let _ =
                discover_and_save_sso_profiles_from_token(&cached_token, &sso_region, &alias).await;
        }

        let matching = find_profiles_for_org(&start_url, &alias);
        let unique_accounts: std::collections::HashSet<_> = matching
            .iter()
            .filter_map(|p| p.account_id.as_ref())
            .collect();
        let assigned_role = matching.iter().find_map(|p| p.role_name.clone());

        if (sso_region == "all" || sso_region == "us-east-1") && !matching.is_empty() {
            if let Some(prof_region) = matching.iter().find_map(|p| p.region.clone()) {
                sso_region = prof_region;
            }
        }

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
            accounts_count: unique_accounts.len().max(1),
            clusters_count: 0,
            assigned_role,
        };

        let mut write = self.orgs.write().await;
        write.retain(|o| o.id != id);
        write.push(new_org.clone());
        new_org
    }

    pub async fn discover_clusters_for_org(&self, org_id: &str) -> Vec<ClusterContextSummary> {
        let read = self.orgs.read().await;
        let target_org = read
            .iter()
            .find(|o| o.id == org_id || o.alias == org_id)
            .cloned();
        drop(read);

        let org = match target_org {
            Some(o) => o,
            None => return vec![],
        };

        let mut discovered: Vec<ClusterContextSummary> = Vec::new();

        // 1. First, harvest all clusters from ~/.kube/config that belong to this org
        let matching_profiles = find_profiles_for_org(&org.start_url, &org.alias);
        let target_account_ids: std::collections::HashSet<String> = matching_profiles
            .iter()
            .filter_map(|p| p.account_id.clone())
            .collect();
        let target_profile_names: std::collections::HashSet<String> = matching_profiles
            .iter()
            .map(|p| p.profile_name.to_lowercase())
            .collect();

        if let Ok(kube_config) = read_kubeconfig_resilient() {
            for ctx in kube_config.contexts.iter() {
                let cluster_ref = ctx
                    .context
                    .as_ref()
                    .map(|c| c.cluster.clone())
                    .unwrap_or_default();
                let server_url = kube_config
                    .clusters
                    .iter()
                    .find(|c| c.name == cluster_ref)
                    .and_then(|c| c.cluster.as_ref())
                    .and_then(|c| c.server.clone())
                    .unwrap_or(cluster_ref.clone());

                let user_name = ctx.context.as_ref().map(|c| c.user.as_str());
                let user_info = user_name
                    .and_then(|uname| kube_config.auth_infos.iter().find(|u| u.name == uname));

                let user_profile = user_info.and_then(|u| {
                    u.auth_info.as_ref().and_then(|ai| {
                        ai.exec.as_ref().and_then(|exec| {
                            exec.env.as_ref().and_then(|envs| {
                                envs.iter()
                                    .find(|e| {
                                        e.get("name").map(|n| n.as_str()) == Some("AWS_PROFILE")
                                    })
                                    .and_then(|e| e.get("value").cloned())
                            })
                        })
                    })
                });

                // Detect ARN from context name, cluster_ref, or user_ref
                let arn_candidate = if ctx.name.starts_with("arn:aws:eks:") {
                    Some(ctx.name.as_str())
                } else if cluster_ref.starts_with("arn:aws:eks:") {
                    Some(cluster_ref.as_str())
                } else if user_name
                    .map(|u| u.starts_with("arn:aws:eks:"))
                    .unwrap_or(false)
                {
                    user_name
                } else {
                    None
                };

                let is_eks = server_url.contains(".eks.amazonaws.com") || arn_candidate.is_some();
                if !is_eks {
                    continue;
                }

                let (region_opt, account_id_opt, cluster_name, is_arn_name) = if let Some(arn) =
                    arn_candidate
                {
                    let parts: Vec<&str> = arn.split(':').collect();
                    let region = parts
                        .get(3)
                        .copied()
                        .filter(|s| !s.is_empty())
                        .unwrap_or(&org.sso_region)
                        .to_string();
                    let account_id = parts
                        .get(4)
                        .copied()
                        .filter(|s| !s.is_empty())
                        .unwrap_or("")
                        .to_string();
                    let name = parts
                        .get(5)
                        .and_then(|s| s.strip_prefix("cluster/"))
                        .unwrap_or(&ctx.name)
                        .to_string();
                    (
                        Some(region),
                        Some(account_id),
                        name,
                        ctx.name.starts_with("arn:aws:eks:"),
                    )
                } else {
                    let mut reg = None;
                    let mut cl_name = ctx.name.clone();
                    if let Some(u) = user_info {
                        if let Some(Some(exec)) = u.auth_info.as_ref().map(|ai| ai.exec.as_ref()) {
                            if let Some(ref args) = exec.args {
                                if let Some(pos) = args.iter().position(|a| a == "--region") {
                                    if let Some(r) = args.get(pos + 1) {
                                        reg = Some(r.clone());
                                    }
                                }
                                if let Some(pos) = args.iter().position(|a| a == "--cluster-name") {
                                    if let Some(n) = args.get(pos + 1) {
                                        cl_name = n.clone();
                                    }
                                }
                            }
                        }
                    }
                    if reg.is_none() && server_url.contains(".eks.amazonaws.com") {
                        let parts: Vec<&str> = server_url.split('.').collect();
                        if parts.len() >= 4 {
                            let idx = parts.len() - 3;
                            reg = Some(parts[idx].to_string());
                        }
                    }
                    (
                        reg.or_else(|| Some(org.sso_region.clone())),
                        None,
                        cl_name,
                        false,
                    )
                };

                let alias = if !is_arn_name {
                    ctx.name.clone()
                } else {
                    cluster_name.clone()
                };

                let belongs_to_org = account_id_opt
                    .as_ref()
                    .map(|acc| target_account_ids.contains(acc))
                    .unwrap_or(false)
                    || user_profile
                        .as_ref()
                        .map(|prof| target_profile_names.contains(&prof.to_lowercase()))
                        .unwrap_or(false)
                    || (!target_account_ids.is_empty()
                        && account_id_opt.is_none()
                        && ctx.name.to_lowercase().contains(&org.alias.to_lowercase()));

                if belongs_to_org {
                    let matched_profile = matching_profiles.iter().find(|p| {
                        account_id_opt.as_ref() == p.account_id.as_ref()
                            || user_profile.as_ref().map(|up| up.to_lowercase())
                                == Some(p.profile_name.to_lowercase())
                    });

                    let env = EnvironmentTier::from_name(&cluster_name);
                    let final_acc_id = account_id_opt
                        .or_else(|| matched_profile.and_then(|p| p.account_id.clone()));
                    let final_acc_name =
                        user_profile.or_else(|| matched_profile.map(|p| p.profile_name.clone()));
                    let final_reg =
                        region_opt.or_else(|| matched_profile.and_then(|p| p.region.clone()));
                    let final_role = matched_profile.and_then(|p| p.role_name.clone());

                    let dedupe_core = (
                        final_acc_id.clone().unwrap_or_default(),
                        final_reg.clone().unwrap_or_default(),
                        cluster_name.clone(),
                    );

                    let summary = ClusterContextSummary {
                        id: format!("eks:{}", ctx.name),
                        name: cluster_name.clone(),
                        provider: "eks".to_string(),
                        environment: env,
                        server_url,
                        current_namespace: ctx
                            .context
                            .as_ref()
                            .and_then(|c| c.namespace.clone())
                            .unwrap_or_else(|| "default".to_string()),
                        is_active: false,
                        alias: Some(alias),
                        context_name: Some(ctx.name.clone()),
                        org_id: Some(org_id.to_string()),
                        account_id: final_acc_id,
                        account_name: final_acc_name,
                        role: final_role,
                        region: final_reg,
                        k8s_version: None,
                    };

                    if is_arn_name {
                        // Only add if no entry with this cluster core already exists
                        if !discovered.iter().any(|d| {
                            d.account_id.as_deref().unwrap_or_default() == dedupe_core.0
                                && d.region.as_deref().unwrap_or_default() == dedupe_core.1
                                && d.name == dedupe_core.2
                        }) {
                            discovered.push(summary);
                        }
                    } else {
                        // If a raw ARN entry exists, replace it with this aliased entry!
                        if let Some(pos) = discovered.iter().position(|d| {
                            d.account_id.as_deref().unwrap_or_default() == dedupe_core.0
                                && d.region.as_deref().unwrap_or_default() == dedupe_core.1
                                && d.name == dedupe_core.2
                                && d.context_name
                                    .as_deref()
                                    .unwrap_or("")
                                    .starts_with("arn:aws:eks:")
                        }) {
                            discovered[pos] = summary;
                        } else if !discovered.iter().any(|d| d.id == summary.id) {
                            discovered.push(summary);
                        }
                    }
                }
            }
        }

        // 2. Active CLI discovery: query AWS EKS via AWS CLI for each profile across multiple regions
        let mut profiles_to_query: Vec<AwsSsoProfileDetail> = Vec::new();
        let mut seen_accounts = std::collections::HashSet::new();
        for p in matching_profiles {
            let acc = p
                .account_id
                .clone()
                .unwrap_or_else(|| p.profile_name.clone());
            if seen_accounts.insert(acc) {
                profiles_to_query.push(p);
            }
        }

        if profiles_to_query.is_empty() {
            let all_profiles = parse_aws_sso_profiles();
            if all_profiles
                .iter()
                .any(|p| p.profile_name.eq_ignore_ascii_case(&org.alias))
            {
                profiles_to_query.push(AwsSsoProfileDetail {
                    profile_name: org.alias.clone(),
                    session_name: None,
                    account_id: None,
                    role_name: None,
                    region: Some(org.sso_region.clone()),
                    start_url: Some(org.start_url.clone()),
                });
            } else {
                tracing::warn!(
                    "No configured AWS profiles found in ~/.aws/config matching org '{}' ({})",
                    org.alias,
                    org.start_url
                );
            }
        }

        for prof in profiles_to_query {
            let mut regions_to_try = Vec::new();
            if let Some(ref r) = prof.region {
                regions_to_try.push(r.clone());
            }
            if org.sso_region != "all" && !regions_to_try.contains(&org.sso_region) {
                regions_to_try.push(org.sso_region.clone());
            }
            // Multi-region scan across standard regions
            for r in [
                "eu-central-1",
                "eu-west-1",
                "us-east-1",
                "us-east-2",
                "us-west-2",
                "eu-west-2",
            ] {
                if !regions_to_try.contains(&r.to_string()) {
                    regions_to_try.push(r.to_string());
                }
            }

            for reg in regions_to_try {
                let list_output = match create_tokio_aws_command()
                    .args([
                        "eks",
                        "list-clusters",
                        "--profile",
                        &prof.profile_name,
                        "--region",
                        &reg,
                        "--output",
                        "json",
                    ])
                    .output()
                    .await
                {
                    Ok(out) => out,
                    Err(_) => continue,
                };

                if !list_output.status.success() {
                    continue;
                }

                let parsed: serde_json::Value = match serde_json::from_slice(&list_output.stdout) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let clusters = match parsed.get("clusters").and_then(|c| c.as_array()) {
                    Some(arr) => arr,
                    None => continue,
                };

                for cluster_val in clusters {
                    if let Some(cluster_name) = cluster_val.as_str() {
                        let already_known = discovered.iter().any(|d| {
                            d.name == cluster_name && d.region.as_deref().unwrap_or("") == reg
                        });
                        if already_known {
                            continue;
                        }

                        let desc_output = match create_tokio_aws_command()
                            .args([
                                "eks",
                                "describe-cluster",
                                "--name",
                                cluster_name,
                                "--profile",
                                &prof.profile_name,
                                "--region",
                                &reg,
                                "--output",
                                "json",
                            ])
                            .output()
                            .await
                        {
                            Ok(out) => out,
                            Err(_) => continue,
                        };

                        if !desc_output.status.success() {
                            continue;
                        }

                        let desc_parsed: serde_json::Value =
                            match serde_json::from_slice(&desc_output.stdout) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                        let cluster = desc_parsed.get("cluster");
                        let endpoint = cluster
                            .and_then(|c| c.get("endpoint"))
                            .and_then(|e| e.as_str())
                            .unwrap_or("https://unknown-endpoint")
                            .to_string();
                        let arn = cluster
                            .and_then(|c| c.get("arn"))
                            .and_then(|a| a.as_str())
                            .unwrap_or(&format!("eks:unknown:{}:{}", reg, cluster_name))
                            .to_string();
                        let k8s_version = cluster
                            .and_then(|c| c.get("version"))
                            .and_then(|v| v.as_str())
                            .map(|v| v.to_string());

                        let env = EnvironmentTier::from_name(cluster_name);
                        let cluster_alias = format!("{}-{}", cluster_name, reg);

                        discovered.push(ClusterContextSummary {
                            id: format!("eks:{}", arn),
                            name: cluster_name.to_string(),
                            provider: "eks".to_string(),
                            environment: env,
                            server_url: endpoint,
                            current_namespace: "default".to_string(),
                            is_active: false,
                            alias: Some(cluster_alias),
                            context_name: Some(arn.clone()),
                            org_id: Some(org_id.to_string()),
                            account_id: prof.account_id.clone(),
                            account_name: Some(prof.profile_name.clone()),
                            role: prof.role_name.clone(),
                            region: Some(reg.clone()),
                            k8s_version,
                        });
                    }
                }
            }
        }

        // Update the clusters_count and accounts_count in the org
        let mut write = self.orgs.write().await;
        if let Some(o) = write.iter_mut().find(|o| o.id == org_id) {
            o.clusters_count = discovered.len();
            if !target_account_ids.is_empty() {
                o.accounts_count = target_account_ids.len();
            }
        }

        discovered
    }
}
