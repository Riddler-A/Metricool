#!/usr/bin/env bash
# Arranca (o actualiza) la herramienta: revisa, descarga, enciende y verifica.
# Uso (en el servidor):  bash scripts/instalar.sh
# Se puede repetir sin riesgo: no borra datos ni toca el .env.
set -uo pipefail
AQUI="$(dirname "${BASH_SOURCE[0]}")"
cd "$AQUI/.."

bash "$AQUI/revisar.sh" || { echo; echo "No se arranca hasta corregir las fallas de arriba."; exit 1; }

echo; echo "Descargando imágenes (la primera vez son unos 3 GB y tarda varios minutos)..."
docker compose pull --quiet || { echo "Falló la descarga."; exit 1; }
echo "Encendiendo servicios..."
docker compose up -d || { echo "Falló el arranque."; exit 1; }

PUERTO=$(grep -E '^POSTIZ_PORT=' .env | cut -d= -f2- | tr -d '\r'); PUERTO=${PUERTO:-3000}
echo "Esperando a que Postiz responda (hasta 5 minutos)..."
for _ in $(seq 1 60); do
  [ "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUERTO/auth")" = "200" ] && break
  sleep 5
done

echo
bash "$AQUI/verificar.sh"
