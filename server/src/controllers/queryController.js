import { client } from '../services/logClient.js';

export function handleSearch(req, res) {
  const { term = '', startTime, endTime, limit = 100 } = req.query;
  const parsedLimit = Number.parseInt(limit, 10);
  const startMs = startTime === undefined ? 0 : Number(startTime);
  const endMs = endTime === undefined ? Date.now() : Number(endTime);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs < startMs ||
      !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 5000) {
    return res.status(400).json({ error: 'startTime/endTime must be valid and limit must be 1..5000' });
  }

  client.Query({
    term: String(term),
    start_time_nano: Math.trunc(startMs * 1e6),
    end_time_nano: Math.trunc(endMs * 1e6),
    limit: parsedLimit,
  }, (err, response) => {
    if (err) return res.status(502).json({ error: 'Go engine query failed', details: err.message });
    if (response.error) return res.status(502).json({ error: 'Go engine query failed', details: response.error });
    return res.json({
      meta: {
        count: response.logs?.length ?? 0,
        totalFound: response.total_found ?? response.logs?.length ?? 0,
      },
      logs: response.logs || [],
    });
  });
}
