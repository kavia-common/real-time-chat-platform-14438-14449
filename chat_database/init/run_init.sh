#!/usr/bin/env bash
set -euo pipefail

# This script runs the MongoDB initialization to create collections, validators, and indexes.
# It reuses the same defaults used by startup.sh. Prefer exporting different values before invoking this script.
DB_NAME="${DB_NAME:-myapp}"
DB_USER="${DB_USER:-appuser}"
DB_PASSWORD="${DB_PASSWORD:-dbuser123}"
DB_PORT="${DB_PORT:-5000}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_JS="${SCRIPT_DIR}/init_mongodb.js"

if ! command -v mongosh >/dev/null 2>&1; then
  echo "Error: mongosh not found in PATH. Please install MongoDB Shell."
  exit 1
fi

# Check server availability
if ! mongosh --port "${DB_PORT}" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
  echo "MongoDB does not appear to be running on port ${DB_PORT}."
  echo "Start it first (e.g., via chat_database/startup.sh) and re-run this script."
  exit 1
fi

echo "Running database initialization for '${DB_NAME}' on port ${DB_PORT}..."
mongosh "mongodb://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?authSource=admin" --file "${INIT_JS}"
echo "✓ Initialization finished."
