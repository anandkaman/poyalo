#!/usr/bin/env bash
# Builds OSRM routing data from an OpenStreetMap extract (docs/R1, docs/D7 §2).
#
# Usage: bash infra/osrm/prepare.sh [geofabrik-path]
#   default: asia/india/southern-zone   (Tamil Nadu, Kerala, Karnataka, AP, Telangana; ~1 GB pbf)
#   all of India: asia/india             (~1.5 GB pbf, needs ~16 GB RAM to build)
#
# Re-run weekly in production (cron) and swap the data directory without downtime.
# The bike profile reuses car.lua for now; a tuned motorbike profile is a later task (todo P2).
set -euo pipefail

AREA="${1:-asia/india/southern-zone}"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DATA="$ROOT/data"
PBF="$DATA/source.osm.pbf"

mkdir -p "$DATA/car"

if [[ ! -f "$PBF" ]]; then
  echo ">> downloading https://download.geofabrik.de/${AREA}-latest.osm.pbf"
  curl -fL --retry 3 -o "$PBF.part" "https://download.geofabrik.de/${AREA}-latest.osm.pbf"
  mv "$PBF.part" "$PBF"
fi

cp "$PBF" "$DATA/car/region.osm.pbf"

run() { docker run --rm -t -v "$DATA/car:/data" "$OSRM_IMAGE" "$@"; }

echo ">> extract (car profile)"
run osrm-extract -p /opt/car.lua /data/region.osm.pbf
echo ">> partition"
run osrm-partition /data/region.osrm
echo ">> customize"
run osrm-customize /data/region.osrm
rm -f "$DATA/car/region.osm.pbf"

echo ">> done. Start it with:"
echo "   docker compose -f infra/docker/docker-compose.yml --profile osrm up -d osrm-car"
echo "   curl 'http://localhost:5000/route/v1/driving/80.2707,13.0827;80.2209,13.0067?overview=false'"
