#!/usr/bin/env bash
# One-time publish to GitHub Pages once `gh auth login` is done on this machine.
set -euo pipefail
cd "$(dirname "$0")"
OWNER=$(gh api user -q .login)
REPO=hp-owl-games
[ -d .git ] || { git init -q -b main; git add -A; git commit -qm "Owl Post Games: 3 prototypes"; }
gh repo view "$OWNER/$REPO" >/dev/null 2>&1 || gh repo create "$OWNER/$REPO" --public --description "Owl Post Games - Hedwig & Pigwidgeon browser games for kids" --source . --push
git push -u origin main 2>/dev/null || true
gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true
echo "Repo:  https://github.com/$OWNER/$REPO"
echo "Pages: https://$OWNER.github.io/$REPO/  (first build takes ~1 min)"
