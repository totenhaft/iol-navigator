/* ------------------------------------------------------------------
   자체 검증 — ?test=1 로 실행하거나 콘솔에서 runSelfTests()
   ------------------------------------------------------------------ */
function baseInput(over){
  return Object.assign({
    age:68, bilateral:"yes",
    macula:"normal", glaucoma:"none", dr:"none", cornea:"normal", osd:"none", zonule:"stable",
    opticNeuro:false, uveitis:false, vitrectomy:false, ifis:false,
    priorRefSx:"none", cylD:null, cornealSA:null, cornealComa:null, hoaRMS:null, hoaZone:"4",
    chordMu:null, chordAlpha:null, irregularAstig:false, toricPlanned:false,
    pupPhotopic:null, pupMesopic:null, al:null,
    specIndep:"1", nearPriority:"1", interPriority:"1", nightDriving:"1",
    dysphTolerance:"1", perfectionism:"1", costSensitivity:"1",
    precisionNearWork:false, nightWork:false
  }, over || {});
}
const blockedIds = r => r.blocked.map(b => b.id);
const fired = (r,id) => r.fired.includes(id);

function runSelfTests(){
  const out = [];
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond){ pass++; out.push(`  PASS  ${name}`); }
    else { fail++; out.push(`  FAIL  ${name}${detail ? "  →  " + detail : ""}`); }
  };
  const G = (over, mode) => evaluate(baseInput(over), mode || "pro");

  /* --- 선호 매칭 --- */
  let r = G({specIndep:"3", nearPriority:"3", interPriority:"3", nightDriving:"0", dysphTolerance:"3"});
  ok("탈안경·근거리 요구 최대 → 다초점 1순위", r.top.id === "trifocal", "top=" + r.top.id);

  r = G({specIndep:"0", nearPriority:"0", interPriority:"0", nightDriving:"0", dysphTolerance:"0"});
  ok("시각 요구 없음 → 단초점 1순위", r.top.id === "mono", "top=" + r.top.id);

  r = G({specIndep:"3", nearPriority:"1", interPriority:"3", nightDriving:"3", dysphTolerance:"0"});
  ok("야간운전 필수 + 탈안경 요구 → 회절형이 1순위가 아님",
     !["trifocal","edofDiff"].includes(r.top.id), "top=" + r.top.id);
  ok("야간운전 필수 → night_demand 규칙 발동", fired(r,"night_demand"));

  /* --- 금기 --- */
  r = G({macula:"amd_advanced"});
  ok("진행성 황반변성 → 다초점·회절EDOF·소구경 제외",
     ["trifocal","edofDiff","smallAp"].every(i => blockedIds(r).includes(i)), blockedIds(r).join(","));
  ok("진행성 황반변성 → 단초점은 유지", !blockedIds(r).includes("mono"));

  r = G({dr:"pdr"});
  ok("PDR → 다초점 제외", blockedIds(r).includes("trifocal"));

  r = G({glaucoma:"severe"});
  ok("중증 녹내장 → 다초점·소구경 제외",
     ["trifocal","smallAp"].every(i => blockedIds(r).includes(i)), blockedIds(r).join(","));

  r = G({glaucoma:"mild"});
  ok("초기 녹내장 → 금기가 아니라 주의", !blockedIds(r).includes("trifocal") && fired(r,"glaucoma_early"));

  r = G({osd:"visually_significant"});
  ok("시력영향 OSD → 모든 프리미엄 보류", ALL_PREMIUM.every(i => blockedIds(r).includes(i)), blockedIds(r).join(","));
  ok("시력영향 OSD → 단초점은 남아 1순위", r.top.id === "mono", "top=" + r.top.id);

  r = G({priorRefSx:"rk"});
  ok("RK → 다초점·회절EDOF 제외", ["trifocal","edofDiff"].every(i => blockedIds(r).includes(i)));
  ok("RK → 소구경 IOL 가산", r.scored.find(s => s.id === "smallAp").boosts.length > 0);

  r = G({cornea:"kc_progressive"});
  ok("진행성 원추각막 → 회절형 제외", ["trifocal","edofDiff"].every(i => blockedIds(r).includes(i)));

  r = G({zonule:"phacodonesis"});
  ok("소대 불안정 → 단초점이 1순위", r.top.id === "mono", "top=" + r.top.id);
  ok("소대 불안정 → 프리미엄 단초점은 강한 주의", fired(r,"zonule_unstable_enh"));

  r = G({perfectionism:"3", dysphTolerance:"0"});
  ok("완벽주의 최대 + 빛번짐 감내 불가 → 회절형 제외",
     ["trifocal","edofDiff"].every(i => blockedIds(r).includes(i)));

  r = G({precisionNearWork:true});
  ok("현미경·정밀근업 직업 → 다초점 제외", blockedIds(r).includes("trifocal"));

  r = G({vitrectomy:true});
  ok("유리체절제술 → 소구경 IOL 제외", blockedIds(r).includes("smallAp"));

  r = G({opticNeuro:true});
  ok("시신경병증·약시 → 회절형 제외", ["trifocal","edofDiff"].every(i => blockedIds(r).includes(i)));

  r = G({cornea:"fuchs_edema"});
  ok("푹스+각막부종 → EDOF까지 모두 제외",
     ["trifocal","edofDiff","edofND","smallAp"].every(i => blockedIds(r).includes(i)));

  /* --- 수치 cut-off 경계 --- */
  r = G({chordAlpha:0.65}); ok("chord alpha 0.65 → chord_high", fired(r,"chord_high") && !fired(r,"chord_border"));
  r = G({chordAlpha:0.55}); ok("chord alpha 0.55 → 경계구간", fired(r,"chord_border") && !fired(r,"chord_high"));
  r = G({chordAlpha:0.45}); ok("chord alpha 0.45 → 미발동", !fired(r,"chord_border") && !fired(r,"chord_high"));

  r = G({hoaRMS:0.35, hoaZone:"4"}); ok("HOA 0.35 @4mm → 발동", fired(r,"hoa_high"));
  r = G({hoaRMS:0.35, hoaZone:"6"}); ok("HOA 0.35 @6mm → 미발동", !fired(r,"hoa_high"));
  r = G({hoaRMS:0.55, hoaZone:"6"}); ok("HOA 0.55 @6mm → 발동", fired(r,"hoa_high"));

  r = G({cornealComa:0.35}); ok("코마 0.35 → 발동", fired(r,"coma_high"));
  r = G({cornealComa:0.25}); ok("코마 0.25 → 미발동", !fired(r,"coma_high"));

  r = G({cylD:1.5, toricPlanned:false}); ok("난시 1.5D 교정계획 없음 → 발동", fired(r,"astig_uncorrected"));
  r = G({cylD:1.5, toricPlanned:true});  ok("난시 1.5D 교정계획 있음 → 미발동", !fired(r,"astig_uncorrected"));
  r = G({cylD:1.5}); ok("난시 1.5D → 토릭 적응증 권고", fired(r,"toric_indicated"));
  r = G({cylD:0.5}); ok("난시 0.5D → 토릭 권고 미발동", !fired(r,"toric_indicated"));

  r = G({al:27.0}); ok("안축장 27mm → 발동", fired(r,"al_long"));
  r = G({al:24.0}); ok("안축장 24mm → 미발동", !fired(r,"al_long") && !fired(r,"al_short"));
  r = G({al:21.5}); ok("안축장 21.5mm → 짧은 눈 발동", fired(r,"al_short"));

  r = G({pupMesopic:6.2}); ok("암소시 동공 6.2mm → 발동", fired(r,"pupil_meso_large"));
  r = G({pupMesopic:5.0}); ok("암소시 동공 5.0mm → 미발동", !fired(r,"pupil_meso_large"));
  r = G({pupPhotopic:2.2}); ok("명소시 동공 2.2mm → 발동", fired(r,"pupil_photo_small"));

  r = G({cornealSA:0.30}); ok("각막 SA 0.30 → 비구면 매칭 권고", fired(r,"sa_match_aspheric") && !fired(r,"sa_match_neutral"));
  r = G({cornealSA:0.05}); ok("각막 SA 0.05 → 무수차 IOL 권고", fired(r,"sa_match_neutral") && !fired(r,"sa_match_aspheric"));
  r = G({cornealSA:null}); ok("각막 SA 미측정 → 어느 쪽도 발동 안 함", !fired(r,"sa_match_aspheric") && !fired(r,"sa_match_neutral"));

  /* --- 결측/미확인 처리 --- */
  r = G({});
  ok("값 미입력 시 수치 규칙 미발동", !fired(r,"hoa_high") && !fired(r,"chord_high") && !fired(r,"al_long"));
  ok("값 미입력 시 수차·동공 검사가 추가검사에 포함",
     r.tests.some(t => t.ko === T.ABERRO.ko) && r.tests.some(t => t.ko === T.PUPIL.ko));

  r = evaluate(baseInput({macula:"unknown", glaucoma:"unknown"}), "pro");
  ok("‘모름’ 항목은 규칙을 발동시키지 않음", !fired(r,"macula_advanced") && !fired(r,"glaucoma_adv"));
  ok("‘모름’ 항목은 미확인 목록에 표시", r.unknowns.includes("macula") && r.unknowns.includes("glaucoma"));

  /* --- 환자 모드 --- */
  r = evaluate(baseInput({astigKnown:"lots"}), "patient");
  ok("환자모드: ‘난시 많음’ → 난시 추정 + 추정 표시", r.d.cylD === 2.0 && r.d.astigEstimated === true);
  ok("환자모드: 난시 교정계획 미상 → 난시 주의 발동", fired(r,"astig_uncorrected"));
  r = evaluate(baseInput({astigKnown:"unknown"}), "patient");
  ok("환자모드: 난시 모름 → 난시 규칙 미발동", !fired(r,"astig_uncorrected") && r.d.cylD === null);

  /* --- 불변 조건 --- */
  const scenarios = [
    {}, {macula:"amd_advanced"}, {osd:"visually_significant"}, {zonule:"phacodonesis"},
    {glaucoma:"severe", dr:"pdr", cornea:"kc_progressive", opticNeuro:true, uveitis:true,
     vitrectomy:true, priorRefSx:"rk", perfectionism:"3", dysphTolerance:"0", precisionNearWork:true},
    {specIndep:"3", nearPriority:"3", interPriority:"3", nightDriving:"3", dysphTolerance:"0",
     perfectionism:"3", costSensitivity:"3"},
  ];
  let invariantOk = true, invDetail = "";
  scenarios.forEach((s,i) => {
    ["pro","patient"].forEach(m => {
      const rr = evaluate(baseInput(s), m);
      if (!rr.top){ invariantOk = false; invDetail = `#${i}/${m}: top 없음`; }
      if (blockedIds(rr).includes("mono")){ invariantOk = false; invDetail = `#${i}/${m}: 단초점이 제외됨`; }
      rr.scored.forEach(x => {
        if (!x.blocked && (x.score < 3 || x.score > 100)){ invariantOk = false; invDetail = `#${i}/${m}: ${x.id} 점수 ${x.score}`; }
      });
      if (rr.tests.length === 0){ invariantOk = false; invDetail = `#${i}/${m}: 추가검사 목록 비어 있음`; }
    });
  });
  ok("불변 조건: 항상 1순위 존재 · 단초점은 결코 배제되지 않음 · 점수 3–100 · 검사목록 비지 않음",
     invariantOk, invDetail);

  /* --- 데이터 정합성 --- */
  const badRef = [];
  RULES.forEach(rl => (rl.refs || []).forEach(x => { if (!REFS[x]) badRef.push(rl.id + "→" + x); }));
  ok("모든 규칙의 인용 문헌 ID가 실재", badRef.length === 0, badRef.join(","));

  const badTarget = [];
  RULES.forEach(rl => {
    const list = Array.isArray(rl.targets) ? rl.targets : Object.keys(rl.targets || {});
    list.concat(Object.keys(rl.boost || {})).forEach(x => { if (!LENS_BY_ID[x]) badTarget.push(rl.id + "→" + x); });
  });
  ok("모든 규칙의 대상 렌즈 ID가 실재", badTarget.length === 0, badTarget.join(","));

  const noGrade = RULES.filter(rl => !["A","B","C","D"].includes(rl.grade)).map(rl => rl.id);
  ok("모든 규칙에 근거 수준 부여", noGrade.length === 0, noGrade.join(","));

  const noI18n = RULES.filter(rl => !rl.ko || !rl.en || !rl.ko.t || !rl.en.t || !rl.ko.why || !rl.en.why).map(rl => rl.id);
  ok("모든 규칙에 한국어·영어 설명 존재", noI18n.length === 0, noI18n.join(","));

  const dupe = RULES.map(rl => rl.id).filter((x,i,a) => a.indexOf(x) !== i);
  ok("규칙 ID 중복 없음", dupe.length === 0, dupe.join(","));

  const badBand = LENSES.filter(l => Math.abs(l.band.reduce((a,b)=>a+b,0) - 100) > 0.001).map(l => l.id);
  ok("모든 렌즈의 탈초점 글리프 합 = 100", badBand.length === 0, badBand.join(","));

  const header = `IOL 내비게이터 · 자체 검증\n규칙 ${RULES.length}개 · 렌즈 유형 ${LENSES.length}개 · 문헌 ${Object.keys(REFS).length}건\n${"─".repeat(58)}`;
  const footer = `${"─".repeat(58)}\n통과 ${pass} · 실패 ${fail}`;
  const text = [header, ...out, footer].join("\n");

  const host = document.getElementById("testout");
  if (host){
    document.getElementById("testcard").hidden = false;
    host.innerHTML = text
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/  PASS  /g, '<span class="pass">  PASS  </span>')
      .replace(/  FAIL  /g, '<span class="fail">  FAIL  </span>');
  }
  if (typeof console !== "undefined") console.log(text);
  return {pass, fail, text};
}
