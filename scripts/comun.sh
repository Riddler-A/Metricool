#!/usr/bin/env bash
# Funciones compartidas por los scripts. No se ejecuta solo.

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

FALLOS=0
AVISOS=0
ok()    { printf '  [ OK ]  %s\n' "$1"; }
aviso() { printf '  [AVISO] %s\n' "$1"; AVISOS=$((AVISOS + 1)); }
falla() { printf '  [FALLA] %s\n' "$1"; FALLOS=$((FALLOS + 1)); }

# Lee una variable del .env sin ejecutarlo (y sin mostrar las demás).
env_valor() {
  [ -f .env ] || return 0
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r'
}

resumen() {
  echo
  if [ "$FALLOS" -gt 0 ]; then
    echo "Resultado: $FALLOS falla(s) y $AVISOS aviso(s). Corrige las fallas antes de seguir."
    exit 1
  fi
  echo "Resultado: sin fallas ($AVISOS aviso(s))."
}
