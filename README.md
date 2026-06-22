<div align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=for-the-badge&logo=tauri&logoColor=FFFFFF" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Vulkan-Accelerated-C41E3A?style=for-the-badge&logo=vulkan&logoColor=white" alt="Vulkan">
  
  <br />
  <br />

  <h1>Capit 🎙️</h1>
  <p><b>High-Performance, Privacy-First Local Audio Transcription Desktop App</b></p>
  
  <p>
    Capit is a deeply optimized native desktop application that utilizes massive local Large Language Models (LLMs) and advanced Speech-to-Text architectures to transcribe complex multilingual audio entirely on your own hardware.
  </p>
  
  <strong>No cloud APIs. No subscriptions. Absolute privacy.</strong>
</div>

<br />

## ✨ Core Features
- **🚀 Universal Hardware Acceleration:** Capit ships with two distinct engines. A pure **AVX2 CPU fallback** for low-end business machines, and a **Vulkan GPU Engine** for extreme hardware-accelerated processing across NVIDIA CUDA, AMD, and Intel Integrated Graphics.
- **🌍 Multilingual Heavyweight:** Optimized out-of-the-box for complex Indic languages (Hindi, Hinglish, Punjabi) and global dialects via state-of-the-art GGUF models like IndicConformer.
- **🎨 Glassmorphism UI:** A stunning, highly responsive React/Tailwind frontend featuring dynamic playback timelines, low-confidence heatmaps, and advanced engine telemetry.
- **💾 Advanced Exporting:** Instantly export transcriptions into standard `.TXT` or heavily formatted `.SRT` subtitle files with custom timestamp segmentations tailored for video editors.
- **🔒 Local Everything:** Uses Tauri v2 and Rust to directly manage memory and disk operations. Your audio files never leave your computer.

---

## 🚀 Installation & Usage

You can download the pre-compiled, ready-to-use Windows installers directly from the [Releases Tab](../../releases).

1. Download `Capit_0.1.0_x64-setup.exe` or the `.msi` file.
2. Run the installer.
3. Drop your audio/video file into the app, select a GGUF model, and click Transcribe!

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

### Managing Acoustic Models
By default, the application will intelligently scan for a `models/` directory next to the compiled executable. You can download compatible `.gguf` acoustic models directly through the app's Model Manager UI.

> ⚠️ **Note:** Do NOT commit your local `.gguf` files or the `models/` directory back to GitHub. They easily exceed GitHub's 100MB file limit. The `.gitignore` is pre-configured to ignore them securely.

---

## 🧠 Deep Architecture Notes
Capit is built with an uncompromising focus on concurrency and zero-trust memory management. 
- The Rust backend uses `tokio::fs` and multi-threaded OS spawning to completely bypass blocking the IPC bridge during massive 2GB file I/O operations.
- The React frontend uses aggressive `React.memo` and `useCallback` optimizations to prevent "render thrashing". This guarantees zero lag when scrubbing through thousands of transcribed timeline words during video playback.
- File system access is tightly scoped in `tauri.conf.json` using the Principle of Least Privilege.

## 📄 License
This project is officially licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete details. You are free to fork, modify, and distribute this software.
