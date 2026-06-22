export default function ModelManager({
  modelStatus,
  showModelPanel,
  selectedModelId,
  setSelectedModelId,
  isDownloading,
  downloadModel
}: any) {
  if (!showModelPanel || !modelStatus) return null;

  return (
    <div className="model-panel">
      <div className="model-panel-header">
        <span>Model Manager</span>
        <span style={{fontSize: '10px', color: '#666'}}>{modelStatus.models_dir}</span>
      </div>
      {modelStatus.models.map((m: any) => (
        <div key={m.id} className="model-row">
          <div className={`status-dot ${m.exists ? '' : 'error'}`} style={{marginRight: '8px'}}></div>
          <div style={{flex: 1}}>
            <div style={{fontSize: '12px', color: '#ddd'}}>{m.name}</div>
            <div style={{fontSize: '10px', color: '#666'}}>{m.filename} {m.exists ? `(${m.size_mb.toFixed(0)} MB)` : ''}</div>
          </div>
          <div style={{width: '200px', fontSize: '10px', color: '#888', textAlign: 'right', marginRight: '16px'}}>
            <div style={{color: '#aaa', fontWeight: 'bold'}}>{m.vram_req}</div>
            {m.languages}
          </div>
          {m.exists ? (
            <button className="pro-btn" onClick={() => setSelectedModelId(m.id)} style={{padding: '2px 8px', fontSize: '10px'}}>
              {selectedModelId === m.id ? '● Active' : 'Use'}
            </button>
          ) : (
            <button className="pro-btn" onClick={() => downloadModel(m.id)} disabled={isDownloading} 
              style={{padding: '2px 8px', fontSize: '10px', backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000'}}>
              {isDownloading ? '...' : 'Download'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
