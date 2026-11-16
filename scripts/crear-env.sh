#!/usr/bin/env bash
# Crea el .env del servidor con secretos nuevos, sin mostrarlos en pantalla.
# Uso (en el servidor):  bash scripts/crear-env.sh
# No toca un .env que ya exista.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -e .env ]; then
  echo "Ya existe un .env; no se modifica. Si de verdad quieres uno nuevo, renómbralo antes."
  exit 1
fi
command -v openssl >/dev/null || { echo "Falta openssl."; exit 1; }

umask 077
cp .env.example .env
for clave in JWT_SECRET POSTGRES_PASSWORD TEMPORAL_DB_PASSWORD; do
  sed -i "s|^$clave=.*|$clave=$(openssl rand -hex 32)|" .env
done
chmod 600 .env

echo "Listo: .env creado con 3 secretos nuevos y permisos 600 (solo tu usuario lo lee)."
echo "Dirección: $(grep -E '^POSTIZ_URL=' .env | cut -d= -f2-)"
echo "Puerto:    $(grep -E '^POSTIZ_PORT=' .env | cut -d= -f2-)"
echo "Versión:   $(grep -E '^POSTIZ_VERSION=' .env | cut -d= -f2-)"
echo "Las llaves de Meta y demás redes se agregan después con:  nano .env"
