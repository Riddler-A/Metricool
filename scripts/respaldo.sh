#!/usr/bin/env bash
# Respalda la base de datos de Postiz en ~/respaldos-redes y borra los de más de 14 días.
# Uso (en el servidor):  bash scripts/respaldo.sh
# Diario con cron (crontab -e):
#   15 3 * * * bash $HOME/apps/prisma-redes/scripts/respaldo.sh >> $HOME/respaldos-redes/respaldo.log 2>&1
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

DESTINO="$HOME/respaldos-redes"
ARCHIVO="$DESTINO/redes-$(date +%F-%H%M).sql.gz"
umask 077
mkdir -p "$DESTINO"

# Se escribe a un temporal para no dejar un respaldo a medias si algo falla.
docker compose exec -T postiz-postgres pg_dump -U postiz-user postiz-db | gzip > "$ARCHIVO.tmp"
if [ "$(stat -c %s "$ARCHIVO.tmp")" -lt 1000 ]; then
  rm -f "$ARCHIVO.tmp"
  echo "$(date '+%F %T') FALLA: el respaldo salió vacío" >&2
  exit 1
fi
mv "$ARCHIVO.tmp" "$ARCHIVO"
find "$DESTINO" -name 'redes-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') Respaldo listo: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
