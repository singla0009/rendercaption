<div align="center">

  # Capit 🎙️
  ### High-Performance, Privacy-First Local Audio Transcription

  [![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=for-the-badge&logo=tauri&logoColor=FFFFFF)](https://tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![Vulkan](https://img.shields.io/badge/Vulkan-Accelerated-C41E3A?style=for-the-badge&logo=vulkan&logoColor=white)](https://www.vulkan.org/)

  <p align="center">
    Capit is a highly optimized native desktop application that utilizes massive local Large Language Models (LLMs) and advanced Speech-to-Text architectures to transcribe complex multilingual audio <b>entirely on your own hardware.</b>
  </p>

  **No cloud APIs • No subscriptions • Absolute privacy**

</div>

---

## ⚡ Why Capit?

Cloud transcription services are expensive and compromise your data privacy. Capit solves this by bringing state-of-the-art AI directly to your desktop.

- **Universal Hardware Acceleration:** Capit intelligently routes compute loads. It ships with a pure **AVX2 CPU fallback** for low-end business machines, and a **Vulkan GPU Engine** for extreme hardware-accelerated processing across NVIDIA CUDA, AMD, and Intel Integrated Graphics.
- **Glassmorphism UI:** A stunning, highly responsive React frontend featuring dynamic playback timelines, low-confidence heatmaps, and advanced engine telemetry.
- **Advanced Exporting:** Instantly export transcriptions into standard `.TXT` or heavily formatted `.SRT` subtitle files with custom timestamp segmentations tailored for video editors.
- **Zero-Trust File System:** Your audio files never leave your computer. Everything is processed locally.

---

## 🤖 Supported Models Matrix

Capit supports a variety of quantized `.gguf` acoustic models. You can download these directly through the in-app Model Manager.

| Model ID | Architecture | Size (MB) | Best For | Languages Supported |
| :--- | :--- | :--- | :--- | :--- |
| `hi` | IndicConformer | ~140 MB | Fast, everyday Indian dialects | Hindi, Hinglish, English |
| `pa` | IndicConformer | ~140 MB | Punjabi audio | Punjabi, English |
| `eu-fast`| Whisper Base | ~150 MB | Rapid European translations | English, Spanish, French, German |
| `rnnt` | RNN-T Large | ~800 MB | High-accuracy long-form dictation | Global / Multilingual |

> *Note: Model sizes reflect 4-bit and 8-bit quantized `GGUF` formats optimized for low VRAM consumption.*

---

## 📊 Performance Benchmarks

To ensure you have realistic expectations, Capit scales directly with your hardware. We test our benchmarks on standard consumer devices using the **IndicConformer (140MB)** model. 

*If you are running Capit on an older laptop without a dedicated GPU, it will safely fall back to pure CPU computation. It will be slower, but it will successfully transcribe.*

| Hardware Profile | Compute Engine | 10-Minute Audio | 60-Minute Audio |
| :--- | :--- | :--- | :--- |
| **High-End Desktop** (NVIDIA RTX 5070 Ti) | Vulkan GPU | **~35 seconds** | **~3.5 minutes** |
| **Mid-Range Laptop** (Intel UHD / ARC) | Vulkan GPU | **~1.5 minutes** | **~8 minutes** |
| **Modern Laptop** (Intel Core i7 / 16GB) | AVX2 CPU | **~3.5 minutes** | **~22 minutes** |
| **Low-End PC** (Older Intel i3 / 8GB) | AVX2 CPU | **~8 minutes** | **~45 minutes** |

> **💡 Low-End Device Tip:** If your transcription is running slowly on an older CPU, click the "Settings" gear in Capit and decrease the **CPU Threads** slider to 2 or 4 to prevent your computer from freezing while it processes.

---

## 🚀 Download & Install

You can download the pre-compiled, ready-to-use Windows installers directly from the official releases.

1. Navigate to the [Releases Tab](../../releases/latest).
2. Download `Capit_0.1.0_x64-setup.exe` (or the `.msi` file).
3. Run the installer.
4. Open the app, drop your audio file into the interface, select your downloaded model, and click **Transcribe!**

---

## 💻 Building from Source (Developers)

If you wish to fork and modify Capit, follow these steps to build the Tauri architecture from scratch.

### Prerequisites
- **Node.js** (v18+)
- **Rust & Cargo** (Latest stable toolchain)
- **Tauri v2 CLI**

### Setup Environment
```bash
# 1. Clone the repository
git clone https://github.com/singla0009/capit.git
cd capit

# 2. Install Node dependencies
npm install

# 3. Start the hot-reloading Dev Server
npm run tauri dev
```

### Managing Acoustic Models Locally
If you are running the development server, the application will intelligently scan for a `models/` directory next to the compiled executable. 

> ⚠️ **Git Warning:** Do NOT commit your local `.gguf` files or the `models/` directory back to GitHub. They easily exceed GitHub's 100MB file limit. The `.gitignore` is pre-configured to ignore them securely.

---

## 🧠 Deep Architecture Notes

Capit is built with an uncompromising focus on concurrency and performance:
- **Asynchronous File I/O:** The Rust backend uses `tokio::fs` and multi-threaded OS spawning to completely bypass blocking the IPC bridge during massive 2GB file I/O operations.
- **Memoized DOM Rendering:** The React frontend uses aggressive `React.memo` and `useCallback` optimizations to prevent "render thrashing". This guarantees zero lag when scrubbing through thousands of transcribed timeline words during video playback.
- **Sandboxed Security:** File system access is tightly scoped in `tauri.conf.json` using the Principle of Least Privilege, preventing directory traversal vulnerabilities.

---

## 📄 License
This project is officially licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete details. You are free to fork, modify, and distribute this software.
