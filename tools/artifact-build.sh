#!/bin/sh
# Construit une copie du jeu publiable comme page de test (sans service worker, sans secrets).
# Usage : sh tools/artifact-build.sh <dossier de sortie> "<titre>"
set -e
OUT="$1"; TITLE="$2"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r js css icons "$OUT"/
rm -f "$OUT/js/secrets.js"
python3 - "$OUT" "$TITLE" <<'PY'
import sys, re
out, title = sys.argv[1], sys.argv[2]
s = open('index.html', encoding='utf8').read()
for t in ['<!doctype html>', '<html lang="fr">', '<head>', '</head>', '<body>', '</body>', '</html>']:
    s = s.replace(t, '', 1)
s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, s, count=1)
s = re.sub(r'<script src="js/secrets.js"></script>[^\n]*\n', '', s)
s = re.sub(r'<link rel="manifest"[^>]*>\n', '', s)
open(out + '/index.html', 'w', encoding='utf8').write(s.strip() + '\n')
PY
# pas de service worker dans une page de test (il garderait d'anciennes versions en cache)
sed -i "s/if ('serviceWorker' in navigator && secure)/if (false \&\& 'serviceWorker' in navigator \&\& secure)/" "$OUT/js/pwa.js"
grep -q "if (false && 'serviceWorker'" "$OUT/js/pwa.js"
