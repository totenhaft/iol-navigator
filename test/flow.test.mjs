/** 세 역할을 잇는 흐름 검증 — 환자 → 상담 → 의사
 *
 *  이 도구에서 가장 조용히 망가지기 쉬운 곳이 인계입니다. 코드가 잘못 만들어져도
 *  화면에는 그럴듯한 문자열이 뜨고, 받는 쪽에서 값이 몇 개 빠져도 결과는 그냥
 *  나옵니다. 그래서 '코드를 만들었다'가 아니라 '넘긴 값이 실제로 같은 결과를
 *  만드는가'까지 확인합니다.
 */
import { launch, pageURL, isRealError } from "./browser.mjs";

const wait = (p, ms) => p.waitForTimeout(ms);

export default async function run(){
  const browser = await launch();
  const ctx = await browser.newContext({ viewport:{width:1440, height:900} });
  let fail = 0;
  const errors = [];
  const ok = (name, cond, detail) => {
    if (cond) console.log("  PASS  " + name);
    else { fail++; console.log("  FAIL  " + name + (detail ? "  →  " + detail : "")); }
  };

  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error" && isRealError(m.text())) errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));

  await page.goto(pageURL, { waitUntil:"load" });
  await wait(page, 300);

  /* ---- 환자 화면에서 입력 ---- */
  await page.fill("#f_age", "71");
  await page.selectOption("#f_macula", "amd_intermediate");
  await page.selectOption("#f_astigKnown", "lots");
  await page.click('label[for="f_nightDriving_3"]');   // 라디오 자체는 시각적으로 숨겨져 있어 라벨을 누릅니다
  await page.check("#c_nightWork");
  await page.click("#runBtn");
  await wait(page, 400);

  const beforeTop = await page.evaluate(() => state.last.top.id);
  ok("환자 화면에서 결과가 나온다", !!beforeTop, String(beforeTop));

  ok("환자 화면에는 근거 문헌 카드를 띄우지 않는다",
     await page.evaluate(() => document.querySelector("#refCard").hidden));

  /* ---- 인계 코드 만들기 ---- */
  await page.click("#handoffBtn");
  await wait(page, 250);
  const code = (await page.textContent("#handoffCode")).trim();
  ok("인계 코드가 만들어진다", /^[0-9A-Z-]{5,}$/.test(code), code);
  ok("인계 패널에 QR 이 그려진다", await page.evaluate(() => !!document.querySelector(".qrbox svg")));
  ok("인계 코드에 개인정보 입력란이 없다",
     await page.evaluate(() => !document.querySelector('#formSections input[type="text"]')));

  /* ---- 잘못된 코드는 거부하고 기존 입력을 지우지 않는다 ---- */
  await page.fill("#handoffIn", "ZZZZ-ZZZZ-ZZZZ");
  await page.click(".loadrow button");
  await wait(page, 200);
  const msg = await page.textContent("#handoffMsg");
  ok("잘못된 코드는 사유와 함께 거부된다", !!msg && msg.length > 3, msg);
  ok("잘못된 코드를 넣어도 기존 입력이 남아 있다",
     await page.evaluate(() => state.values.age === "71" || state.values.age === 71));

  /* ---- 상담 화면에서 코드 불러오기 (새 탭 = 다른 기기 가정) ---- */
  const page2 = await ctx.newPage();
  page2.on("pageerror", e => errors.push(e.message));
  await page2.goto(pageURL, { waitUntil:"load" });
  await wait(page2, 300);
  /* 상담 화면은 잠겨 있다 — 처음 열 때 비밀번호를 정하게 한다 */
  await page2.click("#role_counselor");
  await wait(page2, 300);
  ok("상담 화면을 누르면 잠금 화면이 뜬다",
     await page2.evaluate(() => !document.querySelector("#pwOvl").hidden && state.role === "patient"));
  await page2.fill("#pwIn", "clinic1234");
  await page2.fill("#pwIn2", "clinic1234");
  await page2.click("#pwOvl .btn.primary");
  await wait(page2, 400);
  ok("비밀번호를 정하면 상담 화면으로 들어간다",
     await page2.evaluate(() => document.querySelector("#pwOvl").hidden && state.role === "counselor"));
  await page2.click("#handoffBtn");
  await wait(page2, 200);
  await page2.fill("#handoffIn", code.toLowerCase());          // 소문자로 넣어도 읽혀야 함
  await page2.click(".loadrow button");
  await wait(page2, 300);

  const got = await page2.evaluate(() => ({
    age: String(state.values.age),
    macula: state.values.macula,
    astig: state.values.astigKnown,
    night: String(state.values.nightDriving),
    nightWork: state.values.nightWork === true,
  }));
  ok("넘긴 값이 그대로 복원된다",
     got.age === "71" && got.macula === "amd_intermediate" && got.astig === "lots" &&
     got.night === "3" && got.nightWork, JSON.stringify(got));

  await page2.evaluate(() => closeHandoff());
  await page2.click("#runBtn");
  await wait(page2, 400);
  const afterTop = await page2.evaluate(() => state.last.top.id);
  ok("같은 값이면 같은 1순위가 나온다", afterTop === beforeTop, `${beforeTop} → ${afterTop}`);

  ok("상담 화면에는 선택 확인 카드가 있다",
     await page2.evaluate(() => !!document.querySelector("#decisionSel")));
  ok("상담 화면에는 렌즈 설명 표가 있다",
     await page2.evaluate(() => !!document.querySelector("table.guide")));
  ok("상담 화면에는 계측값 입력이 있다",
     await page2.evaluate(() => !!document.querySelector("#f_cylD") && !!document.querySelector("#f_al")));
  ok("상담 화면에는 판독이 필요한 항목(소대·불규칙난시)을 두지 않는다",
     await page2.evaluate(() => !document.querySelector("#f_zonule") && !document.querySelector("#c_irregularAstig")));

  /* 계측 난시를 넣으면 문진 기반 추정이 실제 값으로 바뀐다 */
  await page2.fill("#f_cylD", "0.4");
  await wait(page2, 600);
  const astig = await page2.evaluate(() => ({est: state.last.d.astigEstimated, cyl: state.last.d.cylD}));
  ok("계측 난시가 들어오면 추정 대신 실측값을 쓴다", astig.est === false && astig.cyl === 0.4, JSON.stringify(astig));

  /* ---- 링크(#h=) 로 여는 경로 ---- */
  const page3 = await ctx.newPage();
  page3.on("pageerror", e => errors.push(e.message));
  await page3.goto(pageURL + "#h=" + code, { waitUntil:"load" });
  await wait(page3, 400);
  ok("링크로 열어도 값이 채워진다",
     await page3.evaluate(() => String(state.values.age) === "71" && state.values.macula === "amd_intermediate"));

  /* ---- 의사 화면 ---- */
  await page3.evaluate(() => markUnlocked(true));   // 잠금은 앞에서 따로 검증한다
  await page3.click("#role_doctor");
  await wait(page3, 300);
  await page3.click("#runBtn");
  await wait(page3, 400);
  ok("의사 화면에는 근거 문헌과 용어 체계가 보인다",
     await page3.evaluate(() => !document.querySelector("#refCard").hidden && !document.querySelector("#taxonomyCard").hidden));
  ok("의사 화면에는 정밀 입력 항목이 있다",
     await page3.evaluate(() => !!document.querySelector("#f_zonule") && !!document.querySelector("#c_toricPlanned")));
  ok("역할을 바꿔도 입력값이 유지된다",
     await page3.evaluate(() => String(state.values.age) === "71"));

  /* ---- 환자 배부용 A5 결과지 ----
     "A5에 맞췄다"는 눈으로는 확인이 안 됩니다. 실제로 A5 PDF 로 뽑아
     페이지가 하나인지 세어 봅니다. 두 장이 되면 실패입니다. */
  await page3.evaluate(() => {
    window.__printed = 0;
    window.print = () => { window.__printed++; };
  });
  await page3.click("#a5Btn");
  /* afterprint 가 오지 않는 환경(여기서는 print 를 가로챘으므로)에서도
     되돌아와야 하므로, 대비용 타이머(1.5초)가 도는 것까지 기다립니다. */
  await wait(page3, 2000);
  const a5 = await page3.evaluate(() => ({
    printed: window.__printed,
    rule: document.getElementById("pageRule").textContent,
    text: document.querySelector("#a5sheet").textContent,
  }));
  ok("환자용 결과지 버튼이 인쇄를 부른다", a5.printed >= 1, String(a5.printed));
  ok("결과지에 병원명과 추천 유형이 들어 있다",
     a5.text.includes("연세솔안과") && a5.text.includes("인공수정체 상담 결과지"));
  ok("결과지에 점수·규칙번호 같은 내부 표현을 넣지 않는다",
     !/적합도|Grade\s[ABCD]|R1[0-9]?\b/.test(a5.text));
  ok("인쇄가 끝나면 용지 규칙이 A4 로 되돌아온다", /A4/.test(a5.rule), a5.rule);

  await page3.evaluate(() => {
    const host = document.getElementById("a5sheet");
    host.textContent = "";
    host.appendChild(buildA5(state.last));
    document.body.classList.add("print-a5");
  });
  const pdf = await page3.pdf({
    format: "A5", printBackground: true,
    margin: { top: "9mm", bottom: "9mm", left: "9mm", right: "9mm" },
  });
  const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok("환자용 결과지가 A5 한 장에 들어간다", pageCount === 1, `${pageCount} 장`);
  await page3.evaluate(() => document.body.classList.remove("print-a5"));

  /* ---- 환자에게 금액이 새지 않는가 ----
     화면 안에 '만원' 이라는 글자가 보이면 어딘가에서 금액이 새고 있다는 뜻이다. */
  const page4 = await ctx.newPage();
  page4.on("pageerror", e => errors.push(e.message));
  await page4.goto(pageURL, { waitUntil:"load" });
  await wait(page4, 300);
  await page4.fill("#f_age", "68");
  await page4.click('label[for="f_specIndep_2"]');
  await page4.click('label[for="f_costSensitivity_2"]');
  await page4.selectOption("#f_astigKnown", "lots");
  await page4.click("#runBtn");
  await wait(page4, 700);
  const patientText = await page4.evaluate(() => document.querySelector("main").innerText);
  ok("환자 화면에 금액이 나오지 않는다", !/만원|₩/.test(patientText),
     (patientText.match(/[^\n]*만원[^\n]*/) || [""])[0].slice(0, 60));
  ok("환자 화면에도 예산 안내 문구 자체는 남는다", /비용에 대한 답/.test(patientText));

  await page4.evaluate(() => {
    const h = document.getElementById("a5sheet");
    h.textContent = ""; h.appendChild(buildA5(state.last));
  });
  const a5Text = await page4.evaluate(() => document.querySelector("#a5sheet").innerText);
  ok("환자 배부용 A5 결과지에도 금액이 없다", !/만원|₩/.test(a5Text),
     (a5Text.match(/[^\n]*만원[^\n]*/) || [""])[0].slice(0, 60));

  await page4.evaluate(() => { markUnlocked(true); });
  await page4.click("#role_counselor");
  await wait(page4, 300);
  await page4.click("#runBtn");
  await wait(page4, 600);
  const counselorText = await page4.evaluate(() => document.querySelector("main").innerText);
  ok("상담 화면에는 금액이 그대로 보인다", /만원/.test(counselorText));

  /* ?patient 로 열면 역할을 바꿀 수 없어야 한다 */
  const page5 = await ctx.newPage();
  page5.on("pageerror", e => errors.push(e.message));
  await page5.goto(pageURL + "?patient", { waitUntil:"load" });
  await wait(page5, 400);
  ok("?patient 로 열면 역할 버튼이 감춰진다",
     await page5.evaluate(() => document.querySelector("#roleSeg").hidden));
  ok("?patient 로 열면 역할을 바꿔도 환자 화면에 머문다",
     await page5.evaluate(() => { setRole("counselor"); return state.role === "patient"; }));

  /* ---- 설정 화면 ---- */
  /* 저장소가 깨끗한 새 브라우저에서 — 앞 탭들과 localStorage 를 공유하면
     비밀번호가 이미 설정된 상태가 되어 '처음 설정' 흐름을 볼 수 없다. */
  const ctx2 = await browser.newContext({ viewport:{width:1440, height:1000} });
  const page6 = await ctx2.newPage();
  page6.on("pageerror", e => errors.push(e.message));
  await page6.goto(pageURL, { waitUntil:"load" });
  await wait(page6, 300);
  await page6.click("#setBtn");
  await wait(page6, 300);
  ok("설정도 비밀번호를 요구한다",
     await page6.evaluate(() => !document.querySelector("#pwOvl").hidden && document.querySelector("#setOvl").hidden));
  await page6.fill("#pwIn", "abcd1234");
  await page6.fill("#pwIn2", "abcd1234");
  await page6.click("#pwOvl .btn.primary");
  await wait(page6, 500);
  ok("비밀번호를 정하면 설정 화면이 열린다",
     await page6.evaluate(() => !document.querySelector("#setOvl").hidden));
  ok("비밀번호는 평문으로 저장되지 않는다",
     await page6.evaluate(() => {
       const raw = localStorage.getItem("iolnav-settings-v1") || "";
       return raw.indexOf("abcd1234") === -1 && /"hash":"/.test(raw);
     }));

  /* 금액과 조정값을 고치면 판정이 따라 바뀐다 */
  const beforeTri = await page6.evaluate(() => {
    state.role = "doctor";
    return evaluate({age:68, bilateral:"yes", macula:"normal", glaucoma:"none", dr:"none",
      cornea:"normal", osd:"none", zonule:"stable", priorRefSx:"none", hoaZone:"4",
      specIndep:"3", nearPriority:"2", interPriority:"2", costSensitivity:"3", toricPlanned:true},
      "doctor").scored.find(x => x.id === "trifocal").score;
  });
  await page6.fill("#set_cmin_trifocal", "25");
  await page6.fill("#set_cmax_trifocal", "25");
  await page6.fill("#set_t_cutComa", "0.99");
  await page6.click("#setSaveBtn");
  await wait(page6, 400);
  const afterTri = await page6.evaluate(() => evaluate({age:68, bilateral:"yes", macula:"normal",
      glaucoma:"none", dr:"none", cornea:"normal", osd:"none", zonule:"stable", priorRefSx:"none",
      hoaZone:"4", specIndep:"3", nearPriority:"2", interPriority:"2", costSensitivity:"3",
      toricPlanned:true}, "doctor").scored.find(x => x.id === "trifocal").score);
  ok("설정에서 금액을 바꾸면 점수가 따라 바뀐다", afterTri > beforeTri, beforeTri + " → " + afterTri);
  ok("설정에서 검사 임계값을 바꾸면 규칙 발동이 바뀐다",
     await page6.evaluate(() => {
       const base = {age:68, bilateral:"yes", macula:"normal", glaucoma:"none", dr:"none",
         cornea:"normal", osd:"none", zonule:"stable", priorRefSx:"none", hoaZone:"4",
         cornealComa:0.45, specIndep:"3"};
       return evaluate(base, "doctor").fired.indexOf("coma_high") === -1;   // 기준을 0.99 로 올렸으므로 미발동
     }));

  /* 기본값 되돌리기 */
  await page6.click("#setResetBtn");
  await wait(page6, 400);
  ok("기본값으로 되돌리면 조정값이 복원된다",
     await page6.evaluate(() => TU("cutComa") === TUNING_DEFAULT.cutComa));
  ok("되돌려도 비밀번호는 남는다", await page6.evaluate(() => pwIsSet()));

  /* ?patient 화면에서는 설정을 열 수 없다 */
  const page7 = await ctx2.newPage();
  page7.on("pageerror", e => errors.push(e.message));
  await page7.goto(pageURL + "?patient", { waitUntil:"load" });
  await wait(page7, 400);
  await page7.click("#setBtn");
  await wait(page7, 300);
  ok("?patient 화면에서는 설정이 열리지 않는다",
     await page7.evaluate(() => document.querySelector("#pwOvl").hidden && document.querySelector("#setOvl").hidden));

  if (errors.length){ fail += errors.length; console.log("  FAIL  자바스크립트 오류\n    " + errors.join("\n    ")); }
  else console.log("  PASS  자바스크립트 오류 없음");

  await browser.close();
  return { name:"역할 전환과 인계", failures: fail };
}
