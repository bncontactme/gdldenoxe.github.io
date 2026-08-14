#!/bin/sh
# Cambia una de las dos contraseñas del Worker.
#
#   ./cambiar-clave.sh            → la de colaborador (PW_HASH)
#   ./cambiar-clave.sh admin      → la de admin (ADMIN_HASH)
#
# La contraseña nunca sale de esta máquina: se teclea a ciegas, se convierte a
# SHA-256 aquí, y a Cloudflare solo viaja el hash. Toma efecto de inmediato, no
# hace falta volver a desplegar el Worker.

set -eu

cd "$(dirname "$0")"

case "${1:-colaborador}" in
  admin)        SECRET=ADMIN_HASH; QUIEN='admin';        ESPERA_ADMIN=true  ;;
  colaborador)  SECRET=PW_HASH;    QUIEN='colaborador';  ESPERA_ADMIN=false ;;
  *) echo "Uso: $0 [colaborador|admin]" >&2; exit 2 ;;
esac

echo "Vas a cambiar la contraseña de $QUIEN ($SECRET)."

leer() {
  printf '%s' "$1"
  stty -echo 2>/dev/null || true
  IFS= read -r RESP
  stty echo 2>/dev/null || true
  printf '\n'
}

leer 'Nueva contraseña: ';  nueva="$RESP"
leer 'Repítela: ';          otra="$RESP"

[ "$nueva" = "$otra" ] || { echo 'No coinciden. No se cambió nada.' >&2; exit 1; }
[ -n "$nueva" ]        || { echo 'Vacía. No se cambió nada.' >&2; exit 1; }

if [ "$(printf '%s' "$nueva" | wc -c)" -lt 10 ]; then
  echo 'Menos de 10 caracteres. Ponle una más larga.' >&2
  exit 1
fi

hash=$(printf '%s' "$nueva" | shasum -a 256 | awk '{print $1}')
printf '%s' "$hash" | npx wrangler secret put "$SECRET"

# Comprobar contra el Worker real: `ping` responde si la contraseña sirve y de
# qué nivel es. El Worker exige un Origin conocido, por eso va el encabezado.
echo 'Probando la contraseña nueva contra el Worker…'
sleep 2
cuerpo=$(GDN_PW="$nueva" node -e \
  'process.stdout.write(JSON.stringify({action:"ping",password:process.env.GDN_PW}))')
unset nueva otra RESP

respuesta=$(printf '%s' "$cuerpo" | curl -sS \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://www.guadalajaradenoxe.com' \
  --data-binary @- \
  https://archivo-upload.guadalajaradenoxe.workers.dev)

case "$respuesta" in
  *'"ok":true'*)
    if [ "$ESPERA_ADMIN" = true ] && ! (echo "$respuesta" | grep -q '"admin":true'); then
      echo "El Worker la acepta, pero no como admin. Revisa: $respuesta" >&2
      exit 1
    fi
    echo "Listo. La contraseña de $QUIEN ya es la nueva." ;;
  *)
    echo "Algo salió mal, el Worker respondió: $respuesta" >&2
    exit 1 ;;
esac
