use std::{
    env,
    path::{Path, PathBuf},
};

const DEFAULT_MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;
const DEFAULT_INITIALIZE_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS: u64 = 30_000;

#[derive(Clone, Debug)]
pub struct RuntimeConfig {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub codex_home: Option<PathBuf>,
    pub max_frame_bytes: usize,
    pub initialize_timeout_ms: u64,
    pub request_timeout_ms: u64,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

impl RuntimeConfig {
    pub fn from_env() -> Self {
        let binary = env::var_os("SUNLAB_CODEX_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("codex"));
        let (program, mut entrypoint_args) = entrypoint_for_binary(&binary);
        entrypoint_args.push("app-server".to_string());
        if Self::is_javascript_entrypoint(&binary) {
            if let Ok(scenario) = env::var("SUNLAB_FAKE_SCENARIO") {
                entrypoint_args.push("--scenario".to_string());
                entrypoint_args.push(scenario);
            }
        }

        Self {
            program,
            args: entrypoint_args,
            codex_home: env::var_os("SUNLAB_CODEX_HOME").map(PathBuf::from),
            max_frame_bytes: positive_env("SUNLAB_MAX_FRAME_BYTES")
                .and_then(|value| usize::try_from(value).ok())
                .unwrap_or(DEFAULT_MAX_FRAME_BYTES),
            initialize_timeout_ms: positive_env("SUNLAB_INITIALIZE_TIMEOUT_MS")
                .unwrap_or(DEFAULT_INITIALIZE_TIMEOUT_MS),
            request_timeout_ms: positive_env("SUNLAB_REQUEST_TIMEOUT_MS")
                .unwrap_or(DEFAULT_REQUEST_TIMEOUT_MS),
        }
    }

    pub fn command(&self) -> tokio::process::Command {
        let mut command = tokio::process::Command::new(&self.program);
        command.args(&self.args);
        if let Some(codex_home) = &self.codex_home {
            command.env("CODEX_HOME", codex_home);
        }
        command
    }
}

fn entrypoint_for_binary(binary: &Path) -> (PathBuf, Vec<String>) {
    let is_script = RuntimeConfig::is_javascript_entrypoint(binary);

    if is_script {
        (
            env::var_os("SUNLAB_NODE_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("node")),
            vec![binary.to_string_lossy().into_owned()],
        )
    } else {
        (binary.to_path_buf(), Vec::new())
    }
}

impl RuntimeConfig {
    fn is_javascript_entrypoint(binary: &Path) -> bool {
        matches!(
            binary.extension().and_then(|extension| extension.to_str()),
            Some("js") | Some("mjs") | Some("cjs")
        )
    }
}

fn positive_env(name: &str) -> Option<u64> {
    env::var(name).ok()?.parse().ok().filter(|value| *value > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn javascript_runtime_is_invoked_through_node() {
        let (program, arguments) =
            entrypoint_for_binary(&PathBuf::from("./scripts/fake-codex-app-server.mjs"));

        assert_eq!(program, PathBuf::from("node"));
        assert_eq!(arguments, vec!["./scripts/fake-codex-app-server.mjs"]);
    }

    #[test]
    fn native_runtime_is_invoked_directly() {
        let (program, arguments) = entrypoint_for_binary(&PathBuf::from("/usr/local/bin/codex"));

        assert_eq!(program, PathBuf::from("/usr/local/bin/codex"));
        assert!(arguments.is_empty());
    }
}
