#!/usr/bin/env bash
# Respalda la base de datos de Postiz y los reportes en ~/respaldos-redes y borra los de
# más de 14 días.
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
echo "$(date '+%F %T') Respaldo listo: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Reportes de resultados (archivos JSON del volumen reportes-data).
REPORTES="$DESTINO/reportes-$(date +%F-%H%M).tar.gz"
if docker compose exec -T reportes tar czf - -C /home/node . > "$REPORTES.tmp" 2>/dev/null; then
  mv "$REPORTES.tmp" "$REPORTES"
  echo "$(date '+%F %T') Reportes respaldados: $REPORTES"
else
  rm -f "$REPORTES.tmp"
  echo "$(date '+%F %T') AVISO: no se pudieron respaldar los reportes" >&2
fi

find "$DESTINO" \( -name 'redes-*.sql.gz' -o -name 'reportes-*.tar.gz' \) -mtime +14 -delete
