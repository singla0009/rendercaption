import { useState, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { appLog } from "../utils/logger";
import { generateAdvancedSrtContent, TranscriptionResult } from "../utils/exportFormatters";

interface ExportManagerProps {
  transcriptionResult: TranscriptionResult | null;
}

export default function ExportManager({ transcriptionResult }: ExportManagerProps) {
  const [maxWords, setMaxWords] = useState<number>(10);
  const [maxGap, setMaxGap] = useState<number>(1.0);
  const [srtPreview, setSrtPreview] = useState<string>("");

  useEffect(() => {
    if (transcriptionResult) {
      setSrtPreview(generateAdvancedSrtContent(transcriptionResult, maxWords, maxGap));
    } else {
      setSrtPreview("");
    }
  }, [transcriptionResult, maxWords, maxGap]);

  const exportFile = async (content: string, defaultName: string) => {
    try {
      const outPath = await save({ defaultPath: defaultName });
      if (outPath) {
        await writeTextFile(outPath, content);
        appLog(`✅ Saved successfully to ${outPath}`);
      }
    } catch (e) {
      appLog(`[ERROR] Export failed: ${e}`);
    }
  };

  const exportTxt = () => {
    if (!transcriptionResult) return;
    exportFile(transcriptionResult.text, "transcript.txt");
  };

  const exportJson = () => {
    if (!transcriptionResult) return;
    exportFile(JSON.stringify(transcriptionResult, null, 2), "transcript.json");
  };

  const exportSrt = () => {
    if (!transcriptionResult) return;
    exportFile(srtPreview, "transcript.srt");
  };

  if (!transcriptionResult) {
    return (
      <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '100px', fontSize: '12px'}}>
        Run inference to enable export formatting.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Controls Area */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '12px' }}>
          Subtitle Formatting (SRT)
        </div>
        
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <span>Max Words Per Subtitle:</span>
              <span style={{color: '#fff'}}>{maxWords}</span>
            </label>
            <input 
              type="range" min="1" max="30" step="1" 
              value={maxWords} 
              onChange={(e) => setMaxWords(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <span>Max Gap Duration (Seconds):</span>
              <span style={{color: '#fff'}}>{maxGap.toFixed(1)}s</span>
            </label>
            <input 
              type="range" min="0.1" max="5.0" step="0.1" 
              value={maxGap} 
              onChange={(e) => setMaxGap(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-dim)' }}>
          <button className="pro-btn-export" onClick={exportTxt} title="Export as plain text">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            TXT
          </button>
          <button className="pro-btn-export" onClick={exportSrt} title="Export as Subtitles (SRT)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            SRT
          </button>
          <button className="pro-btn-export" onClick={exportJson} title="Export exact timestamps (JSON)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            JSON
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div style={{
        flex: 1,
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ccc',
        whiteSpace: 'pre-wrap',
        overflowY: 'auto'
      }}>
        {srtPreview}
      </div>
      
    </div>
  );
}
