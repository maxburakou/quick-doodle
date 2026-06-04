const DEBUG_FLAG_KEY = "quickDoodle.smartAssistDebug";

export const shouldLogSmartAssistDebug = (): boolean => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
};

export const logSmartAssistDebug = (
  message: string,
  payload?: Record<string, unknown>
) => {
  if (!shouldLogSmartAssistDebug()) return;

  if (payload) {
    console.debug(`[smart-assist] ${message}`, payload);
    return;
  }

  console.debug(`[smart-assist] ${message}`);
};

export const SMART_ASSIST_DEBUG_FLAG_KEY = DEBUG_FLAG_KEY;
