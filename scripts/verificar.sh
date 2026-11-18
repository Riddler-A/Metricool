#!/usr/bin/env bash
# Revisión DESPUÉS de arrancar: funcionamiento y seguridad. No cambia nada.
# Uso (en el servidor):  bash scripts/verificar.sh
source "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

echo "Verificación de Prisma CN · Redes"
PUERTO=$(env_valor POSTIZ_PORT); PUERTO=${PUERTO:-3010}
URL=$(env_valor POSTIZ_URL)

echo; echo "Contenedores"
for c in prisma-branding prisma-reportes postiz postiz-postgres postiz-redis temporal temporal-postgresql temporal-elasticsearch temporal-ui; do
  ESTADO=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "no existe")
  [ "$ESTADO" = "running" ] && ok "$c encendido" || falla "$c: $ESTADO"
done

echo; echo "Puertos (nada debe quedar abierto a internet)"
PUBLICOS=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:|\[::\]:|:::' || true)
if [ -z "$PUBLICOS" ]; then ok "Todos los puertos publicados están solo en 127.0.0.1"; else falla "Puertos abiertos a internet: $PUBLICOS"; fi

echo; echo "Respuesta"
COD=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUERTO/auth" || true)
[ "$COD" = "200" ] && ok "Responde en 127.0.0.1:$PUERTO" || falla "127.0.0.1:$PUERTO/auth respondió $COD (si acaba de arrancar, espera 2 minutos)"

if [ "${URL#https://}" != "$URL" ]; then
  HTML=$(curl -s -m 20 "$URL/auth" || true)
  CAB=$(curl -s -m 20 -o /dev/null -D - "$URL/auth" || true)
  # Confirma que quien contesta es esta herramienta y no otro sitio del servidor
  # en el mismo puerto (ya pasó con el 3003).
  if printf '%s' "$HTML" | grep -q 'prisma-brand/brand.css'; then
    ok "$URL muestra la herramienta con la marca de Prisma CN"
  else
    falla "$URL no muestra esta herramienta (revisa la plantilla de proxy en Hestia: NODEJS$PUERTO)"
  fi
  for h in x-content-type-options x-frame-options referrer-policy; do
    printf '%s' "$CAB" | grep -qi "^$h:" && ok "Cabecera $h" || falla "Falta la cabecera $h"
  done
  printf '%s' "$CAB" | grep -qi '^strict-transport-security:' && ok "HSTS activo" || aviso "Sin HSTS. Actívalo en Hestia (SSL del dominio)"
  COD=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "http://${URL#https://}/" || true)
  case "$COD" in 301|302|307|308) ok "HTTP redirige a HTTPS" ;; *) falla "HTTP no redirige a HTTPS (respondió $COD)" ;; esac
fi

echo; echo "Seguridad"
[ "$(stat -c %a .env 2>/dev/null)" = "600" ] && ok ".env con permisos 600" || falla ".env debe tener permisos 600"
[ -z "$(env_valor NOT_SECURED)" ] && ok "NOT_SECURED vacío" || falla "NOT_SECURED debe ir vacío en el servidor"
if [ "$(env_valor DISABLE_REGISTRATION)" = "true" ]; then
  ok "Registro cerrado"
else
  aviso "REGISTRO ABIERTO: cualquiera puede crear una cuenta. Crea las del equipo y pon DISABLE_REGISTRATION=true"
fi
VER=$(env_valor POSTIZ_VERSION)
if [ -z "$VER" ] || [ "$VER" = "latest" ]; then aviso "POSTIZ_VERSION sin fijar"; else ok "Versión fija: $VER"; fi

echo; echo "Respaldos y memoria"
crontab -l 2>/dev/null | grep -q 'scripts/respaldo.sh' && ok "Respaldo diario programado" || aviso "Sin respaldo diario (README, sección 7)"
ULTIMO=$(ls -t "$HOME"/respaldos-redes/*.sql.gz 2>/dev/null | head -1)
[ -n "$ULTIMO" ] && ok "Último respaldo: $(basename "$ULTIMO")" || aviso "Todavía no hay ningún respaldo"
DISP=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
DISP=${DISP:-0}
[ "$DISP" -ge 700 ] && ok "Memoria disponible: ${DISP} MB" || aviso "Queda poca memoria: ${DISP} MB"

resumen
