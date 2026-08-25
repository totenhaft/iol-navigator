#!/usr/bin/env bash
# ---------------------------------------------------------------
# IOL 내비게이터 — GitHub 업로드 (맥/리눅스에서 실행)
#
#   실행:  bash setup.sh
#
# 저장소가 이미 있으면 git 만으로 올립니다 (gh 설치 불필요).
# 저장소가 없고 gh 가 설치돼 있으면 저장소도 만들어 줍니다.
# ---------------------------------------------------------------
set -euo pipefail

REPO_NAME="iol-navigator"
BRANCH="main"

say() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()  { printf "  \033[32m✓\033[0m %s\n" "$1"; }
die() { printf "\n\033[1;31m✗ %s\033[0m\n\n" "$1" >&2; exit 1; }

cd "$(dirname "$0")"

say "준비물 확인"
command -v git >/dev/null || die "git 이 없습니다.  xcode-select --install  을 먼저 실행하세요."
ok "git 있음"

# --- 계정 이름 알아내기 -------------------------------------------
USER_LOGIN="${GITHUB_USER:-}"
if [ -z "$USER_LOGIN" ] && command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  USER_LOGIN=$(gh api user --jq .login 2>/dev/null || true)
fi
if [ -z "$USER_LOGIN" ]; then
  read -r -p "  GitHub 계정 이름을 입력하세요: " USER_LOGIN
fi
[ -n "$USER_LOGIN" ] || die "계정 이름이 필요합니다."
ok "계정: $USER_LOGIN"

REMOTE="https://github.com/$USER_LOGIN/$REPO_NAME.git"

# --- 저장소 존재 확인 ---------------------------------------------
say "저장소 확인"
if GIT_TERMINAL_PROMPT=0 git ls-remote "$REMOTE" >/dev/null 2>&1; then
  ok "저장소가 있습니다: $USER_LOGIN/$REPO_NAME"
elif command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh repo create "$USER_LOGIN/$REPO_NAME" --public \
    --description "근거 기반 백내장 인공수정체(IOL) 선택 보조 도구 — 임상 의사결정 보조, 의료기기 아님" \
    --disable-wiki
  ok "저장소를 만들었습니다"
else
  cat <<MSG

  저장소가 아직 없습니다. 브라우저에서 30초면 만들 수 있습니다.

    https://github.com/new
      Repository name : $REPO_NAME
      공개 범위        : Public
      README / .gitignore / license  →  모두 체크 해제

  만든 뒤 이 스크립트를 다시 실행하세요:  bash setup.sh

MSG
  exit 1
fi

# --- 커밋 ----------------------------------------------------------
say "코드 준비"
[ -d .git ] || { git init -q; ok "git 저장소 초기화"; }
git symbolic-ref HEAD "refs/heads/$BRANCH" 2>/dev/null || git branch -M "$BRANCH" 2>/dev/null || true

if grep -q "YOUR-USERNAME" README.md 2>/dev/null; then
  sed -i.bak "s/YOUR-USERNAME/$USER_LOGIN/g" README.md && rm -f README.md.bak
  ok "README 주소를 $USER_LOGIN 으로 수정"
fi

git add -A
if git rev-parse HEAD >/dev/null 2>&1 && git diff --cached --quiet; then
  ok "이미 커밋되어 있습니다"
else
  git commit -q -m "IOL 내비게이터 — 근거 기반 인공수정체 선택 보조 도구

환자 설문 모드와 전문가 정밀 입력 모드, 금기/주의/선호 3계층 의사결정 로직,
19건의 문헌 근거와 근거 수준 표시. 브라우저 안에서만 동작하며 데이터를 전송하지 않음.

임상 의사결정 보조 도구이며 의료기기가 아님."
  ok "커밋 완료"
fi

# --- 업로드 --------------------------------------------------------
say "업로드"
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$REMOTE" || git remote add origin "$REMOTE"

cat <<'MSG'
  비밀번호를 물어보면 GitHub 계정 비밀번호가 아니라
  발급받은 토큰(github_pat_... )을 붙여넣으세요.
  Username 은 GitHub 계정 이름입니다.
  (맥이라면 한 번만 입력하면 키체인에 저장되어 다음부터는 안 물어봅니다)

MSG
git push -u origin "$BRANCH"
ok "업로드 완료"

cat <<MSG

────────────────────────────────────────────────────────────
 완료했습니다.

 저장소   https://github.com/$USER_LOGIN/$REPO_NAME
 웹사이트 https://$USER_LOGIN.github.io/$REPO_NAME/
 진행상황 https://github.com/$USER_LOGIN/$REPO_NAME/actions

 웹사이트는 자동 빌드·테스트를 거쳐 1~3분 뒤에 열립니다.
 GitHub Pages 는 워크플로가 스스로 켜므로 따로 설정할 필요가 없습니다.

 앞으로 코드를 고칠 때:
   src/ 안의 파일 수정  →  npm run build  →  git add -A
   →  git commit -m "설명"  →  git push
────────────────────────────────────────────────────────────

MSG
