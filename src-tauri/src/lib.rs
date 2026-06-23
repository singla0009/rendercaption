use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::time::Instant;
use std::fs;
use sysinfo::System;

use std::sync::atomic::{AtomicBool, Ordering};

static ABORT_INFERENCE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
async fn abort_transcription() -> Result<(), AppError> {
    ABORT_INFERENCE.store(true, Ordering::SeqCst);
    Ok(())
}

struct TempDirGuard {
    path: std::path::PathBuf,
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        let path_clone = self.path.clone();
        std::thread::spawn(move || {
            let _ = fs::remove_dir_all(&path_clone);
        });
    }
}

// Resolve models directory: checks multiple locations, picks the first that has models
fn get_models_dir(_app: &tauri::AppHandle) -> std::path::PathBuf {
    // Check these directories in order
    let candidates = vec![
        // 1. Next to the app executable (production)
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("models"))),
        // 2. Project root /models during dev
        std::env::current_dir().ok().map(|d| d.join("models")),
    ];
    
    // Return the first directory that actually contains .gguf files
    for candidate in &candidates {
        if let Some(dir) = candidate {
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(dir) {
                    let has_models = entries
                        .filter_map(Result::ok)
                        .any(|e| e.path().extension().map_or(false, |ext| ext == "gguf"));
                    if has_models {
                        return dir.clone();
                    }
                }
            }
        }
    }
    
    // Default: create models dir exactly where the app is installed
    let default = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("models")))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default().join("models"));
        
    let _ = fs::create_dir_all(&default);
    default
}

fn resolve_model_path(app: &tauri::AppHandle, model_id: &str) -> Option<std::path::PathBuf> {
    let models_dir = get_models_dir(app);
    let registry = get_model_registry();
    if let Some(entry) = registry.iter().find(|(id, _, _, _, _, _)| *id == model_id) {
        let path = models_dir.join(entry.2);
        if path.exists() {
            return Some(path);
        }
    }
    let custom_path = models_dir.join(model_id);
    if custom_path.exists() {
        return Some(custom_path);
    }
    None
}

// Helper to chunk any media file using FFmpeg into mono 16000Hz chunks
async fn preprocess_media(
    app: &tauri::AppHandle,
    file_path: &str,
    temp_dir: &std::path::Path,
    chunk_secs: usize
) -> Result<(Vec<(String, f32, f32)>, f32), String> {
    let command = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    
    let output_pattern = temp_dir.join("chunk_%04d.wav");
    
    app.emit("transcription-log", "   Extracting audio, resampling to 16kHz mono...".to_string()).unwrap_or(());
    
    // Run ffmpeg to extract, resample to 16kHz mono, and split into segments
    let output = command.args([
        "-y",
        "-i", file_path,
        "-ar", "16000",
        "-ac", "1",
        "-f", "segment",
        "-segment_time", &chunk_secs.to_string(),
        "-c:a", "pcm_s16le",
        &output_pattern.to_string_lossy()
    ]).output().await.map_err(|e| format!("FFmpeg failed to start: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        app.emit("transcription-log", format!("   [FFmpeg stderr] {}", stderr.chars().take(300).collect::<String>())).unwrap_or(());
        return Err(stderr.to_string());
    }

    app.emit("transcription-log", "   ✅ FFmpeg extraction complete. Scanning chunks...".to_string()).unwrap_or(());

    // Gather generated chunks using a background thread so we don't block Tokio worker threads
    let temp_dir_clone = temp_dir.to_path_buf();
    let (chunk_files, total_duration) = tauri::async_runtime::spawn_blocking(move || {
        let mut chunk_files = Vec::new();
        let mut total_duration = 0.0;
        
        let mut entries: Vec<_> = fs::read_dir(&temp_dir_clone)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().unwrap_or_default() == "wav")
            .collect();
            
        entries.sort_by_key(|e| {
            let fname = e.file_name();
            let fname_str = fname.to_string_lossy();
            if fname_str.starts_with("chunk_") && fname_str.ends_with(".wav") {
                fname_str[6..fname_str.len() - 4].parse::<usize>().unwrap_or(usize::MAX)
            } else {
                usize::MAX
            }
        });
        
        for entry in entries.iter() {
            let chunk_path = entry.path();
            
            let duration_secs = match hound::WavReader::open(&chunk_path) {
                Ok(reader) => {
                    let spec = reader.spec();
                    reader.duration() as f32 / spec.sample_rate as f32
                },
                Err(e) => return Err(format!("Failed to parse wav chunk {}: {}", chunk_path.display(), e))
            };
            
            let start_time = total_duration;
            let end_time = start_time + duration_secs;
            
            chunk_files.push((chunk_path.to_string_lossy().to_string(), start_time, end_time));
            total_duration = end_time;
        }
        Ok::<_, String>((chunk_files, total_duration))
    }).await.unwrap()?;
    
    for (idx, (_, start_time, end_time)) in chunk_files.iter().enumerate() {
        app.emit("transcription-log", format!("   Chunk {}: {:.1}s - {:.1}s", idx + 1, start_time, end_time)).unwrap_or(());
    }
    
    if chunk_files.is_empty() {
        return Err("No audio chunks were generated by ffmpeg.".to_string());
    }
    
    app.emit("transcription-log", format!("   Total: {} chunks, {:.1}s of audio", chunk_files.len(), total_duration)).unwrap_or(());
    
    Ok((chunk_files, total_duration))
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
struct WordInfo {
    w: String,
    start: f32,
    end: f32,
    conf: f32,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
struct ChunkJson {
    text: String,
    words: Vec<WordInfo>,
}

#[derive(serde::Serialize, Clone, Debug)]
struct TranscriptionResult {
    text: String,
    words: Vec<WordInfo>,
    audio_duration: f32,
    total_time: f32,
    rtf: f32,
}

#[derive(serde::Serialize, Clone, Debug)]
struct ModelInfo {
    id: String,
    name: String,
    filename: String,
    exists: bool,
    path: String,
    size_mb: f64,
    url: String,
    languages: String,
    vram_req: String,
}

#[derive(serde::Serialize, Clone, Debug)]
struct ModelStatus {
    models: Vec<ModelInfo>,
    models_dir: String,
}

fn get_model_registry() -> Vec<(&'static str, &'static str, &'static str, &'static str, &'static str, &'static str)> {
    vec![
        // Indic Models (Conformer CTC)
        ("hi", "Hinglish Conformer CTC", "hinglish-conformer-ctc.f32.gguf", 
         "https://huggingface.co/Singla0009/Hinglish-Conformer-CTC-GGUF/resolve/main/hinglish-conformer-ctc.f32.gguf",
         "Hindi, English (Hinglish)", "~1.1 GB VRAM"),
        ("pa", "Punjabi Conformer CTC", "indicconformer-punjabi.f32.gguf",
         "https://huggingface.co/Singla0009/IndicConformer-GGUF/resolve/main/indicconformer-punjabi.f32.gguf",
         "Punjabi", "~1.1 GB VRAM"),
        ("hi_large", "Hindi Conformer (Large)", "indicconformer-hindi.f32.gguf",
         "https://huggingface.co/Singla0009/IndicConformer-GGUF/resolve/main/indicconformer-hindi.f32.gguf",
         "Hindi", "~1.1 GB VRAM"),
         
        // European / Global Models (TDT & RNNT)
        ("pt", "Portuguese Conformer Hybrid", "portuguese-fastconformer-hybrid-large.f32.gguf",
         "https://huggingface.co/Singla0009/Portuguese-FastConformer-Hybrid-GGUF/resolve/main/portuguese-fastconformer-hybrid-large.f32.gguf",
         "Portuguese", "~1.1 GB VRAM"),
        ("tdt-1.1b-q8", "English Parakeet TDT 1.1B (Q8)", "tdt-1.1b-q8_0.gguf",
         "https://huggingface.co/mudler/parakeet-cpp-gguf/resolve/main/tdt-1.1b-q8_0.gguf",
         "English Only", "~1.8 GB VRAM"),
        ("tdt-1.1b-q4", "English Parakeet TDT 1.1B (Q4)", "tdt-1.1b-q4_k.gguf",
         "https://huggingface.co/mudler/parakeet-cpp-gguf/resolve/main/tdt-1.1b-q4_k.gguf",
         "English Only", "~1.3 GB VRAM"),
        ("rnnt-1.1b-q8", "Multilingual Parakeet RNNT 1.1B (Q8)", "rnnt-1.1b-q8_0.gguf",
         "https://huggingface.co/mudler/parakeet-cpp-gguf/resolve/main/rnnt-1.1b-q8_0.gguf",
         "25+ Languages (EN, FR, JA...)", "~1.8 GB VRAM"),
        ("rnnt-1.1b-q4", "Multilingual Parakeet RNNT 1.1B (Q4)", "rnnt-1.1b-q4_k.gguf",
         "https://huggingface.co/mudler/parakeet-cpp-gguf/resolve/main/rnnt-1.1b-q4_k.gguf",
         "25+ Languages (EN, FR, JA...)", "~1.3 GB VRAM"),
        ("eu-fast", "Multilingual Parakeet TDT 0.6B (Fast)", "parakeet-tdt-0.6b-v3-q4_k.gguf",
         "https://huggingface.co/cstr/parakeet-tdt-0.6b-v3-GGUF/resolve/main/parakeet-tdt-0.6b-v3-q4_k.gguf",
         "25+ Languages (EN, FR, JA...)", "~800 MB VRAM"),
    ]
}

#[derive(serde::Serialize, Debug)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl From<String> for AppError {
    fn from(err: String) -> Self {
        AppError { code: "GENERIC_ERROR".to_string(), message: err }
    }
}

impl From<&str> for AppError {
    fn from(err: &str) -> Self {
        AppError { code: "GENERIC_ERROR".to_string(), message: err.to_string() }
    }
}

#[tauri::command]
async fn check_models(app: tauri::AppHandle) -> Result<ModelStatus, AppError> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let models_dir = get_models_dir(&app_clone);
        let registry = get_model_registry();
        
        let mut models = Vec::new();
        let mut known_filenames = std::collections::HashSet::new();
        
        for (id, name, filename, url, langs, vram) in registry {
            known_filenames.insert(filename.to_string());
            let path = models_dir.join(filename);
            let size_mb = if path.exists() {
                fs::metadata(&path).map(|m| m.len() as f64 / 1_048_576.0).unwrap_or(0.0)
            } else {
                0.0
            };
            models.push(ModelInfo {
                id: id.to_string(),
                name: name.to_string(),
                filename: filename.to_string(),
                exists: path.exists(),
                path: path.to_string_lossy().to_string(),
                size_mb,
                url: url.to_string(),
                languages: langs.to_string(),
                vram_req: vram.to_string(),
            });
        }

        // Scan for custom models in the directory
        if let Ok(entries) = fs::read_dir(&models_dir) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "gguf") {
                    let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if !known_filenames.contains(&filename) {
                        let size_mb = fs::metadata(&path).map(|m| m.len() as f64 / 1_048_576.0).unwrap_or(0.0);
                        models.push(ModelInfo {
                            id: filename.clone(),
                            name: "Custom / Local GGUF".to_string(),
                            filename: filename.clone(),
                            exists: true,
                            path: path.to_string_lossy().to_string(),
                            size_mb,
                            url: "".to_string(),
                            languages: "Unknown".to_string(),
                            vram_req: "? VRAM".to_string(),
                        });
                    }
                }
            }
        }
        
        Ok(ModelStatus {
            models,
            models_dir: models_dir.to_string_lossy().to_string(),
        })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn import_custom_model(app: tauri::AppHandle, file_path: String) -> Result<String, AppError> {
    let source_path = std::path::Path::new(&file_path);
    if !source_path.exists() {
        return Err("Selected file does not exist.".to_string().into());
    }
    
    let filename = source_path.file_name().ok_or("Invalid filename")?;
    let models_dir = get_models_dir(&app);
    let dest_path = models_dir.join(filename);
    
    if source_path != dest_path {
        tokio::fs::copy(source_path, &dest_path).await.map_err(|e| format!("Failed to import model: {}", e))?;
    }
    
    Ok(filename.to_string_lossy().to_string())
}

static CANCEL_DOWNLOAD: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
async fn cancel_download() -> Result<(), AppError> {
    CANCEL_DOWNLOAD.store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
async fn download_model(app: tauri::AppHandle, model_id: String) -> Result<(), AppError> {
    use futures::StreamExt;
    use tokio::io::AsyncWriteExt;

    let registry = get_model_registry();
    let entry = registry.iter().find(|(id, _, _, _, _, _)| *id == model_id.as_str())
        .ok_or_else(|| format!("Unknown model id: {}", model_id))?;
    
    let (_, name, filename, url, _, _) = entry;
    let models_dir = get_models_dir(&app);
    let dest_path = models_dir.join(filename);
    let tmp_path = models_dir.join(format!("{}.tmp", filename));
    
    // Check if already exists completely
    if tokio::fs::try_exists(&dest_path).await.unwrap_or(false) {
        app.emit("transcription-log", format!("✅ {} is already downloaded at {}", name, dest_path.display())).unwrap_or(());
        return Ok(());
    }
    
    // Reset cancel flag before starting
    CANCEL_DOWNLOAD.store(false, std::sync::atomic::Ordering::Relaxed);

    app.emit("transcription-log", format!("[DOWNLOAD] {} ({})", name, filename)).unwrap_or(());
    app.emit("transcription-log", format!("[DOWNLOAD] Saving to: {}", dest_path.display())).unwrap_or(());
    app.emit("transcription-log", "[DOWNLOAD] Starting native secure download...".to_string()).unwrap_or(());
    
    let response = reqwest::get(*url)
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()).into());
    }

    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_log_time = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        if CANCEL_DOWNLOAD.load(std::sync::atomic::Ordering::Relaxed) {
            // Cancelled!
            let _ = file.flush().await;
            drop(file);
            let _ = tokio::fs::remove_file(&tmp_path).await;
            app.emit("transcription-log", "[DOWNLOAD] ❌ Download cancelled by user.".to_string()).unwrap_or(());
            return Err("Download cancelled by user.".into());
        }

        let data = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&data).await.map_err(|e| format!("Write error: {}", e))?;
        
        downloaded += data.len() as u64;
        
        // Log progress every 2 seconds
        if last_log_time.elapsed().as_secs() >= 2 {
            let mb = downloaded as f64 / 1_048_576.0;
            app.emit("transcription-log", format!("[DOWNLOAD] {:.0} MB downloaded...", mb)).unwrap_or(());
            last_log_time = std::time::Instant::now();
        }
    }

    // Flush and close file
    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);

    // Rename tmp to final
    tokio::fs::rename(&tmp_path, &dest_path).await.map_err(|e| format!("Failed to finalize download: {}", e))?;

    let size_mb = downloaded as f64 / 1_048_576.0;
    app.emit("transcription-log", format!("✅ Downloaded {} ({:.0} MB)", filename, size_mb)).unwrap_or(());
    
    Ok(())
}

#[tauri::command]
async fn delete_model(app: tauri::AppHandle, model_id: String) -> Result<(), AppError> {
    let registry = get_model_registry();
    let entry = registry.iter().find(|(id, _, _, _, _, _)| *id == model_id.as_str())
        .ok_or_else(|| format!("Unknown model id: {}", model_id))?;
    
    let (_, name, filename, _, _, _) = entry;
    let models_dir = get_models_dir(&app);
    let dest_path = models_dir.join(filename);
    
    if tokio::fs::try_exists(&dest_path).await.unwrap_or(false) {
        tokio::fs::remove_file(&dest_path).await.map_err(|e| format!("Failed to delete file: {}", e))?;
        app.emit("transcription-log", format!("🗑️ Deleted model: {}", name)).unwrap_or(());
    }
    
    Ok(())
}

#[tauri::command]
async fn run_transcription(
    app: tauri::AppHandle, 
    file_path: String, 
    compute_method: String, 
    model_id: String, 
    language: String,
    cpu_auto_tune: bool,
    cpu_workers: usize,
    cpu_threads: usize
) -> Result<TranscriptionResult, AppError> {
    let start_total = Instant::now();
    
    let temp_dir_name = format!("kalakar_indic_chunks_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_micros());
    let temp_dir = std::env::temp_dir().join(temp_dir_name);
    let _ = tokio::fs::create_dir_all(&temp_dir).await;

    // RAII guard to guarantee cleanup of temp chunks on error/panic
    let _temp_guard = TempDirGuard { path: temp_dir.clone() };

    let model_path = resolve_model_path(&app, &model_id)
        .ok_or_else(|| AppError::from(format!("Unknown or missing model file for id: {}", model_id)))?;

    let model_path_str = model_path.to_string_lossy().to_string();
    app.emit("transcription-log", format!("   Using model: {}", model_path.display())).unwrap_or(());

    // Initial logs matching the Python output format
    app.emit("transcription-log", "============================================================".to_string()).unwrap_or(());
    let lang_display = if model_id == "pa" { "Punjabi" } else if model_id == "pt" { "Portuguese" } else if model_id.contains("tdt") || model_id.contains("rnnt") || model_id == "eu-fast" { "Global/European" } else { "Hindi/Hinglish" };
    app.emit("transcription-log", format!("IndicConformer C++ GGUF - {} ASR with GGML", lang_display)).unwrap_or(());
    app.emit("transcription-log", "============================================================".to_string()).unwrap_or(());
    
    app.emit("transcription-log", "\n[1/5] Loading media using FFmpeg...".to_string()).unwrap_or(());
    let start_preprocess = Instant::now();
    
    let chunk_secs = 30;
    let (chunk_files, audio_duration) = match preprocess_media(&app, &file_path, &temp_dir, chunk_secs).await {
        Ok(res) => res,
        Err(e) => {
            // cleanup handled by guard
            app.emit("transcription-log", format!("[ERROR] Media Preprocessing failed: {}", e)).unwrap_or(());
            return Err(e.into());
        }
    };
    
    app.emit("transcription-log", format!("   Duration: {:.2}s", audio_duration)).unwrap_or(());
    
    let preprocess_time = start_preprocess.elapsed().as_secs_f32();
    app.emit("transcription-log", format!("   Preprocessing time: {:.3}s", preprocess_time)).unwrap_or(());
    
    let (actual_workers, actual_threads) = if compute_method == "cpu" {
        let workers;
        let threads;
        if cpu_auto_tune {
            let mut sys = System::new_all();
            sys.refresh_all();
            let physical_cores = sys.physical_core_count().unwrap_or(4);
            let total_ram_gb = sys.total_memory() / 1_073_741_824;
            
            workers = std::cmp::max(1, physical_cores / 2);
            let max_workers_by_ram = std::cmp::max(1, (total_ram_gb as usize).saturating_sub(4));
            let workers = std::cmp::min(workers, max_workers_by_ram);
            threads = std::cmp::max(1, physical_cores / workers);
            
            (workers, threads)
        } else {
            (cpu_workers, cpu_threads)
        }
    } else {
        (1, 4)
    };

    if compute_method == "cpu" {
        app.emit("transcription-log", format!("   [CPU Tuning] Parallel Workers: {}, Threads per Worker: {}", actual_workers, actual_threads)).unwrap_or(());
    }

    let num_chunks = chunk_files.len();
    app.emit("transcription-log", format!("[3/5] Running C++ GGUF inference ({} chunks with {}s step)...", num_chunks, chunk_secs)).unwrap_or(());
    
    let start_inference = Instant::now();
    app.emit("transcription-log", format!("   Spawning {} parallel inference session(s)...", actual_workers)).unwrap_or(());

    let sidecar_name = if compute_method.contains("vulkan") { "parakeet-cli-vulkan" } else { "parakeet-cli" };
    let decoder_type = if model_path_str.to_lowercase().contains("tdt") { "tdt" } else { "ctc" };
    let lang_flag = if language != "auto" { language.clone() } else if model_id == "pa" { "pa".to_string() } else if model_id == "pt" { "pt".to_string() } else if model_id.contains("tdt") || model_id.contains("rnnt") || model_id == "eu-fast" { "en".to_string() } else { "hi".to_string() };

    ABORT_INFERENCE.store(false, Ordering::SeqCst);
    let mut handles = Vec::new();

    for worker_id in 0..actual_workers {
        let app_clone = app.clone();
        let compute_method_clone = compute_method.clone();
        let model_path_str_clone = model_path_str.clone();
        let decoder_type_clone = decoder_type.to_string();
        let lang_flag_clone = lang_flag.clone();
        let sidecar_name_clone = sidecar_name.to_string();
        let actual_threads_clone = actual_threads;
        
        let worker_chunks: Vec<_> = chunk_files.iter().enumerate()
            .filter(|(i, _)| i % actual_workers == worker_id)
            .map(|(i, c)| (i, c.clone()))
            .collect();
            
        if worker_chunks.is_empty() { continue; }
        let num_worker_chunks = worker_chunks.len();
        
        let handle = tokio::spawn(async move {
            let mut command = match app_clone.shell().sidecar(&sidecar_name_clone) {
                Ok(c) => c,
                Err(e) => return Err(e.to_string())
            };

            if let Ok(resource_dir) = app_clone.path().resource_dir() {
                let bin_resources = resource_dir.join("bin");
                if bin_resources.exists() {
                    if let Ok(current_path) = std::env::var("PATH") {
                        let new_path = format!("{};{}", bin_resources.to_string_lossy(), current_path);
                        command = command.env("PATH", new_path);
                    }
                }
            }

            if compute_method_clone == "cpu" {
                command = command.env("PARAKEET_DEVICE", "cpu");
            } else if compute_method_clone == "vulkan-nvidia" {
                command = command.env("PARAKEET_DEVICE", "vulkan");
            } else if compute_method_clone == "vulkan-intel" {
                command = command.env("PARAKEET_DEVICE", "intel");
            }
            let mut command = command.args([
                "transcribe",
                "--model", &model_path_str_clone,
                "--decoder", &decoder_type_clone,
                "--lang", &lang_flag_clone,
                "--pipe"
            ]);

            if compute_method_clone == "cpu" {
                let thread_str = actual_threads_clone.to_string();
                command = command.args(["--threads", &thread_str]);
            }

            let (mut rx, mut child) = match command.spawn() {
                Ok(res) => res,
                Err(e) => return Err(format!("Failed to spawn worker {}: {}", worker_id, e))
            };

            let mut server_ready = false;
            while let Some(event) = rx.recv().await {
                if let tauri_plugin_shell::process::CommandEvent::Stdout(bytes) = event {
                    if String::from_utf8_lossy(&bytes).contains("[SERVER_READY]") {
                        server_ready = true;
                        break;
                    }
                }
            }

            if !server_ready {
                return Err(format!("Worker {} failed to initialize", worker_id));
            }
            
            app_clone.emit("transcription-log", format!("   Worker {} ready. Processing {} chunks...", worker_id, num_worker_chunks)).unwrap_or(());

            let mut worker_results = Vec::new();
            let mut stdout_accumulator = String::new();

            for (global_index, (chunk_path, start_time, end_time)) in worker_chunks {
                if ABORT_INFERENCE.load(Ordering::SeqCst) {
                    let _ = child.write(b"EXIT\n");
                    return Err("Transcription cancelled".to_string());
                }

                if let Err(e) = child.write(format!("{}\n", chunk_path).as_bytes()) {
                    return Err(format!("Worker {} failed to write chunk: {}", worker_id, e));
                }

                let mut chunk_json_str = None;
                while let Some(event) = rx.recv().await {
                    if let tauri_plugin_shell::process::CommandEvent::Stdout(bytes) = event {
                        stdout_accumulator.push_str(&String::from_utf8_lossy(&bytes));
                        let mut found_end = false;
                        while let Some(pos) = stdout_accumulator.find('\n') {
                            let line = stdout_accumulator[..pos].trim().to_string();
                            stdout_accumulator.drain(..=pos);
                            
                            if line.contains("[END_TRANSCRIPTION]") {
                                found_end = true;
                                break;
                            }
                            if line.starts_with('{') {
                                chunk_json_str = Some(line);
                            }
                        }
                        if found_end { break; }
                    }
                }

                let chunk_data: ChunkJson = if let Some(ref j_str) = chunk_json_str {
                    if j_str.contains("\"error\":") {
                        let _ = child.write(b"EXIT\n");
                        return Err(format!("Model crashed on worker {}: {}", worker_id, j_str));
                    }
                    match serde_json::from_str(j_str) {
                        Ok(data) => data,
                        Err(e) => {
                            let _ = child.write(b"EXIT\n");
                            return Err(format!("JSON parse failed on worker {}: {}", worker_id, e));
                        }
                    }
                } else {
                    let _ = child.write(b"EXIT\n");
                    return Err(format!("No JSON output on worker {}", worker_id));
                };

                app_clone.emit("transcription-log", format!("   [Worker {}] Chunk {} done ({:.1}s - {:.1}s): {}", worker_id, global_index + 1, start_time, end_time, chunk_data.text)).unwrap_or(());
                
                let mut adjusted_words = Vec::new();
                for mut w in chunk_data.words {
                    w.start += start_time;
                    w.end += start_time;
                    adjusted_words.push(w);
                }
                
                worker_results.push((global_index, chunk_data.text, adjusted_words));
            }
            
            let _ = child.write(b"EXIT\n");
            Ok::<Vec<(usize, String, Vec<WordInfo>)>, String>(worker_results)
        });
        handles.push(handle);
    }
    
    let mut all_results = Vec::new();
    for res in futures::future::join_all(handles).await {
        match res {
            Ok(Ok(worker_res)) => all_results.extend(worker_res),
            Ok(Err(e)) => {
                app.emit("transcription-log", format!("[ERROR] {}", e)).unwrap_or(());
                return Err(e.into());
            }
            Err(e) => {
                let err_msg = format!("Task failed: {}", e);
                app.emit("transcription-log", format!("[ERROR] {}", err_msg)).unwrap_or(());
                return Err(err_msg.into());
            }
        }
    }
    
    all_results.sort_by_key(|r| r.0);
    
    let mut all_transcripts = Vec::new();
    let mut all_words = Vec::new();
    for (_, text, words) in all_results {
        all_transcripts.push(text);
        all_words.extend(words);
    }
    
    let inference_time = start_inference.elapsed().as_secs_f32();
    app.emit("transcription-log", format!("   Total inference time: {:.3}s", inference_time)).unwrap_or(());
    
    app.emit("transcription-log", "[4/5] Combining chunks...".to_string()).unwrap_or(());
    let start_decode = Instant::now();
    
    // Construct deduplicated transcript from the cropped words list, or fallback to joined chunks if words are empty
    let transcript = if !all_words.is_empty() {
        // Sort words by start time just to guarantee chronological order
        all_words.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap_or(std::cmp::Ordering::Equal));
        all_words.iter()
            .map(|w| w.w.as_str())
            .collect::<Vec<&str>>()
            .join(" ")
    } else {
        all_transcripts.join(" ")
    };
    
    let decode_time = start_decode.elapsed().as_secs_f32();
    app.emit("transcription-log", format!("   Combined transcript length: {} characters", transcript.len())).unwrap_or(());
    
    app.emit("transcription-log", "\n============================================================".to_string()).unwrap_or(());
    app.emit("transcription-log", "[5/5] TRANSCRIPTION RESULT:".to_string()).unwrap_or(());
    app.emit("transcription-log", "============================================================".to_string()).unwrap_or(());
    app.emit("transcription-log", transcript.clone()).unwrap_or(());
    
    app.emit("transcription-log", "\n============================================================".to_string()).unwrap_or(());
    app.emit("transcription-log", "PERFORMANCE SUMMARY:".to_string()).unwrap_or(());
    app.emit("transcription-log", "============================================================".to_string()).unwrap_or(());
    
    let total_time = start_total.elapsed().as_secs_f32();
    let rtf = total_time / audio_duration;
    
    app.emit("transcription-log", format!("Audio duration:     {:.2}s", audio_duration)).unwrap_or(());
    app.emit("transcription-log", format!("Preprocessing:      {:.3}s", preprocess_time)).unwrap_or(());
    app.emit("transcription-log", format!("Inference:          {:.3}s (C++ / GGUF)", inference_time)).unwrap_or(());
    app.emit("transcription-log", format!("Decoding:           {:.3}s", decode_time)).unwrap_or(());
    app.emit("transcription-log", format!("Total:              {:.3}s", total_time)).unwrap_or(());
    app.emit("transcription-log", format!("Real-Time Factor:   {:.3}x", rtf)).unwrap_or(());
    app.emit("transcription-log", format!("Speed:              {:.1}x faster than real-time", 1.0 / rtf)).unwrap_or(());

    // Clean up temporary chunks folder
    let _ = fs::remove_dir_all(&temp_dir);
    
    Ok(TranscriptionResult {
        text: transcript,
        words: all_words,
        audio_duration,
        total_time,
        rtf,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_transcription, check_models, download_model, cancel_download, delete_model, abort_transcription, import_custom_model])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
