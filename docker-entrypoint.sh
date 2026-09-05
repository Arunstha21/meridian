#!/bin/sh
set -e

role="${1:-web}"

if [ "$role" = "web" ]; then
  npm run db:migrate
  exec npm start
fi

if [ "$role" = "worker" ]; then
  exec npm run worker
fi

exec "$@"
