#!/usr/bin/env bash
# Elimina del historial de git el paquete SCORM que se subió y se borró después.
#
# Contexto: el commit 1b47be3 añadió «Investigando mi barrio  Construimos
# comunidad.zip» (26 MB, contenido de curso de Articulate Storyline) y 195cc7c
# lo borró. Borrar un archivo NO lo quita del historial: el blob sigue siendo
# descargable y es prácticamente todo el peso del repositorio.
#
# ATENCIÓN: esto REESCRIBE el historial. Todos los SHA cambian y hace falta
# force-push. Quien tenga un clon debe volver a clonar. Ejecútalo a conciencia.
#
# Uso:
#   bash scripts/purgar-historial.sh            # simulación, no toca nada
#   bash scripts/purgar-historial.sh --aplicar  # reescribe el historial local

set -euo pipefail

BLOB_PATH='Investigando mi barrio  Construimos comunidad.zip'
APLICAR="${1:-}"

echo "Blob objetivo: ${BLOB_PATH}"
echo
echo "Apariciones en el historial actual:"
git log --all --oneline -- "${BLOB_PATH}" || true
echo
echo "Peso actual del repositorio:"
du -sh .git
echo

if [ "${APLICAR}" != "--aplicar" ]; then
  cat <<'EOF'
Simulación: no se ha modificado nada.

Para aplicarlo:
  1. Haz una copia de seguridad:  git clone --mirror . ../poc_fundae-backup.git
  2. Ejecuta:                     bash scripts/purgar-historial.sh --aplicar
  3. Revisa el resultado:         git log --all --oneline
  4. Sube el historial reescrito: git push --force --all && git push --force --tags
  5. Avisa a quien tenga un clon: debe volver a clonar, no hacer pull.

Recuerda además, en GitHub:
  - Pasar el repositorio a privado (Settings → General → Danger Zone).
  - Los forks y las copias en caché de GitHub pueden conservar el blob; si el
    contenido es de un cliente, abre un ticket en GitHub Support para que
    purguen la caché tras el force-push.
EOF
  exit 0
fi

if ! git filter-repo --version >/dev/null 2>&1; then
  cat <<'EOF'
Falta git-filter-repo. Instálalo con una de estas:

  pipx install git-filter-repo
  pip install --user git-filter-repo
  brew install git-filter-repo
  apt install git-filter-repo
EOF
  exit 1
fi

git filter-repo --force --invert-paths --path "${BLOB_PATH}"

echo
echo "Historial reescrito. Peso ahora:"
du -sh .git
echo
echo "Siguiente paso (revísalo antes de ejecutarlo):"
echo "  git remote add origin <url>   # filter-repo elimina el remoto por seguridad"
echo "  git push --force --all && git push --force --tags"
