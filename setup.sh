#!/usr/bin/env bash
# ---------------------------------------------------------------
# IOL 내비게이터 — GitHub 업로드 + 웹사이트 공개 (한 번만 실행)
#
#   실행:  bash setup.sh
#
# 하는 일
#   1. GitHub 로그인 확인 (안 돼 있으면 브라우저로 로그인)
#   2. 저장소 iol-navigator 생성 (공개)
#   3. 코드 업로드
#   4. GitHub Pages 켜기 → 웹 주소 출력
# ---------------------------------------------------------------
set -euo pipefail

REPO_NAME="iol-navigator"
BRANCH="main"

say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
die()  { printf "\n\033[1;31m✗ %s\033[0m\n\n" "$1" >&2; exit 1; }

cd "$(dirname "$0")"

# --- 1. 준비물 확인 -------------------------------------------------
say "준비물 확인"
command -v git >/dev/null || die "git 이 없습니다.  xcode-select --install  을 먼저 실행하세요."
ok "git 있음"

if ! command -v gh >/dev/null; then
  cat <<'MSG'

  GitHub CLI(gh)가 없습니다. 아래 중 하나로 설치하세요.

    brew install gh              # Homebrew 가 있으면 이게 가장 간단합니다
    https://cli.github.com       # 없으면 이 주소에서 설치 파일을 받으세요

  설치한 뒤 이 스크립트를 다시 실행하세요:  bash setup.sh

MSG
  exit 1
fi
ok "gh 있음"

# --- 2. 로그인 ------------------------------------------------------
say "GitHub 로그인 확인"
if ! gh auth status >/dev/null 2>&1; then
  echo "  로그인이 필요합니다. 브라우저가 열립니다."
  echo "  (질문이 나오면: GitHub.com → HTTPS → Y → Login with a web browser)"
  gh auth login
fi
USER_LOGIN=$(gh api user --jq .login)
ok "로그인됨: $USER_LOGIN"

# --- 3. 저장소 만들기 ----------------------------------------------
say "저장소 준비"
if gh repo view "$USER_LOGIN/$REPO_NAME" >/dev/null 2>&1; then
  ok "이미 있는 저장소를 사용합니다: $USER_LOGIN/$REPO_NAME"
else
  gh repo create "$USER_LOGIN/$REPO_NAME" \
    --public \
    --description "근거 기반 백내장 인공수정체(IOL) 선택 보조 도구 — 임상 의사결정 보조, 의료기기 아님" \
    --disable-wiki
  ok "만들었습니다: $USER_LOGIN/$REPO_NAME"
fi

# --- 4. 업로드 ------------------------------------------------------
say "코드 업로드"
[ -d .git ] || { git init -q; ok "git 저장소 초기화"; }
git symbolic-ref HEAD "refs/heads/$BRANCH" 2>/dev/null || true

# README 안의 자리표시자를 실제 계정 이름으로 바꿉니다
if grep -q "YOUR-USERNAME" README.md 2>/dev/null; then
  sed -i.bak "s/YOUR-USERNAME/$USER_LOGIN/g" README.md && rm -f README.md.bak
  ok "README 주소를 $USER_LOGIN 으로 수정"
fi

git add -A
if git diff --cached --quiet 2>/dev/null && git rev-parse HEAD >/dev/null 2>&1; then
  ok "변경 사항 없음"
else
  git commit -q -m "IOL 내비게이터 — 근거 기반 인공수정체 선택 보조 도구

환자 설문 모드와 전문가 정밀 입력 모드, 금기/주의/선호 3계층 의사결정 로직,
19건의 문헌 근거와 근거 수준 표시. 브라우저 안에서만 동작하며 데이터를 전송하지 않음.

임상 의사결정 보조 도구이며 의료기기가 아님."
  ok "커밋 완료"
fi

git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$USER_LOGIN/$REPO_NAME.git"
git push -u origin "$BRANCH" --force-with-lease 2>/dev/null || git push -u origin "$BRANCH"
ok "업로드 완료"

# --- 5. 웹사이트 켜기 ----------------------------------------------
say "GitHub Pages 켜기"
if gh api "repos/$USER_LOGIN/$REPO_NAME/pages" >/dev/null 2>&1; then
  ok "이미 켜져 있습니다"
else
  if gh api --method POST "repos/$USER_LOGIN/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1; then
    ok "켰습니다"
  else
    echo "  여기서는 못 켰지만, 워크플로가 실행되면서 스스로 켭니다."
    echo "  1~3분 뒤에도 안 열리면 여기서 확인하세요:"
    echo "    https://github.com/$USER_LOGIN/$REPO_NAME/settings/pages"
  fi
fi

cat <<MSG

────────────────────────────────────────────────────────────
 완료했습니다.

 저장소   https://github.com/$USER_LOGIN/$REPO_NAME
 웹사이트 https://$USER_LOGIN.github.io/$REPO_NAME/
 진행상황 https://github.com/$USER_LOGIN/$REPO_NAME/actions

 웹사이트는 자동 빌드·테스트를 거쳐 1~3분 뒤에 열립니다.
 (테스트가 실패하면 배포되지 않습니다 — 의도된 동작입니다.)

 앞으로 코드를 고칠 때:
   src/ 안의 파일을 고치고  →  npm run build  →  git add -A
   →  git commit -m "설명"  →  git push
 푸시하면 웹사이트가 자동으로 갱신됩니다.
────────────────────────────────────────────────────────────

MSG
