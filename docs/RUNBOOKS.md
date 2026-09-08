# Meridian Operational Runbooks

## 1. Database Backup & Restore

### Backup Procedure (PostgreSQL Dump)
Meridian stores all core financial records, double-entry ledger transactions, audits, and sessions in PostgreSQL.

To create a consistent snapshot of the application database:
```bash
# In Docker environments:
docker compose exec db pg_dump -U meridian -d meridian -F c -b -v -f /var/lib/postgresql/data/backup_$(date +%Y%m%d_%H%M%S).dump

# On host / native PostgreSQL:
pg_dump -U meridian -h 127.0.0.1 -p 5432 -d meridian -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump
```

**Recommended Backup Policy:**
- Run automated hourly WAL archiving or daily dumps via cron or systemd timer.
- Encrypt backups at rest (`gpg -c backup.dump` or age/age-keygen) before offsite sync.
- Retention: Keep 7 daily, 4 weekly, 12 monthly snapshots.

### Restore Procedure
Before restoring, stop the `web` and `worker` services to avoid concurrent mutations:
```bash
docker compose stop web worker

# Drop existing connection and restore snapshot into empty database:
docker compose exec -T db dropdb -U meridian --if-exists meridian
docker compose exec -T db createdb -U meridian meridian
docker compose exec -T db pg_restore -U meridian -d meridian -v < backup.dump

# Run migrations to bring restored database to match current codebase:
docker compose run --rm web npm run db:migrate

# Start web and worker services:
docker compose start web worker
```

### JSON Family Data Export & Recovery
Users and administrators can also download household data snapshots:
- Path: **Settings > Household Data > Export**
- Endpoint: `GET /api/export`
- Formats: Meridian JSON v1 (sanitized, excludes third-party credentials and password hashes).

---

## 2. Worker & Queue Monitoring

### Health Endpoint
The health endpoint reports status at `/api/health`:
- **HTTP 200 `status: "ok"`**: Database reachable, all migrations applied, mail transport configured, zero dead-letter jobs.
- **HTTP 200 `status: "degraded"`**: Database reachable, but dead jobs exist in the queue or mailer is improperly configured.
- **HTTP 503 `status: "degraded"`**: Unapplied database migrations pending.
- **HTTP 503 `status: "error"`**: Database connection failed.

Example response:
```json
{
  "status": "ok",
  "db": true,
  "migrations": "current",
  "queue": {
    "pending": 0,
    "running": 0,
    "completed": 45,
    "dead": 0
  },
  "mail": {
    "transport": "smtp",
    "ready": true
  }
}
```

### Dead-Letter Job Remediation
When a background job exceeds its maximum attempts (default 5), it enters the `dead` status and logs to `debug_logs`:
1. Check dead jobs in database:
   ```sql
   SELECT id, queue, attempts, last_error, created_at FROM jobs WHERE status = 'dead' ORDER BY updated_at DESC;
   ```
2. Replay a specific dead job:
   ```sql
   UPDATE jobs SET status = 'pending', attempts = 0, run_after = now(), updated_at = now() WHERE id = '<job-id>';
   ```

---

## 3. Deployment Hardening & Security Defaults

1. **Port Binding**:
   - PostgreSQL port `5432` is bound strictly to `127.0.0.1` by default in `docker-compose.yml`.
   - Web application port `3000` is bound to `127.0.0.1`. Use a reverse proxy (Nginx, Caddy, Cloudflare Tunnel) with HTTPS termination.
2. **Reverse Proxy Configuration**:
   - When running behind a reverse proxy (e.g. Caddy, Nginx), set `TRUST_PROXY=true` in environment variables so client IP addresses for rate limiting are parsed safely from `X-Forwarded-For`.
3. **Mail Configuration**:
   - Set `MAIL_TRANSPORT=smtp` and `SMTP_URL=smtp://user:pass@smtp.host:587` in production.
   - Meridian will fail to start the mailer visibly if `MAIL_TRANSPORT=smtp` is set without `SMTP_URL`.
