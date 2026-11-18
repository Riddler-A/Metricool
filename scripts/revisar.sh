#!/usr/bin/env bash
# Revisión ANTES de arrancar: no cambia nada, solo dice si el servidor está listo.
# Uso (en el servidor):  bash scripts/revisar.sh
source "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

DOMINIO=redes.alexisconsultor.com
echo "Revisión previa de Prisma CN · Redes"

echo; echo "Docker"
if command -v docker >/dev/null; then
  ok "Docker instalado ($(docker --version | cut -d, -f1))"
  docker compose version >/dev/null 2>&1 && ok "docker compose disponible" || falla "Falta el plugin docker compose"
  if docker ps >/dev/null 2>&1; then
    ok "Tu usuario puede usar Docker"
  else
    falla "Tu usuario no puede usar Docker. Con root: usermod -aG docker $USER  (y vuelve a entrar por SSH)"
  fi
else
  falla "Docker no está instalado (paso 2 del README, con root)"
fi

echo; echo "Memoria"
DISP=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
DISP=${DISP:-0}
SWAP=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
EN_USO=$(docker ps -q 2>/dev/null | wc -l)
if [ "$EN_USO" -gt 0 ]; then
  ok "Disponible: ${DISP} MB (con $EN_USO contenedores ya encendidos)"
elif [ "$DISP" -ge 3500 ]; then
  ok "Disponible: ${DISP} MB (se necesitan 3500)"
else
  falla "Disponible: ${DISP} MB. Con menos de 3500 MB NO se instala: pondría en riesgo los otros sitios"
fi
[ "$SWAP" -gt 0 ] && ok "Swap: ${SWAP} MB" || aviso "No hay swap (memoria de reserva). Recomendado crear 4 GB con root (README, paso 2)"

echo; echo "Configuración (.env)"
if [ ! -f .env ]; then
  falla "No existe .env. Créalo con:  bash scripts/crear-env.sh"
else
  PERM=$(stat -c %a .env)
  [ "$PERM" = "600" ] && ok "Permisos 600" || falla "Permisos $PERM; deben ser 600:  chmod 600 .env"
  for clave in JWT_SECRET POSTGRES_PASSWORD TEMPORAL_DB_PASSWORD; do
    V=$(env_valor "$clave")
    if [ -z "$V" ] || [ "$V" = "cambia-esto" ] || [ "${#V}" -lt 32 ]; then
      falla "$clave vacío, de ejemplo o corto"
    else
      ok "$clave definido"
    fi
  done
  URL=$(env_valor POSTIZ_URL)
  [ "$URL" = "https://$DOMINIO" ] && ok "POSTIZ_URL = $URL" || falla "POSTIZ_URL debe ser https://$DOMINIO (ahora: $URL)"
  [ -z "$(env_valor NOT_SECURED)" ] && ok "NOT_SECURED vacío" || falla "NOT_SECURED debe ir vacío en el servidor"
  VER=$(env_valor POSTIZ_VERSION)
  if [ -z "$VER" ] || [ "$VER" = "latest" ]; then aviso "POSTIZ_VERSION sin fijar (latest)"; else ok "Versión fija: $VER"; fi
fi

echo; echo "Puerto y Hestia"
PUERTO=$(env_valor POSTIZ_PORT); PUERTO=${PUERTO:-3000}
NUESTRO=$(docker ps --filter name=prisma-branding --format '{{.Ports}}' 2>/dev/null | grep -c ":$PUERTO->" || true)
if [ "$NUESTRO" -gt 0 ]; then
  ok "Puerto $PUERTO: lo usa esta herramienta"
elif ss -ltn 2>/dev/null | grep -q "127.0.0.1:$PUERTO \|\*:$PUERTO \|0.0.0.0:$PUERTO "; then
  falla "Puerto $PUERTO ocupado por otra app (revisa pm2 list: las apps de prueba deben estar detenidas). Si no, elige otro libre (ss -ltn) en .env y en la plantilla de Hestia"
else
  ok "Puerto $PUERTO libre"
fi
CONF="$HOME/conf/web/$DOMINIO/nginx.ssl.conf"
if [ -r "$CONF" ]; then
  if grep -q "proxy_pass http://127.0.0.1:$PUERTO;" "$CONF"; then
    ok "Hestia manda $DOMINIO al puerto $PUERTO"
  else
    falla "Hestia manda $DOMINIO a $(grep -m1 -oE '127\.0\.0\.1:[0-9]+' "$CONF"), no al $PUERTO. En el panel: plantilla de proxy NODEJS$PUERTO"
  fi
  [ -e "$HOME/conf/web/$DOMINIO/nginx.hsts.conf" ] && ok "HSTS activado" || aviso "HSTS apagado. Actívalo en Hestia (SSL del dominio)"
else
  falla "No encuentro la configuración de $DOMINIO en Hestia (¿existe el dominio con SSL?)"
fi

resumen
