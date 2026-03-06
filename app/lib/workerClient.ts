const DEFAULT_WORKER_BASE_URL = "https://archaios-saas-worker.quandrix357.workers.dev";

export function getWorkerBaseUrl() {
  return process.env.WORKER_BASE_URL || process.env.BRIEF_WORKER_URL || DEFAULT_WORKER_BASE_URL;
}

export function getWorkerHeaders(contentType = true) {
  const headers: Record<string, string> = {};
  const workerAuthToken = process.env.WORKER_AUTH_TOKEN;

  if (contentType) {
    headers["Content-Type"] = "application/json";
  }
  if (workerAuthToken) {
    headers.Authorization = `Bearer ${workerAuthToken}`;
  }

  return headers;
}

export async function fetchWorker(path: string, init: RequestInit = {}) {
  const baseUrl = getWorkerBaseUrl();
  return fetch(`${baseUrl}${path}`, init);
}
