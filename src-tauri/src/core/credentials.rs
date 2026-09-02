use keyring::Entry;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum KeyringError {
    #[error("Keyring access error: {0}")]
    AccessError(String),
}

pub struct CredentialVault {
    service_name: String,
}

impl Default for CredentialVault {
    fn default() -> Self {
        Self::new()
    }
}

impl CredentialVault {
    pub fn new() -> Self {
        Self {
            service_name: "dev.k8sui.app".to_string(),
        }
    }

    /// Store a sensitive key (e.g. Anthropic/OpenAI API key) in OS-native secure keychain
    pub fn set_secret(&self, key_name: &str, secret_value: &str) -> Result<(), KeyringError> {
        let entry = Entry::new(&self.service_name, key_name)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;
        entry
            .set_password(secret_value)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;
        Ok(())
    }

    /// Retrieve secret from OS-native secure keychain
    pub fn get_secret(&self, key_name: &str) -> Result<Option<String>, KeyringError> {
        let entry = Entry::new(&self.service_name, key_name)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;
        match entry.get_password() {
            Ok(pass) => Ok(Some(pass)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(KeyringError::AccessError(e.to_string())),
        }
    }

    /// Delete secret from OS-native secure keychain
    pub fn delete_secret(&self, key_name: &str) -> Result<(), KeyringError> {
        let entry = Entry::new(&self.service_name, key_name)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;
        let _ = entry.delete_password();
        Ok(())
    }
}
