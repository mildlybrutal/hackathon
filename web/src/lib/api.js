export const api = {
  async searchLogs({ term = '', startTimeMs, endTimeMs, limit = 200 }) {
    const params = new URLSearchParams({ term, startTime: Math.floor(startTimeMs), endTime: Math.floor(endTimeMs), limit: String(limit) });
    const res = await fetch(`/api/logs/search?${params}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body.error || `Server returned ${res.status}`);
      error.code = 'ENGINE_ERROR';
      error.details = body.details;
      throw error;
    }
    return body;
  },
  websocketUrl(term = '') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/logs?${new URLSearchParams({ term })}`;
  },
};
