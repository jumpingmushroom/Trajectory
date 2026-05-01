#!/usr/bin/env bash
# Take a SQLite snapshot of the live Trajectory DB and prune old snapshots.
# Run this from host cron — it talks to the running container via
# `docker exec` so the SQLite .backup API is used (cp/rsync of a live WAL
# file can copy a torn page; per DECISIONS.md D6).
#
# Retention:
#   - all snapshots from the last 14 days
#   - the newest snapshot per ISO week for the 8 most recent weeks beyond
#   - drop everything else
#
# Also prunes `data/db.sqlite.pre-migration-*` snapshots accumulated by the
# migration runner, keeping the 5 most recent.
#
# Defaults assume the container is named `trajectory` and the data dir is
# `data/` next to this script. Override via env:
#   TRAJECTORY_CONTAINER=<name>     (default: trajectory)
#   TRAJECTORY_DATA_DIR=<path>      (default: <repo>/data)
#
# Cron example (host crontab):
#   0 4 * * * /srv/trajectory/scripts/backup.sh >> /var/log/trajectory-backup.log 2>&1

set -euo pipefail

CONTAINER="${TRAJECTORY_CONTAINER:-trajectory}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${TRAJECTORY_DATA_DIR:-$SCRIPT_DIR/../data}"
DATA_DIR="$(realpath "$DATA_DIR")"
BACKUP_DIR="$DATA_DIR/backups"

if ! command -v docker >/dev/null 2>&1; then
	echo "[backup] docker not on PATH" >&2
	exit 1
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
	echo "[backup] container '$CONTAINER' is not running" >&2
	exit 1
fi

mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%d-%H%M%S)"
snapshot_host="$BACKUP_DIR/db-$ts.sqlite"
snapshot_in_container="/app/data/backups/db-$ts.sqlite"

docker exec "$CONTAINER" node /app/scripts/snapshot.mjs /app/data/db.sqlite "$snapshot_in_container"

if [[ ! -s "$snapshot_host" ]]; then
	echo "[backup] snapshot $snapshot_host is missing or empty" >&2
	exit 1
fi

echo "[backup] $snapshot_host ($(du -h "$snapshot_host" | cut -f1))"

# ── Retention ────────────────────────────────────────────────────
now_epoch="$(date -u +%s)"
fourteen_days=$((14 * 86400))
declare -A weekly_keep=()
to_delete=()

shopt -s nullglob
for f in "$BACKUP_DIR"/db-*.sqlite; do
	base="$(basename "$f")"
	if [[ ! "$base" =~ ^db-([0-9]{8})-([0-9]{6})\.sqlite$ ]]; then
		continue
	fi
	d="${BASH_REMATCH[1]}"
	t="${BASH_REMATCH[2]}"
	iso="${d:0:4}-${d:4:2}-${d:6:2}T${t:0:2}:${t:2:2}:${t:4:2}Z"
	if ! file_epoch="$(date -u -d "$iso" +%s 2>/dev/null)"; then
		continue
	fi
	age=$((now_epoch - file_epoch))
	if (( age <= fourteen_days )); then
		continue
	fi
	week_key="$(date -u -d "$iso" +%G-%V)"
	existing="${weekly_keep[$week_key]-}"
	if [[ -z "$existing" ]]; then
		weekly_keep[$week_key]="$file_epoch|$f"
	else
		ex_epoch="${existing%%|*}"
		ex_path="${existing#*|}"
		if (( file_epoch > ex_epoch )); then
			to_delete+=("$ex_path")
			weekly_keep[$week_key]="$file_epoch|$f"
		else
			to_delete+=("$f")
		fi
	fi
done
shopt -u nullglob

# Keep the 8 most recent weeks; older weekly survivors get pruned.
if (( ${#weekly_keep[@]} > 8 )); then
	mapfile -t ordered_weeks < <(printf '%s\n' "${!weekly_keep[@]}" | sort -r)
	for ((i=8; i<${#ordered_weeks[@]}; i++)); do
		v="${weekly_keep[${ordered_weeks[$i]}]}"
		to_delete+=("${v#*|}")
	done
fi

for f in "${to_delete[@]}"; do
	[[ -z "$f" ]] && continue
	rm -f -- "$f"
	echo "[backup] pruned $(basename "$f")"
done

# ── Pre-migration snapshot prune ─────────────────────────────────
mapfile -t pre_migration < <(find "$DATA_DIR" -maxdepth 1 -name 'db.sqlite.pre-migration-*' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk '{ $1=""; sub(/^ /,""); print }')
if (( ${#pre_migration[@]} > 5 )); then
	for ((i=5; i<${#pre_migration[@]}; i++)); do
		rm -f -- "${pre_migration[$i]}"
		echo "[backup] pruned $(basename "${pre_migration[$i]}")"
	done
fi
