/** 화면 검증 — '결과 보기' 버튼이 모든 화면 크기와 스크롤 위치에서
 *  실제로 보이고 눌리는지 확인합니다.
 *  (2026-08 회귀: sticky 레일의 max-height 계산 때문에 버튼이 화면 밖으로 밀려났던 문제) */
import { launch, pageURL, isRealError } from "./browser.mjs";

const VIEWPORTS = [
  { label: "작은 모바일", w: 360, h: 640 },
  { label: "모바일",      w: 390, h: 844 },
  { label: "태블릿",      w: 834, h: 1112 },
  { label: "짧은 노트북", w: 1280, h: 560 },
  { label: "노트북",      w: 1440, h: 700 },
  { label: "데스크톱",    w: 1440, h: 900 },
];
const SPOTS = ["최상단", "폼 중간", "폼 하단", "페이지 끝"];


/** 페이지를 맨 아래까지 내리고, 스크롤 위치가 더 이상 변하지 않을 때까지 기다립니다.
 *  (smooth scroll 애니메이션이 진행 중이면 측정값이 흔들립니다) */
async function settleAtBottom(page) {
  for (let i = 0; i < 25; i++) {
    const moved = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      return Math.abs(window.scrollY - before) > 1;
    });
    await page.waitForTimeout(80);
    if (!moved) return;
  }
}


/** 입력 섹션이 flex 로 찌그러지지 않았는지 확인합니다.
 *  2026-08 회귀: #formSections 를 flex 컬럼으로 바꾸면서 flex-shrink 기본값(1) 때문에
 *  섹션 카드가 눌리고 overflow:hidden 으로 입력 필드가 잘려 나갔습니다.
 *  스크롤조차 생기지 않아 사용자가 값을 넣을 수 없었습니다. */
async function checkFieldsUsable(page) {
  return page.evaluate(() => {
    const problems = [];
    const inner = document.querySelector("#formSections");

    // 1) 열린 섹션이 자기 내용만큼의 높이를 갖는지
    for (const d of document.querySelectorAll("details.sect[open]")) {
      const body = d.querySelector(".sect-b");
      if (!body) continue;
      const summary = d.querySelector("summary");
      const needed = body.scrollHeight + summary.offsetHeight;
      const actual = d.getBoundingClientRect().height;
      if (actual < needed - 4) {
        const title = summary.textContent.trim().slice(0, 20);
        problems.push(`"${title}" 눌림 ${Math.round(actual)}<${Math.round(needed)}px`);
      }
    }

    // 접힌 섹션 안의 컨트롤은 애초에 보이지 않으므로 검사 대상이 아닙니다.
    const visibleIn = sel => [...inner.querySelectorAll(sel)]
      .filter(e => e.closest("details.sect") === null || e.closest("details.sect").open);

    // 2) 내용이 넘치면 스크롤이 실제로 가능해야 함
    if (inner.scrollHeight <= inner.clientHeight + 2) {
      const controls = visibleIn("select, input, .scale").length;
      if (controls > 8 && inner.clientHeight < 2000) {
        problems.push(`스크롤 없음 (컨트롤 ${controls}개가 ${inner.clientHeight}px 안에?)`);
      }
    }

    // 3) 스크롤을 끝까지 내리면 마지막 컨트롤에 닿아야 함
    inner.scrollTop = inner.scrollHeight;
    const all = visibleIn("select, input[type=number], .scale, .chk");
    const last = all[all.length - 1];
    if (last) {
      const ib = inner.getBoundingClientRect(), lb = last.getBoundingClientRect();
      if (lb.bottom > ib.bottom + 4 || lb.top < ib.top - 4) problems.push("마지막 입력 항목에 도달 불가");
    }
    inner.scrollTop = 0;

    // 4) 클릭 대상이 너무 작지 않은지 (고령 사용자 배려)
    const small = visibleIn(".scale span, select, input[type=number]")
      .filter(e => e.getBoundingClientRect().height < 34).length;
    if (small > 0) problems.push(`클릭 영역 34px 미만 ${small}개`);

    return problems;
  });
}

export default async function run() {
  const browser = await launch();
  let failures = 0;

  for (const v of VIEWPORTS) {
    for (const role of ["patient", "counselor", "doctor"]) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", m => { if (m.type() === "error" && isRealError(m.text())) errors.push(m.text()); });
      page.on("pageerror", e => errors.push(e.message));

      await page.goto(pageURL, { waitUntil: "load" });
      await page.waitForTimeout(300);
      if (role !== "patient") {
        // 상담·의사 화면은 비밀번호로 잠겨 있다. 화면 배치를 보는 테스트이므로 잠금만 풀고 들어간다.
        await page.evaluate(() => markUnlocked(true));
        await page.click("#role_" + role);
        await page.waitForTimeout(250);
      }

      const bad = [];
      for (const spot of SPOTS) {
        await page.evaluate((s) => {
          const rail = document.querySelector(".rail");
          const inner = document.querySelector("#formSections");
          const scrolls = getComputedStyle(inner).overflowY === "auto";
          if (s === "최상단") { scrollTo(0, 0); if (scrolls) inner.scrollTop = 0; }
          if (s === "폼 중간") { if (scrolls) inner.scrollTop = inner.scrollHeight / 2; else scrollTo(0, document.body.scrollHeight * 0.15); }
          if (s === "폼 하단") { if (scrolls) inner.scrollTop = inner.scrollHeight; else scrollTo(0, rail.getBoundingClientRect().height * 0.8); }
          if (s === "페이지 끝") scrollTo(0, document.documentElement.scrollHeight);
        }, spot);
        await page.waitForTimeout(160);

        const r = await page.evaluate(() => {
          const n = document.querySelector("#runBtn");
          if (!n) return { visible: false, clickable: false };
          const cs = getComputedStyle(n);
          if (cs.display === "none" || cs.visibility === "hidden") return { visible: false, clickable: false };
          const b = n.getBoundingClientRect();
          const visible = b.top >= -2 && b.bottom <= innerHeight + 2 && b.left >= -2 && b.right <= innerWidth + 2;
          const hit = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
          return { visible, clickable: !!hit && (hit === n || n.contains(hit)) };
        });
        if (!r.visible || !r.clickable) bad.push(`${spot}(${!r.visible ? "화면 밖" : "가려짐"})`);
      }

      // 고정 액션바가 푸터를 덮지 않는지.
      // 결과 표시 시 부드러운 스크롤이 걸리므로, 스크롤이 멈춘 뒤에 측정합니다.
      await page.click("#runBtn");
      await page.waitForTimeout(500);
      await settleAtBottom(page);
      const overlap = await page.evaluate(() => {
        const el = document.querySelector(".actions");
        if (getComputedStyle(el).position !== "fixed") return false;   // 데스크톱은 해당 없음
        const a = el.getBoundingClientRect();
        const f = document.querySelector("footer.foot").getBoundingClientRect();
        return f.bottom > a.top + 1;
      });
      if (overlap) bad.push("액션바가 푸터를 가림");

      // 입력 필드가 실제로 쓸 수 있는 상태인지
      const fieldProblems = await checkFieldsUsable(page);
      bad.push(...fieldProblems);
      if (errors.length) bad.push(`JS 오류 ${errors.length}건`);

      const ok = bad.length === 0;
      if (!ok) failures++;
      const roleKo = { patient: "환자", counselor: "상담", doctor: "의사" }[role];
      console.log(`  ${ok ? "PASS" : "FAIL"}  ${v.label} ${v.w}×${v.h} / ${roleKo} 화면` +
                  (ok ? "" : "  →  " + bad.join(", ")));
      await ctx.close();
    }
  }

  await browser.close();
  return { name: "화면 · 버튼 접근성", failures };
}
