#!/bin/sh
# Builds dist/ from app/, stamping the git sha of HEAD into the page (meta + footer).
set -e
cd "$(dirname "$0")/.."
SHA=$(git rev-parse --short=12 HEAD)
rm -rf dist && mkdir dist && cp -R app/. dist/
[ -d proof ] && cp -R proof dist/proof
sed -i.bak "s/__BUILD_SHA__/$SHA/g" dist/index.html && rm dist/index.html.bak
echo "built $SHA"
