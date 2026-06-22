import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export default function TelemetryConsole() {
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to backend Rust events
    const unlisten = listen<string>("transcription-log", (event) => {
      setLogs((prev) => [...prev, event.payload]);
    });

    // Listen to local frontend App events
    const handleLocalLog = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setLogs((prev) => [...prev, customEvent.detail]);
    };
    
    // Listen to local frontend clear events
    const handleClearLogs = () => {
      setLogs([]);
    };

    window.addEventListener("app-log", handleLocalLog);
    window.addEventListener("app-log-clear", handleClearLogs);

    return () => {
      unlisten.then((f) => f());
      window.removeEventListener("app-log", handleLocalLog);
      window.removeEventListener("app-log-clear", handleClearLogs);
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="pane console-pane">
      <div className="pane-header">Console Output</div>
      <div className="console-body" ref={terminalRef}>
        {logs.map((log, i) => {
          let cls = "";
          if (log.includes("Chunk")) cls = "log-chunk";
          if (log.includes("✅")) cls = "log-success";
          if (log.includes("[ERROR]") || log.includes("[FATAL]")) cls = "log-error";
          if (log.includes("RESULT") || log.includes("SUMMARY") || log.includes("[INIT]")) cls = "log-highlight";
          if (log.includes("[DOWNLOAD]")) cls = "log-chunk";
          return <div key={i} className={cls}>{log}</div>;
        })}
      </div>
    </div>
  );
}
