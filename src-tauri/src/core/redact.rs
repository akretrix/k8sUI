use regex::Regex;
use std::sync::OnceLock;

static AWS_KEY_REGEX: OnceLock<Regex> = OnceLock::new();
static AWS_SECRET_KEY_REGEX: OnceLock<Regex> = OnceLock::new();
static URI_PASSWORD_REGEX: OnceLock<Regex> = OnceLock::new();
static BEARER_TOKEN_REGEX: OnceLock<Regex> = OnceLock::new();
static PRIVATE_KEY_REGEX: OnceLock<Regex> = OnceLock::new();
static K8S_SECRET_DATA_REGEX: OnceLock<Regex> = OnceLock::new();

pub struct RedactionEngine;

impl RedactionEngine {
    /// Scrub credentials and tokens from any string before logging or feeding to AI context
    pub fn scrub(input: &str) -> String {
        let aws_re = AWS_KEY_REGEX
            .get_or_init(|| Regex::new(r"(?i)(AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}").unwrap());
        let aws_secret_re = AWS_SECRET_KEY_REGEX.get_or_init(|| {
            Regex::new(r"(?i)(AWS_SECRET_ACCESS_KEY\s*[:=]\s*)[A-Za-z0-9/+=]{40}").unwrap()
        });
        let uri_pwd_re =
            URI_PASSWORD_REGEX.get_or_init(|| Regex::new(r"(://[^:/@\s]+:)([^@\s]+)(@)").unwrap());
        let bearer_re = BEARER_TOKEN_REGEX.get_or_init(|| {
            Regex::new(r"(?i)(bearer\s+|token[:=]\s*)[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*").unwrap()
        });
        let priv_key_re = PRIVATE_KEY_REGEX.get_or_init(|| {
            Regex::new(r"(?s)-----BEGIN [A-Z ]+PRIVATE KEY-----.*?-----END [A-Z ]+PRIVATE KEY-----")
                .unwrap()
        });
        let secret_data_re = K8S_SECRET_DATA_REGEX.get_or_init(|| {
            Regex::new(r#"(?m)^\s*(data|stringData):\s*\n(\s+[\w.\-]+:\s*.+\n?)+"#).unwrap()
        });

        let scrubbed = aws_re.replace_all(input, "[REDACTED_AWS_KEY]");
        let scrubbed = aws_secret_re.replace_all(&scrubbed, "$1[REDACTED_AWS_SECRET_KEY]");
        let scrubbed = uri_pwd_re.replace_all(&scrubbed, "${1}[REDACTED_PASSWORD]${3}");
        let scrubbed = bearer_re.replace_all(&scrubbed, "$1[REDACTED_TOKEN]");
        let scrubbed = priv_key_re.replace_all(&scrubbed, "[REDACTED_PRIVATE_KEY]");
        let scrubbed = secret_data_re.replace_all(
            &scrubbed,
            "data:\n    # [REDACTED_SECRET_VALUES_BY_K8SUI]\n",
        );

        scrubbed.into_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redaction() {
        let text = "My key is AKIAIOSFODNN7EXAMPLE and token is bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-x";
        let cleaned = RedactionEngine::scrub(text);
        assert!(!cleaned.contains("AKIAIOSFODNN7EXAMPLE"));
        assert!(cleaned.contains("[REDACTED_AWS_KEY]"));
    }

    #[test]
    fn test_secret_data_block_is_redacted() {
        let yaml =
            "apiVersion: v1\nkind: Secret\ndata:\n  API_KEY: c29tZS1zZWNyZXQ=\ntype: Opaque\n";
        let cleaned = RedactionEngine::scrub(yaml);
        assert!(!cleaned.contains("c29tZS1zZWNyZXQ="));
        assert!(cleaned.contains("REDACTED_SECRET_VALUES"));
    }

    /// Regression test: a Secret keyed as `app.env` (a whole .env file
    /// stored as one data entry) reached a live production-adjacent cluster
    /// and passed through get_resource_yaml completely unredacted, because
    /// the key character class didn't allow `.` — a character Kubernetes
    /// itself permits in data keys. This is the exact shape that missed.
    #[test]
    fn test_secret_data_key_with_dot_is_redacted() {
        let yaml = "apiVersion: v1\nkind: Secret\nmetadata:\n  name: example-backend-secrets\ndata:\n  app.env: UE9SVD0zMDAwCiMjIERhdGFiYXNl\ntype: Opaque\n";
        let cleaned = RedactionEngine::scrub(yaml);
        assert!(!cleaned.contains("UE9SVD0zMDAwCiMjIERhdGFiYXNl"));
        assert!(cleaned.contains("REDACTED_SECRET_VALUES"));
    }
}
