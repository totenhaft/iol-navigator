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
  ok("야간운전 필수 + 탈안경 요구 → 초점을 나누는 렌즈가 1순위가 아님",
     !FOCUS_SPLIT.includes(r.top.id), "top=" + r.top.id);
  ok("야간운전 필수 → night_demand 규칙 발동", fired(r,"night_demand"));

  /* --- 금기 --- */
  r = G({macula:"amd_advanced"});
  ok("진행성 황반변성 → 초점을 나누는 렌즈 제외",
     FOCUS_SPLIT.every(i => blockedIds(r).includes(i)), blockedIds(r).join(","));
  ok("진행성 황반변성 → 단초점은 유지", !blockedIds(r).includes("mono"));

  r = G({dr:"pdr"});
  ok("PDR → 다초점 제외", blockedIds(r).includes("trifocal"));

  r = G({glaucoma:"severe"});
  ok("중증 녹내장 → 초점을 나누는 렌즈 제외",
     FOCUS_SPLIT.every(i => blockedIds(r).includes(i)), blockedIds(r).join(","));

  r = G({glaucoma:"mild"});
  ok("초기 녹내장 → 금기가 아니라 주의", !blockedIds(r).includes("trifocal") && fired(r,"glaucoma_early"));

  r = G({osd:"visually_significant"});
  ok("시력영향 OSD → 모든 프리미엄 보류", ALL_PREMIUM.every(i => blockedIds(r).includes(i)), blockedIds(r).join(","));
  ok("시력영향 OSD → 단초점은 남아 1순위", r.top.id === "mono", "top=" + r.top.id);

  r = G({priorRefSx:"rk"});
  ok("RK → 초점을 나누는 렌즈 제외", FOCUS_SPLIT.every(i => blockedIds(r).includes(i)));
  ok("RK → 연속초점 EDOF는 금기가 아니라 주의", !blockedIds(r).includes("edof") && fired(r,"cornea_irregular_edof"));

  r = G({cornea:"kc_progressive"});
  ok("진행성 원추각막 → 초점을 나누는 렌즈 제외", FOCUS_SPLIT.every(i => blockedIds(r).includes(i)));

  r = G({zonule:"phacodonesis"});
  ok("소대 불안정 → 단초점이 1순위", r.top.id === "mono", "top=" + r.top.id);
  ok("소대 불안정 → 프리미엄 단초점은 강한 주의", fired(r,"zonule_unstable_enh"));

  r = G({perfectionism:"3", dysphTolerance:"0"});
  ok("완벽주의 최대 + 빛번짐 감내 불가 → 초점을 나누는 렌즈 제외",
     FOCUS_SPLIT.every(i => blockedIds(r).includes(i)));

  r = G({precisionNearWork:true});
  ok("현미경·정밀근업 직업 → 다초점 제외", blockedIds(r).includes("trifocal"));

  r = G({vitrectomy:true});
  ok("유리체절제술 → 금기가 아니라 주의", !blockedIds(r).includes("trifocal") && fired(r,"vitrectomy_other"));

  r = G({opticNeuro:true});
  ok("시신경병증·약시 → 초점을 나누는 렌즈 제외", FOCUS_SPLIT.every(i => blockedIds(r).includes(i)));

  r = G({cornea:"fuchs_edema"});
  ok("푹스+각막부종 → EDOF까지 모두 제외",
     ["trifocal","lentis","edof"].every(i => blockedIds(r).includes(i)));

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
    ["patient","counselor","doctor"].forEach(m => {
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



  /* --- 렌즈 구성 (2026-08-27 개편) --- */
  ok("소구경 IOL은 더 이상 후보에 없다", !LENS_BY_ID.smallAp);
  ok("EDOF는 회절/비회절로 나누지 않고 하나로 다룬다",
     !!LENS_BY_ID.edof && !LENS_BY_ID.edofND && !LENS_BY_ID.edofDiff);
  ok("굴절형 분절 이중초점(렌티스)이 후보에 있다", !!LENS_BY_ID.lentis);
  const noPlainDesc = LENSES.filter(l => !l.koPlain || !l.enPlain).map(l => l.id);
  ok("모든 렌즈에 환자용 쉬운 설명이 있다 (A5 결과지에 쓰임)", noPlainDesc.length === 0, noPlainDesc.join(","));
  const jargon = LENSES.filter(l => /회절|수차|비대칭|logMAR|ROF/.test(l.koPlain)).map(l => l.id);
  ok("환자용 설명에 전문 용어를 쓰지 않는다", jargon.length === 0, jargon.join(","));
  const noPlainTest = Object.entries(T).filter(([k,v]) => k !== "COUNSEL" && (!v.p_ko || !v.p_en)).map(([k]) => k);
  ok("모든 검사 항목에 환자용 이름이 있다", noPlainTest.length === 0, noPlainTest.join(","));
  ok("단초점의 기본신뢰도가 가장 높다 (요구가 없으면 단초점이 남는다)",
     LENSES.every(l => l.id === "mono" || l.base < LENS_BY_ID.mono.base));

  /* --- 선호가 실제로 결과를 움직이는가 --- */
  const unanswered = evaluate({age:68, bilateral:"yes", macula:"normal", glaucoma:"none", dr:"none",
    cornea:"normal", osd:"none", zonule:"stable", priorRefSx:"none", hoaZone:"4"}, "doctor");
  ok("아무 요구도 고르지 않으면 단초점이 1순위", unanswered.top.id === "mono", "top=" + unanswered.top.id);
  ok("고르지 않은 생활 요구 항목이 목록으로 남는다", unanswered.prefUnanswered.length === 7,
     String(unanswered.prefUnanswered.length));

  const rank = rr => rr.viable.map(v => v.id);
  r = G({specIndep:"3", nearPriority:"2", interPriority:"2", costSensitivity:"0",
         nightDriving:"1", dysphTolerance:"1", toricPlanned:true});
  ok("눈이 깨끗하고 탈안경 요구가 최대면 삼중초점이 1순위",
     r.top.id === "trifocal", "순위=" + rank(r).join(">"));
  ok("이때 프리미엄 단초점·미니모노비전이 연속초점보다 위로 오지 않는다",
     rank(r).indexOf("edof") < rank(r).indexOf("enhMono") &&
     rank(r).indexOf("edof") < rank(r).indexOf("monoBlend"), "순위=" + rank(r).join(">"));

  r = G({specIndep:"3", nearPriority:"3", interPriority:"2",
         nightDriving:"1", dysphTolerance:"1", toricPlanned:true});
  ok("근거리를 맨눈으로 원하면 연속초점 이상이 상위 세 자리를 차지",
     rank(r).slice(0,3).every(id => ["trifocal","lentis","edof"].includes(id)), "순위=" + rank(r).join(">"));

  /* --- 코마가 큰 눈에서 굴절형 분절 이중초점 --- */
  r = G({specIndep:"3", nearPriority:"3", interPriority:"2", cornealComa:0.45,
         nightDriving:"1", dysphTolerance:"1", toricPlanned:true});
  ok("각막 코마가 크면 렌티스가 삼중초점보다 위로 온다",
     rank(r).indexOf("lentis") < rank(r).indexOf("trifocal"), "순위=" + rank(r).join(">"));
  ok("코마가 크면 렌티스에 가산이 붙는다",
     r.scored.find(x => x.id === "lentis").boosts.length > 0);
  ok("코마 상담 계획 권고가 함께 뜬다", fired(r, "lentis_plan"));
  r = G({specIndep:"3", nearPriority:"3", interPriority:"2", cornealComa:0.1,
         nightDriving:"1", dysphTolerance:"1", toricPlanned:true});
  ok("코마가 정상이면 삼중초점이 렌티스보다 위",
     rank(r).indexOf("trifocal") < rank(r).indexOf("lentis"), "순위=" + rank(r).join(">"));

  /* --- 역할 --- */
  ok("상담·의사 역할은 실측 데이터 모드(pro)로 동작",
     ROLE_DATA_MODE.counselor === "pro" && ROLE_DATA_MODE.doctor === "pro" && ROLE_DATA_MODE.patient === "patient");

  const counselorKeys = new Set();
  SECTIONS_COUNSELOR.forEach(sec => sec.fields.forEach(f => {
    if (f.type === "checks") f.items.forEach(i => counselorKeys.add(i.key)); else counselorKeys.add(f.key);
  }));
  ok("상담 화면에 판독·수술계획 항목을 두지 않음 (소대·불규칙난시·토릭계획)",
     !counselorKeys.has("zonule") && !counselorKeys.has("irregularAstig") && !counselorKeys.has("toricPlanned"),
     Array.from(counselorKeys).join(","));
  ok("상담 화면에 계측 입력이 있음", counselorKeys.has("cylD") && counselorKeys.has("al"));

  r = evaluate(baseInput({cylD:0.4, astigKnown:"lots"}), "counselor");
  ok("계측 난시가 있으면 문진 서술로 덮어쓰지 않음", r.d.cylD === 0.4 && r.d.astigEstimated === false,
     `cylD=${r.d.cylD} est=${r.d.astigEstimated}`);
  r = evaluate(baseInput({cylD:null, astigKnown:"lots"}), "counselor");
  ok("계측 전이면 환자 응답에서 추정하되 '추정'으로 표시", r.d.cylD === 2.0 && r.d.astigEstimated === true);

  /* --- 인계 코드 --- */
  const allKeys = new Set();
  [SECTIONS_PATIENT, SECTIONS_COUNSELOR, SECTIONS_PRO].forEach(secs => secs.forEach(sec => sec.fields.forEach(f => {
    if (f.type === "checks") f.items.forEach(i => allKeys.add(i.key)); else allKeys.add(f.key);
  })));
  const specKeys = new Set(HANDOFF_SPEC.map(f => f.key));
  const missing = Array.from(allKeys).filter(k => !specKeys.has(k));
  ok("모든 입력 항목이 인계 코드에 실린다 (빠지면 넘길 때 값이 조용히 사라짐)",
     missing.length === 0, missing.join(","));

  const rt = (vals) => {
    const back = decodeHandoff(encodeHandoff(vals));
    if (!back.ok) return "디코드 실패: " + back.reason;
    const bad = [];
    Object.entries(vals).forEach(([k,v]) => {
      const got = back.values[k];
      const same = (v === false || v === null || v === "" ) ? (got === undefined || got === false)
                 : (typeof v === "number" ? Math.abs(got - v) < 1e-9 : String(got) === String(v));
      if (!same) bad.push(`${k}: ${v} → ${got}`);
    });
    return bad.length ? bad.join(", ") : "";
  };
  ok("인계 왕복 — 빈 입력", rt({}) === "", rt({}));
  const mid = {age:71, bilateral:"yes", macula:"amd_intermediate", astigKnown:"lots",
               nightDriving:"3", nightWork:true, cylD:1.25, al:23.6, cornealSA:-0.12, hoaZone:"6"};
  ok("인계 왕복 — 일반적인 입력", rt(mid) === "", rt(mid));
  const edge = {age:105, cylD:12, cornealSA:2, cornealComa:3, hoaRMS:3, chordMu:2, chordAlpha:2,
                pupPhotopic:9, pupMesopic:9, al:38, toricPlanned:true, ifis:true, uveitis:true};
  ok("인계 왕복 — 경계값(최댓값)", rt(edge) === "", rt(edge));
  const low = {age:18, cylD:0, cornealSA:-1, cornealComa:0, chordMu:0, pupPhotopic:1, pupMesopic:1, al:18};
  ok("인계 왕복 — 경계값(최솟값)", rt(low) === "", rt(low));

  const codeMid = encodeHandoff(mid);
  ok("소문자·공백으로 옮겨 적어도 읽힌다",
     decodeHandoff(" " + codeMid.toLowerCase().replace(/-/g, " ") + " ").ok);
  ok("O/0, I/1 혼동을 바로잡는다",
     decodeHandoff(codeMid.replace(/0/g, "O").replace(/1/g, "I")).ok);
  ok("빈 항목은 기본값으로 채워지지 않는다",
     decodeHandoff(encodeHandoff({age:71})).values.cylD === undefined);
  ok("형식이 다른 코드는 조용히 잘못 읽지 않고 거부한다",
     decodeHandoff("ZZZZ-ZZZZ-ZZZZ").ok === false && decodeHandoff("$$$$").reason === "charset");
  ok("확인 번호는 4자리이고 코드마다 다르다",
     /^\d{4}$/.test(handoffCheckDigits(codeMid)) && handoffCheckDigits(codeMid) !== handoffCheckDigits(encodeHandoff(edge)));
  ok("인계 코드 길이가 QR 용량 안에 들어온다", encodeHandoff(edge).length < 60, String(encodeHandoff(edge).length));

  /* --- 설명 표 데이터 --- */
  const badPlain = LENSES.filter(l => !l.plain ||
    ["glasses","glare","contrast","cost"].some(k => !Number.isInteger(l.plain[k]) || l.plain[k] < 0 || l.plain[k] > 3))
    .map(l => l.id);
  ok("모든 렌즈에 설명용 4단계 값이 0~3 범위로 있다", badPlain.length === 0, badPlain.join(","));
  ok("설명 표의 단계 라벨이 4개씩 준비돼 있다",
     ["ko","en"].every(l => STR[l].lvl.length === 4 && STR[l].lvlContrast.length === 4 && STR[l].lvlCost.length === 4));

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

  const header = `IOL 내비게이터 · 자체 검증\n규칙 ${RULES.length}개 · 렌즈 유형 ${LENSES.length}개 · 문헌 ${Object.keys(REFS).length}건 · 인계 항목 ${HANDOFF_SPEC.length}개\n${"─".repeat(58)}`;
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
