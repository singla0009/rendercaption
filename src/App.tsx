import { useState, useEffect, useRef, useCallback } from "react";

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

import { TranscriptionResult, getSegments } from "./utils/exportFormatters";
import { appLog, clearLogs } from "./utils/logger";
import TelemetryConsole from "./components/TelemetryConsole";
import ModelManager from "./components/ModelManager";
import EngineSettingsPanel from "./components/EngineSettingsPanel";
import TimelineSegment from "./components/TimelineSegment";
import ExportManager from "./components/ExportManager";

interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  exists: boolean;
  path: string;
  size_mb: number;
  url: string;
  languages: string;
}

interface ModelStatus {
  models: ModelInfo[];
  models_dir: string;
}

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLVideoElement | null>(null);

  const [computeMethod, setComputeMethod] = useState<string>("cuda");
  const [selectedModelId, setSelectedModelId] = useState("hi");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "timeline" | "export">("timeline");

  
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [showCpuSettings, setShowCpuSettings] = useState(false);
  const [useParallel, setUseParallel] = useState(true);
  const [cpuAutoTune, setCpuAutoTune] = useState(true);
  const [cpuWorkers, setCpuWorkers] = useState(2);
  const [cpuThreads, setCpuThreads] = useState(2);

  const refreshModels = async () => {
    try {
      const status = await invoke<ModelStatus>("check_models");
      setModelStatus(status);
    } catch (e: any) {
      console.error("Model check failed:", e.message || String(e));
    }
  };

  useEffect(() => {
    refreshModels();
  }, []);

  const loadMedia = async (path: string) => {
    try {
      appLog("[SYSTEM] Mounting media asset into player...");
      const url = convertFileSrc(path);
      setAudioUrl(url);
      appLog("✅ Media asset mounted safely.");
    } catch (e: any) {
      appLog(`[ERROR] Media mount failed: ${e.message || String(e)}`);
    }
  };

  const selectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Media", extensions: ["wav", "flac", "mp3", "m4a", "ogg", "mp4", "mkv", "avi", "mov", "webm"] }],
    });
    if (selected && typeof selected === "string") {
      setFilePath(selected);
      clearLogs();
      setTranscriptionResult(null);
      setAudioUrl(null);
      setCurrentTime(0);
      await loadMedia(selected);
    }
  };

  const selectCustomModel = async (oldId: string) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Model", extensions: ["gguf"] }],
    });
    if (selected && typeof selected === "string") {
      try {
        appLog(`[IMPORT] Copying custom model to RenderCaption directory...`);
        const filename = await invoke<string>("import_custom_model", { filePath: selected });
        appLog(`[IMPORT] Successfully imported ${filename}!`);
        await refreshModels();
        setTimeout(() => {
          setSelectedModelId(filename);
        }, 100);
      } catch (e: any) {
        appLog(`[ERROR] Failed to import model: ${e.message || String(e)}`);
        setSelectedModelId(oldId);
      }
    } else {
      setSelectedModelId(oldId);
    }
  };

  const downloadModel = async (modelId: string) => {
    setIsDownloading(true);
    setDownloadingModelId(modelId);
    setSelectedModelId(modelId);
    clearLogs();
    try {
      await invoke("download_model", { modelId });
      await refreshModels();
    } catch (e: any) {
      appLog(`[ERROR] Download failed: ${e.message || String(e)}`);
    }
    setIsDownloading(false);
    setDownloadingModelId(null);
  };

  const cancelDownload = async () => {
    try {
      await invoke("cancel_download");
      appLog("[SYSTEM] Cancel signal sent to download engine...");
    } catch (e: any) {
      console.error(e);
    }
  };

  const deleteModel = async (modelId: string) => {
    if (!confirm("Are you sure you want to delete this model from your disk?")) return;
    try {
      await invoke("delete_model", { modelId });
      refreshModels();
    } catch (e: any) {
      appLog(`[ERROR] Failed to delete model: ${e.message || String(e)}`);
    }
  };

  const startTranscription = async () => {
    if (!filePath) return;
    setIsProcessing(true);
    setTranscriptionResult(null);

    const activeModel = modelStatus?.models.find(m => m.id === selectedModelId)?.name;

    appLog(`[INIT] ASR Engine Started | File: ${filePath.split('\\').pop()}`);
    appLog(`[CONFIG] Hardware: ${computeMethod.toUpperCase()} | Model: ${activeModel}`);
    try {
      const result = await invoke<TranscriptionResult>("run_transcription", { 
        filePath, 
        computeMethod, 
        modelId: selectedModelId,
        language: selectedLanguage,
        cpuAutoTune: useParallel ? cpuAutoTune : false,
        cpuWorkers: useParallel ? cpuWorkers : 1,
        cpuThreads: useParallel ? cpuThreads : 4
      });
      setTranscriptionResult(result);
      appLog("[SYSTEM] Inference routine completed.");
      setViewMode("timeline");
    } catch (e: any) {
      appLog(`[FATAL] Inference failed: ${e.message || String(e)}`);
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    let animationFrameId: number;
    const updateTime = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };
    animationFrameId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      audioRef.current.play().catch(() => {});
    }
  }, []);

  // Check if current selected model is available
  const currentModelLoaded = modelStatus?.models.find(m => m.id === selectedModelId)?.exists ?? false;

  // Get display name for selected model
  const selectedModelName = modelStatus?.models.find(m => m.id === selectedModelId)?.name ?? selectedModelId;

  return (
    <div className="app-wrapper">
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="app-title">RENDERCAPTION</div>
          <div style={{width: '1px', height: '16px', background: 'var(--border-dim)'}}></div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
            <select className="pro-select" value={computeMethod} onChange={(e) => setComputeMethod(e.target.value)} disabled={isProcessing}>
              <option value="cuda">GPU (NVIDIA CUDA)</option>
              <option value="vulkan-nvidia">GPU (Vulkan - AMD/NVIDIA)</option>
              <option value="vulkan-intel">GPU (Vulkan - Integrated Graphics)</option>
              <option value="cpu">CPU Only</option>
            </select>
            {computeMethod === "cpu" && (
              <button 
                className={`pro-btn ${showCpuSettings ? 'active' : ''}`} 
                onClick={() => setShowCpuSettings(!showCpuSettings)}
                style={{padding: '2px 6px'}}
                title="Advanced CPU Options"
              >
                ⚙️
              </button>
            )}
          </div>
          
          <select className="pro-select" value={selectedModelId} onChange={(e) => {
            const val = e.target.value;
            if (val === "custom") {
              const oldVal = selectedModelId;
              // Temporarily set to custom to allow React to process the change event visually
              setSelectedModelId("custom");
              setTimeout(() => selectCustomModel(oldVal), 10);
            }
            else {
              setSelectedModelId(val);
            }
          }} disabled={isProcessing || isDownloading}>
            {modelStatus?.models.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} {m.exists ? `✓ (${m.size_mb.toFixed(0)}MB)` : '⬇'}
              </option>
            ))}
            <option value="custom">Browse Custom (.gguf)...</option>
          </select>

          <select className="pro-select" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} disabled={isProcessing || isDownloading} style={{width: '120px'}}>
            <option value="auto">Auto Lang</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="pa">Punjabi</option>
            <option value="pt">Portuguese</option>
            <option value="fr">French</option>
            <option value="ja">Japanese</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
          </select>

          <div className={`status-dot ${currentModelLoaded ? '' : 'error'}`} title={currentModelLoaded ? 'Model Loaded' : 'Model Missing'}></div>
          
          <button className="pro-btn" onClick={() => setShowModelPanel(!showModelPanel)} style={{padding: '2px 8px', fontSize: '10px'}}>
            Models
          </button>
        </div>

        <div className="toolbar-right">
          <button className="pro-btn" onClick={selectFile} disabled={isProcessing || isDownloading}>Import Media</button>
          {!currentModelLoaded ? (
            isDownloading ? (
              <button className="pro-btn primary" onClick={cancelDownload} style={{backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff'}}>
                Cancel Download
              </button>
            ) : (
              <button className="pro-btn primary" onClick={() => downloadModel(selectedModelId)} disabled={isProcessing} style={{backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000'}}>
                Download {selectedModelName}
              </button>
            )
          ) : isProcessing ? (
            <button className="pro-btn primary" onClick={() => invoke("abort_transcription")} style={{backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff'}}>
              Cancel Processing
            </button>
          ) : (
            <button className="pro-btn primary" onClick={startTranscription} disabled={isDownloading || !filePath || !currentModelLoaded}>
              Run Inference
            </button>
          )}
        </div>
      </div>

      {/* Advanced CPU Settings Panel */}
      <EngineSettingsPanel
        showCpuSettings={showCpuSettings}
        computeMethod={computeMethod}
        useParallel={useParallel}
        cpuAutoTune={cpuAutoTune}
        cpuWorkers={cpuWorkers}
        cpuThreads={cpuThreads}
        setShowCpuSettings={setShowCpuSettings}
        setUseParallel={setUseParallel}
        setCpuAutoTune={setCpuAutoTune}
        setCpuWorkers={setCpuWorkers}
        setCpuThreads={setCpuThreads}
      />

      {/* Model Manager Panel */}
      <ModelManager 
        modelStatus={modelStatus} 
        showModelPanel={showModelPanel} 
        selectedModelId={selectedModelId} 
        setSelectedModelId={setSelectedModelId} 
        isDownloading={isDownloading} 
        downloadModel={downloadModel} 
        cancelDownload={cancelDownload}
        downloadingModelId={downloadingModelId}
        deleteModel={deleteModel}
      />

      {/* Main Workspace */}
      <div className="workspace">
        {/* Viewer Pane */}
        <div className="pane viewer-pane">
          <div className="pane-header">
            <span>Viewer</span>
            <span style={{fontWeight: 'normal', color: '#555'}}>{filePath ? filePath.split('\\').pop() : 'No Media Selected'}</span>
          </div>
          <div className="viewer-content">
            {!filePath ? (
              <div className="empty-drop" onClick={selectFile}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <span>Click to import Video or Audio</span>
              </div>
            ) : (
              <div className="video-container">
                <video ref={audioRef as any} src={audioUrl || undefined} controls />
              </div>
            )}
          </div>
        </div>

        {/* Inspector Pane */}
        <div className="pane inspector-pane">
          <div className="pane-header">
            <div className="result-tabs">
              <span className={`tab ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setViewMode('timeline')}>Timeline</span>
              <span className={`tab ${viewMode === 'text' ? 'active' : ''}`} onClick={() => setViewMode('text')}>Text</span>
              <span className={`tab ${viewMode === 'export' ? 'active' : ''}`} onClick={() => setViewMode('export')}>Export & Formats</span>
            </div>

          </div>
          <div className="result-body">
            {!transcriptionResult && !isProcessing && (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '100px', fontSize: '12px'}}>
                Run inference to view transcription.
              </div>
            )}
            
            {transcriptionResult && viewMode === "text" && (
              <div style={{color: '#ddd'}}>
                {transcriptionResult.text}
              </div>
            )}
            
            {transcriptionResult && viewMode === "timeline" && (
              <div className="timeline-segments">
                {getSegments(transcriptionResult).map((seg, i) => (
                  <TimelineSegment 
                    key={i} 
                    seg={seg} 
                    currentTime={currentTime} 
                    seekTo={seekTo} 
                  />
                ))}
              </div>
            )}

            {viewMode === "export" && (
              <ExportManager transcriptionResult={transcriptionResult} />
            )}
          </div>
        </div>
      </div>

      {/* Console Pane */}
      <TelemetryConsole />
    </div>
  );
}

export default App;
