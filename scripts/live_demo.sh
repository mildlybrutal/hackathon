#!/usr/bin/env bash

set -u

INGEST_URL="${INGEST_URL:-http://localhost:8080/ingest}"
INTERVAL="${INTERVAL:-0.5}"
COUNT="${COUNT:-0}"
i=0

echo "Streaming demo logs to ${INGEST_URL} every ${INTERVAL}s"
echo "Use the frontend query: chronologdemo"
echo "Press Ctrl-C to stop"

while [ "$COUNT" -eq 0 ] || [ "$i" -lt "$COUNT" ]; do
  now="$(date -u '+%b %d %H:%M:%S')"
  message="<34>${now} demo-host chronologdemo: live demo timeout event=${i} request=/api/checkout"

  if ! curl --fail --silent --show-error \
    -X POST "$INGEST_URL" \
    --data-binary "${message}" >/dev/null; then
    echo "Ingestion failed; is the Go engine running at ${INGEST_URL}?" >&2
    exit 1
  fi

  i=$((i + 1))
  sleep "$INTERVAL"
done
