#!/usr/bin/env bash
# Lyfter ut piches/ till ett eget repo med git-historiken bevarad.
#
# Varfor det har skriptet finns: den har koden skrevs inuti Learnnd-repot
# (remix-of-hudterapeutens-l-rlingsguide) eftersom Claude Code-sessionen som
# byggde den bara hade skrivratt dit -- GitHub-integrationen kan inte skapa
# nya repon (bekraftat: 403 fran bade repos-api och forks-api). Sa fort
# Linn3213/Piches finns pa github.com kor du det har for att flytta ut mappen.
#
# Krav: git, och natverksatkomst (eller en Claude-session dar Piches ar
# tillagd via add_repo) for sjalva push:en.
#
# Anvandning, fran repo-roten (remix-of-hudterapeutens-l-rlingsguide):
#   piches/scripts/lyft-till-eget-repo.sh [remote-url]
#
# Standard remote-url ar https, byt till ssh om du foredrar det:
#   piches/scripts/lyft-till-eget-repo.sh git@github.com:Linn3213/Piches.git

set -euo pipefail

REMOTE_URL="${1:-https://github.com/Linn3213/Piches.git}"
BRANCH="piches-standalone"

if [ ! -d piches ]; then
  echo "Kor det har skriptet fran repo-roten (dar mappen piches/ ligger)." >&2
  exit 1
fi

git subtree split --prefix=piches -b "$BRANCH"
git push "$REMOTE_URL" "$BRANCH":main
git branch -D "$BRANCH"

echo "Klart. Piches ligger nu i $REMOTE_URL pa branchen main."
echo "Nasta steg: klona det nya repot, kor npm install, kopiera .env.example till .env.local,"
echo "kor supabase/migrations/0001_init.sql mot ett Supabase-projekt, npm run dev."
