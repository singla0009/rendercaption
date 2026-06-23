export default function ModelManager({
  modelStatus,
  showModelPanel,
  selectedModelId,
  setSelectedModelId,
  isDownloading,
  downloadModel,
  cancelDownload,
  downloadingModelId,
  deleteModel
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
            <div style={{display: 'flex', gap: '4px'}}>
              <button className="pro-btn" onClick={() => setSelectedModelId(m.id)} style={{padding: '2px 8px', fontSize: '10px'}}>
                {selectedModelId === m.id ? '● Active' : 'Use'}
              </button>
              <button className="pro-btn" onClick={() => deleteModel(m.id)} style={{padding: '2px 6px', fontSize: '10px', backgroundColor: '#333', borderColor: '#444', color: '#ef4444'}} title="Delete Model">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          ) : isDownloading && downloadingModelId === m.id ? (
            <button className="pro-btn danger" onClick={cancelDownload} style={{padding: '2px 8px', fontSize: '10px', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff'}}>
              Cancel
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
