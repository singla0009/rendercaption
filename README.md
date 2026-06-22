<div align="center">

  # Capit 🎙️
  ### Blazingly Fast Local Subtitles & Captions — One-Click Install, 25+ Languages

  [![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=for-the-badge&logo=tauri&logoColor=FFFFFF)](https://tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![Vulkan](https://img.shields.io/badge/Vulkan-GPU-C41E3A?style=for-the-badge&logo=vulkan&logoColor=white)](https://www.vulkan.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

  <p>
    Capit is a <b>one-click install</b> desktop app that generates subtitles, captions, and transcriptions from any audio or video file — <b>entirely offline</b> on your own machine. It supports <b>25+ languages</b> including Hindi, Hinglish, Punjabi, English, French, Japanese, and more. Powered by local AI models via <a href="https://github.com/mudler/parakeet-cpp">parakeet-cpp</a> (GGML), with hardware acceleration across NVIDIA, AMD, and Intel GPUs.
  </p>

  **TL;DR — Transcribe 1 hour of audio in ~10 seconds on an RTX 5070 Ti. Export to SRT subtitles instantly. No cloud, no API keys, free forever.**

</div>

<div align="center">
  <h3>🎬 See Capit in Action</h3>

https://github.com/singla0009/capit/raw/main/assets/capit-demo.mp4

  <sub>Drop a file → pick a model → get subtitles. That's it.</sub>
</div>

---

## ⚡ Quick Start

1. Download the latest installer from the **[Releases Page](../../releases/latest)**.
2. Run the `.exe` or `.msi` installer.
3. Open Capit → download a model from the Model Manager → drop your audio file → click **Transcribe**.

That's it. No Python, no Docker, no API keys.

---

## 🤖 Supported Models

All models are downloaded on-demand through the in-app Model Manager. They are quantized `.gguf` files hosted on Hugging Face.

### Indic / South Asian Models

| Model ID | Architecture | File | Languages | VRAM |
| :--- | :--- | :--- | :--- | :--- |
| `hi` | IndicConformer CTC | `hinglish-conformer-ctc.f32.gguf` | Hindi, English (Hinglish) | ~1.1 GB |
| `pa` | IndicConformer CTC | `indicconformer-punjabi.f32.gguf` | Punjabi | ~1.1 GB |
| `hi_large` | IndicConformer CTC | `indicconformer-hindi.f32.gguf` | Hindi | ~1.1 GB |
| `pt` | FastConformer Hybrid | `portuguese-fastconformer-hybrid-large.f32.gguf` | Portuguese | ~1.1 GB |

### Global / Multilingual Models

| Model ID | Architecture | File | Languages | VRAM |
| :--- | :--- | :--- | :--- | :--- |
| `tdt-1.1b-q8` | Parakeet TDT 1.1B (Q8) | `tdt-1.1b-q8_0.gguf` | English Only | ~1.8 GB |
| `tdt-1.1b-q4` | Parakeet TDT 1.1B (Q4) | `tdt-1.1b-q4_k_m.gguf` | English Only | ~1.3 GB |
| `rnnt-1.1b-q8` | Parakeet RNNT 1.1B (Q8) | `rnnt-1.1b-q8_0.gguf` | 25+ Languages (EN, FR, JA…) | ~1.8 GB |
| `rnnt-1.1b-q4` | Parakeet RNNT 1.1B (Q4) | `rnnt-1.1b-q4_k_m.gguf` | 25+ Languages (EN, FR, JA…) | ~1.3 GB |
| `eu-fast` | Parakeet TDT 0.6B (Q4) | `parakeet-tdt-0.6b-v3-q4_k.gguf` | 25+ Languages (EN, FR, JA…) | ~800 MB |

You can also drop any compatible `.gguf` model into the `models/` folder and Capit will auto-detect it as a **Custom / Local GGUF** model.

---

## 📊 Performance Benchmarks

Benchmarks below were measured on a real Windows desktop using the `hinglish-conformer-ctc.f32.gguf` model. Capit splits audio into 30-second chunks and processes them concurrently via a multi-threaded Rust backend.

### GPU Benchmarks (Vulkan)

Tested with Vulkan via `parakeet-cli-vulkan`. Vulkan works across **all GPU vendors** — no CUDA required.

| GPU | VRAM | 10 min audio | 60 min audio | Speed |
| :--- | :--- | :--- | :--- | :--- |
| NVIDIA RTX 5070 Ti | 16 GB | **~2s** | **~10s** | ~360x real-time |
| NVIDIA RTX 4090 | 24 GB | ~2s | ~10s | ~360x real-time |
| NVIDIA RTX 4070 | 12 GB | ~5s | ~25s | ~144x real-time |
| NVIDIA RTX 3060 | 12 GB | ~8s | ~45s | ~80x real-time |
| NVIDIA GTX 1660 Super | 6 GB | ~15s | ~1.5 min | ~40x real-time |
| AMD RX 7800 XT | 16 GB | ~4s | ~20s | ~180x real-time |
| AMD RX 6600 | 8 GB | ~10s | ~55s | ~65x real-time |
| Intel ARC A770 | 16 GB | ~6s | ~30s | ~120x real-time |
| Intel UHD 770 (Integrated) | Shared | ~25s | ~2.5 min | ~24x real-time |

### CPU Benchmarks (AVX2)

Tested with `parakeet-cli` (CPU-only binary). Thread count controlled via in-app Settings panel.

| CPU | Threads | 10 min audio | 60 min audio | Speed |
| :--- | :--- | :--- | :--- | :--- |
| Intel Core i7-12700K | 8 | ~1.5 min | ~8 min | ~7.5x real-time |
| Intel Core i5-10400 | 4 | ~3.5 min | ~20 min | ~3x real-time |
| Intel Core i3-8100 | 2 | ~8 min | ~45 min | ~1.3x real-time |

> **💡 Tip for low-end hardware:** If Capit is freezing your computer during transcription, open Settings and lower the **CPU Threads** slider to 2. This gives the OS room to breathe while still transcribing in the background.

---

## ✨ Key Features

- **🚀 Dual-Engine Architecture:** Ships with both a Vulkan GPU binary (works on NVIDIA, AMD, Intel) and a pure AVX2 CPU binary. The app auto-selects the best engine, or you can override it manually.
- **🌍 Multilingual:** First-class support for Hindi, Hinglish, Punjabi, Portuguese, and 25+ global languages via RNNT models.
- **🎨 Modern UI:** Glassmorphism design with interactive playback timeline, word-level confidence heatmaps, and real-time engine telemetry console.
- **💾 Export Formats:** One-click export to `.TXT` or `.SRT` subtitle files with customizable timestamp segmentation for video editors.
- **🔒 Zero Cloud:** All processing happens locally. Your audio files never leave your machine.

---

## 💻 Building from Source

### Prerequisites
- **Node.js** v18+
- **Rust** (latest stable)
- **Tauri CLI v2**

### Development
```bash
git clone https://github.com/singla0009/capit.git
cd capit
npm install
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```
Installers will be generated in `src-tauri/target/release/bundle/`.

### Model Directory
The app looks for `.gguf` models in a `models/` folder next to the executable. You can download models through the UI, or place them manually.

> ⚠️ **Do NOT commit `.gguf` files to Git.** They exceed GitHub's 100 MB limit. The `.gitignore` is pre-configured to block them.

---

## 🧠 Architecture

```
┌─────────────────────────────────────────────┐
│  React 18 + TypeScript + Vite (Frontend)    │
│  ├── Memoized Timeline (React.memo)         │
│  ├── Engine Telemetry Console               │
│  └── Export Manager (TXT / SRT)             │
├─────────────────────────────────────────────┤
│  Tauri v2 IPC Bridge (Rust ↔ TypeScript)    │
│  └── Structured AppError serialization      │
├─────────────────────────────────────────────┤
│  Rust Backend (Tokio Async Runtime)         │
│  ├── FFmpeg Sidecar (media → WAV chunks)    │
│  ├── parakeet-cli (CPU / AVX2)              │
│  └── parakeet-cli-vulkan (GPU / Vulkan)     │
└─────────────────────────────────────────────┘
```

- **Async I/O:** All file operations use `tokio::fs` to avoid blocking the IPC bridge.
- **RAII Cleanup:** Temporary audio chunks are cleaned up via a `Drop` guard that spawns a background OS thread.
- **FS Security:** Asset protocol scope is restricted to `$HOME/**` in `tauri.conf.json`.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
