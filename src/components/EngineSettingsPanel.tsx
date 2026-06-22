import React from "react";

interface EngineSettingsPanelProps {
  showCpuSettings: boolean;
  computeMethod: string;
  useParallel: boolean;
  cpuAutoTune: boolean;
  cpuWorkers: number;
  cpuThreads: number;
  setShowCpuSettings: (v: boolean) => void;
  setUseParallel: (v: boolean) => void;
  setCpuAutoTune: (v: boolean) => void;
  setCpuWorkers: (v: number) => void;
  setCpuThreads: (v: number) => void;
}

const EngineSettingsPanel: React.FC<EngineSettingsPanelProps> = ({
  showCpuSettings,
  computeMethod,
  useParallel,
  cpuAutoTune,
  cpuWorkers,
  cpuThreads,
  setShowCpuSettings,
  setUseParallel,
  setCpuAutoTune,
  setCpuWorkers,
  setCpuThreads,
}) => {
  if (!showCpuSettings || computeMethod !== "cpu") return null;

  return (
    <div className="model-panel" style={{display: 'block', backgroundColor: '#1e1e1e', padding: '16px', borderBottom: '1px solid var(--border-dim)'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
        <h3 style={{margin: 0, fontSize: '14px', color: '#fff'}}>Advanced CPU Tuning</h3>
        <button className="pro-btn" onClick={() => setShowCpuSettings(false)} style={{padding: '2px 8px'}}>Close</button>
      </div>
      
      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '6px', width: 'fit-content'}}>
          <input 
            type="checkbox" 
            checked={useParallel} 
            onChange={(e) => setUseParallel(e.target.checked)} 
            style={{accentColor: 'var(--accent)', transform: 'scale(1.2)'}}
          />
          <span style={{fontSize: '14px', color: '#fff', fontWeight: 'bold'}}>Enable Parallel Processing (Faster, uses more RAM)</span>
        </label>

        {useParallel && (
          <div style={{display: 'flex', gap: '20px', alignItems: 'flex-start', marginLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '16px'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
              <input 
                type="checkbox" 
                checked={cpuAutoTune} 
                onChange={(e) => setCpuAutoTune(e.target.checked)} 
                style={{accentColor: 'var(--accent)'}}
              />
              <span style={{fontSize: '13px', color: '#ccc'}}>Auto-Tune (Recommended)</span>
            </label>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', opacity: cpuAutoTune ? 0.5 : 1, pointerEvents: cpuAutoTune ? 'none' : 'auto'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <label style={{fontSize: '12px', color: '#aaa', width: '120px'}}>Parallel Workers:</label>
                <input 
                  type="range" 
                  min="1" max="16" 
                  value={cpuWorkers} 
                  onChange={(e) => setCpuWorkers(parseInt(e.target.value))}
                  style={{width: '150px'}}
                />
                <span style={{fontSize: '13px', color: '#fff', width: '30px'}}>{cpuWorkers}</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <label style={{fontSize: '12px', color: '#aaa', width: '120px'}}>Threads per Worker:</label>
                <input 
                  type="range" 
                  min="1" max="16" 
                  value={cpuThreads} 
                  onChange={(e) => setCpuThreads(parseInt(e.target.value))}
                  style={{width: '150px'}}
                />
                <span style={{fontSize: '13px', color: '#fff', width: '30px'}}>{cpuThreads}</span>
              </div>
              <div style={{fontSize: '11px', color: '#888', marginTop: '4px'}}>
                ⚠️ Warning: Setting workers/threads higher than your physical CPU cores may cause severe performance degradation.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EngineSettingsPanel;
