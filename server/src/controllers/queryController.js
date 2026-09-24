// server/src/controllers/queryController.js
import { queryGoEngine } from '../ipcClient.js';

export async function handleSearchLogs(req, res) {
  try {
    const { token, start, end, limit } = req.query;

    // Default to a 15-minute search window if not supplied
    const nowNs = Date.now() * 1e6;
    const startTimeNs = start ? Number(start) : nowNs - (15 * 60 * 1e9);
    const endTimeNs = end ? Number(end) : nowNs;

    const isTermSearch = Boolean(token && token.trim().length > 0);

    const queryPayload = {
      type: isTermSearch ? 1 : 0, // 0: TIME_RANGE_SCAN, 1: TERM_KEYWORD_SEARCH
      token: isTermSearch ? token.trim() : '',
      startTimeNs,
      endTimeNs,
      limit: Math.min(Number(limit) || 200, 1000)
    };

    const response = await queryGoEngine(queryPayload);

    if (response.errorMessage) {
      return res.status(500).json({ error: response.errorMessage });
    }

    return res.json({
      meta: {
        count: response.logs?.length || 0,
        executionTimeNs: response.executionTimeNs,
        queryType: isTermSearch ? 'TERM_KEYWORD_SEARCH' : 'TIME_RANGE_SCAN'
      },
      logs: response.logs || []
    });
  } catch (err) {
    return res.status(502).json({ error: 'IPC query failure', message: err.message });
  }
}