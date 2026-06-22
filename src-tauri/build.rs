// Capit v0.1.0 — restored original icons
use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    if let Ok(out_dir_str) = env::var("OUT_DIR") {
        let mut profile_dir = PathBuf::from(out_dir_str);
        while profile_dir.file_name().and_then(|s| s.to_str()) != Some(&profile) {
            if !profile_dir.pop() {
                break;
            }
        }
        if profile_dir.file_name().and_then(|s| s.to_str()) == Some(&profile) {
            let dlls = ["ggml.dll", "ggml-base.dll", "ggml-cpu.dll", "ggml-cuda.dll"];
            for dll in &dlls {
                let src = PathBuf::from("bin").join(dll);
                let dest = profile_dir.join(dll);
                if src.exists() {
                    let _ = fs::copy(&src, &dest);
                }
            }
        }
    }
    tauri_build::build()
}
