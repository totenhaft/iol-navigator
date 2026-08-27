/* ------------------------------------------------------------------
   엔진
   ------------------------------------------------------------------ */
function num(v){
  if (v === null || v === undefined || v === "" ) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* 미확인 시 결론에 실질적 영향을 주는 항목 */
const CRITICAL_UNKNOWN = {
  macula:     {tests:["OCT","MACSTAB"], ko:"황반 상태", en:"Macular status"},
  glaucoma:   {tests:["VF"],            ko:"녹내장 유무·중증도", en:"Glaucoma presence and severity"},
  cornea:     {tests:["TOPO","ENDO"],   ko:"각막 상태", en:"Corneal status"},
  osd:        {tests:["OSD"],           ko:"안구표면 상태", en:"Ocular surface status"},
  dr:         {tests:["OCT"],           ko:"당뇨망막병증 유무", en:"Diabetic retinopathy"},
  priorRefSx: {tests:["TOPO","POSTREF"],ko:"이전 각막 굴절수술 여부", en:"Prior corneal refractive surgery"},
  zonule:     {tests:["DILAT"],         ko:"소대 안정성", en:"Zonular stability"},
  astigKnown: {tests:["TCA","TOPO"],    ko:"각막 난시량", en:"Corneal astigmatism"},
  bilateral:  {tests:[],                ko:"양안/단안 수술 계획", en:"Bilateral vs unilateral plan"},
};

/* 원시 입력 → 엔진 입력 정규화
   mode 에는 역할(patient·counselor·doctor) 또는 데이터 모드(patient·pro)가 들어옵니다.
   d.role 은 화면 구성에, d.mode 는 임상 로직에 쓰입니다. */
function normalize(raw, mode){
  const d = Object.assign({}, raw);
  const role = mode || "patient";
  d.role = role;
  d.mode = (typeof ROLE_DATA_MODE !== "undefined" && ROLE_DATA_MODE[role]) || "pro";

  ["age","cylD","cornealSA","cornealComa","hoaRMS","chordMu","chordAlpha","pupPhotopic","pupMesopic","al"]
    .forEach(k => { d[k] = num(d[k]); });

  ["specIndep","nearPriority","interPriority","nightDriving","dysphTolerance","perfectionism","costSensitivity"]
    .forEach(k => { const n = num(d[k]); d[k] = n === null ? 1 : n; });

  ["opticNeuro","uveitis","vitrectomy","ifis","irregularAstig","toricPlanned","precisionNearWork","nightWork"]
    .forEach(k => { d[k] = d[k] === true || d[k] === "true"; });

  /* 난시: 실제 계측값(cylD)이 있으면 언제나 그것을 씁니다.
     계측값이 없고 환자·상담 단계의 서술만 있으면 추정하되 '추정'임을 표시합니다.
     (상담직원이 문진만 하고 계측 전이어도 환자 응답이 버려지지 않게 하려는 것) */
  d.astigEstimated = false;
  if (d.cylD === null && d.astigKnown && d.astigKnown !== "unknown"){
    if (d.astigKnown === "no")        d.cylD = 0;
    else if (d.astigKnown === "some"){ d.cylD = 1.0; d.astigEstimated = true; }
    else if (d.astigKnown === "lots"){ d.cylD = 2.0; d.astigEstimated = true; }
  }
  if (d.mode === "patient") d.toricPlanned = false;   // 환자는 수술 계획을 알 수 없음

  // 'unknown' 은 규칙을 발동시키지 않음 (null 취급) — 대신 추가검사로 표시
  const unknowns = [];
  Object.keys(CRITICAL_UNKNOWN).forEach(k => {
    if (d[k] === "unknown"){ unknowns.push(k); d[k] = null; }
  });
  d._unknowns = unknowns;
  return d;
}

/* 선호 적합도 원점수 */
function prefBreakdown(d, cap){
  const items = [
    {k:"near",  v: d.nearPriority   * (cap.near  / 3) * 2.0},
    {k:"inter", v: d.interPriority  * (cap.inter / 3) * 1.6},
    {k:"spec",  v: d.specIndep      * ((cap.near + cap.inter) / 6) * 2.0},
    {k:"night", v: d.nightDriving   * ((cap.night - 1.5) / 1.5) * 1.8},
    {k:"dysph", v: (3 - d.dysphTolerance) * ((cap.night - 1.5) / 1.5) * 1.5},
    {k:"cost",  v: d.costSensitivity * ((cap.cost - 2) / 1.0) * 0.7},
  ];
  return {items, total: items.reduce((s,i) => s + i.v, 0)};
}

function evaluate(raw, mode){
  const d = normalize(raw, mode);

  const state = {};
  LENSES.forEach(l => { state[l.id] = {lens:l, stops:[], cautions:[], boosts:[], penalty:0, boost:0}; });

  const notes = [], fired = [];
  const testSet = new Map();
  const addTest = t => { if (t && !testSet.has(t.ko)) testSet.set(t.ko, t); };

  RULES.forEach(rule => {
    let hit = false;
    try { hit = !!rule.when(d); } catch (e) { hit = false; }
    if (!hit) return;
    fired.push(rule.id);
    (rule.tests || []).forEach(addTest);

    if (rule.layer === "note"){ notes.push(rule); return; }

    if (rule.layer === "stop"){
      const list = Array.isArray(rule.targets) ? rule.targets : Object.keys(rule.targets);
      list.forEach(id => { if (state[id]) state[id].stops.push(rule); });
    } else if (rule.layer === "caution"){
      const map = Array.isArray(rule.targets)
        ? Object.fromEntries(rule.targets.map(t => [t, 1]))
        : rule.targets;
      Object.entries(map).forEach(([id, w]) => {
        if (!state[id]) return;
        state[id].cautions.push({rule, w});
        state[id].penalty += w;
      });
    }
    if (rule.boost){
      Object.entries(rule.boost).forEach(([id, b]) => {
        if (!state[id]) return;
        state[id].boosts.push({rule, b});
        state[id].boost += b;
      });
    }
  });

  // 기본 술전 검사 (AAO PPP 표준 평가)
  [T.OCT, T.TOPO, T.OSD, T.BIOM].forEach(addTest);
  // 미측정 항목 → 추가검사
  if (d.mode === "pro"){
    if (d.cornealSA === null || d.cornealComa === null || d.hoaRMS === null) addTest(T.ABERRO);
    if (d.chordMu === null && d.chordAlpha === null) addTest(T.KAPPA);
    if (d.pupMesopic === null || d.pupPhotopic === null) addTest(T.PUPIL);
    if (d.cylD === null) addTest(T.TCA);
  } else {
    [T.ABERRO, T.PUPIL, T.TCA].forEach(addTest);
  }
  d._unknowns.forEach(k => (CRITICAL_UNKNOWN[k].tests || []).forEach(tk => addTest(T[tk])));

  // 점수
  const scored = LENSES.map(l => {
    const st = state[l.id];
    const pb = prefBreakdown(d, l.cap);
    const blocked = st.stops.length > 0;
    const score = blocked ? 0 : clamp(
      Math.round(l.base + 30 + pb.total * 3.5 - st.penalty * 7 + st.boost * 5), 3, 100);
    return {
      id:l.id, lens:l, score, blocked,
      stops:st.stops, cautions:st.cautions.slice().sort((a,b)=>b.w-a.w), boosts:st.boosts,
      penalty:st.penalty, pref:pb
    };
  });

  const viable = scored.filter(s => !s.blocked).sort((a,b) => b.score - a.score);
  const blockedList = scored.filter(s => s.blocked)
    .sort((a,b) => b.stops.length - a.stops.length);

  // 소구경 IOL은 불규칙 각막 구제 목적일 때만 상위 추천으로 올림
  const irregular = fired.some(id => ["cornea_irregular","rk","kc_stable","coma_high","hoa_high"].includes(id));
  if (!irregular){
    const i = viable.findIndex(v => v.id === "smallAp");
    if (i > -1 && i < viable.length - 1){
      const [sa] = viable.splice(i, 1);
      sa.score = Math.min(sa.score, 45);
      sa.demoted = true;
      viable.push(sa);
      viable.sort((a,b) => b.score - a.score);
    }
  }

  const top = viable[0] || scored.find(s => s.id === "mono");
  const alternatives = viable.slice(1, 4);
  const avoid = blockedList.concat(viable.filter(v => v.score < 32 && v !== top));

  return {
    d, top, alternatives, viable, blocked:blockedList, avoid, notes, fired,
    scored: scored.slice().sort((a,b) => (b.blocked?-1:b.score) - (a.blocked?-1:a.score)),
    tests: Array.from(testSet.values()),
    unknowns: d._unknowns,
    allStopRules: Array.from(new Set([].concat(...scored.map(s => s.stops)))),
    allCautionRules: (() => {
      const m = new Map();
      scored.forEach(s => s.cautions.forEach(c => {
        const cur = m.get(c.rule.id);
        if (!cur) m.set(c.rule.id, {rule:c.rule, lenses:[{id:s.id, w:c.w}]});
        else cur.lenses.push({id:s.id, w:c.w});
      }));
      return Array.from(m.values());
    })()
  };
}
