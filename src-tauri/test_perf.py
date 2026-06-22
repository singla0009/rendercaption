import subprocess
import json
import time

commands = [
    ("Low-End PC (CPU - 2 Threads)", 'set PARAKEET_DEVICE=cpu && bin\\parakeet-cli-x86_64-pc-windows-msvc.exe transcribe --model D:\\Gemma_audio\\models\\hinglish-conformer-ctc.f32.gguf --input D:\\Gemma_audio\\test_audio.wav --threads 2 --json'),
    ("Mid-End PC (CPU - 4 Threads)", 'set PARAKEET_DEVICE=cpu && bin\\parakeet-cli-x86_64-pc-windows-msvc.exe transcribe --model D:\\Gemma_audio\\models\\hinglish-conformer-ctc.f32.gguf --input D:\\Gemma_audio\\test_audio.wav --threads 4 --json'),
    ("High-End PC (CPU - 8 Threads)", 'set PARAKEET_DEVICE=cpu && bin\\parakeet-cli-x86_64-pc-windows-msvc.exe transcribe --model D:\\Gemma_audio\\models\\hinglish-conformer-ctc.f32.gguf --input D:\\Gemma_audio\\test_audio.wav --threads 8 --json'),
    ("Mid-End GPU (Vulkan - Intel UHD)", 'set PARAKEET_DEVICE=intel && bin\\parakeet-cli-vulkan-x86_64-pc-windows-msvc.exe transcribe --model D:\\Gemma_audio\\models\\hinglish-conformer-ctc.f32.gguf --input D:\\Gemma_audio\\test_audio.wav --json'),
    ("High-End GPU (CUDA - RTX 5070 Ti)", 'set PARAKEET_DEVICE=cuda && bin\\parakeet-cli-x86_64-pc-windows-msvc.exe transcribe --model D:\\Gemma_audio\\models\\hinglish-conformer-ctc.f32.gguf --input D:\\Gemma_audio\\test_audio.wav --json')
]

print("Starting Hardware Profiling Tests (Audio duration: 5.2s)...")
for name, cmd in commands:
    print(f"\\nRunning: {name}...")
    start = time.time()
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, encoding='utf-8', errors='ignore', cwd=r"D:\\Gemma_audio\\Rust_Indic\\src-tauri")
        lines = res.stdout.strip().split('\\n')
        json_line = next((line for line in lines if line.startswith('{')), None)
        if json_line:
            data = json.loads(json_line)
            rtf = data.get('rtf', 0)
            total_time = data.get('total_time', 0)
            print(f"  -> Time taken: {total_time:.2f}s | RTF: {rtf:.3f}")
            print(f"  -> Speed: {1/rtf:.1f}x real-time")
        else:
            print(f"  -> Error: Could not find JSON output. Output was:\\n{res.stdout}\\n{res.stderr}")
    except Exception as e:
        print(f"  -> Exception: {e}")
