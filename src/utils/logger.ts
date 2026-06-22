export const appLog = (message: string) => {
  window.dispatchEvent(new CustomEvent("app-log", { detail: message }));
};

export const clearLogs = () => {
  window.dispatchEvent(new Event("app-log-clear"));
};
