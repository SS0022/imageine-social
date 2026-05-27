
const isNative = window.location.protocol.includes('capacitor') || window.location.hostname === 'localhost' && window.location.port === '';

export const API_BASE_URL = isNative
  ? "https://ais-dev-cb6kmlkwf7ovv7riiuq7em-598054090778.asia-southeast1.run.app"
  : "";

export const getApiUrl = (path: string) => {
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
};
