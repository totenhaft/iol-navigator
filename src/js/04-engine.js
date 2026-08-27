/* ------------------------------------------------------------------
   엔진
   ------------------------------------------------------------------ */
function num(v){
  if (v === null || v === undefined || v === "" ) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* 생활 요구 항목의 '중립값' — 이 값에서는 어느 렌즈에도 가산도 감점도 생기지 않는다.
   (빛번짐 감내는 척도가 뒤집혀 있어 3 이 중립이다) */
const PREF_NEUTRAL = {
  specIndep:0, nearPriority:0, interPriority:0,
  nightDriving:0, dysphTolerance:3, perfectionism:1, costSensitivity:0,
};
const PREF_LABEL = {
  specIndep:      {ko:"안경으로부터 자유롭고 싶은 정도", en:"Desire for spectacle independence"},
  nearPriority:   {ko:"근거리 작업 비중", en:"Near-work demand"},
  interPriority:  {ko:"중간거리 작업 비중", en:"Intermediate demand"},
  nightDriving:   {ko:"야간 운전의 중요도", en:"Night-driving demand"},
  dysphTolerance: {ko:"빛번짐 감내 정도", en:"Tolerance for halo and glare"},
  perfectionism:  {ko:"기대 수준·완벽주의 성향", en:"Expectation level"},
  costSensitivity:{ko:"비용 민감도", en:"Cost sensitivity"},
};

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

  /* 생활 요구 항목은 화면에서 미리 골라 두지 않는다. 답하지 않은 항목은
     '요구 없음'이 아니라 '아직 모름'이므로, 어느 쪽으로도 점수를 밀지 않는
     중립값으로 바꾸고 별도로 기록한다. 미입력을 임의의 기본값으로 추론하지
     않는다는 이 도구의 원칙을 선호 항목에도 그대로 적용한 것이다. */
  const prefUnanswered = [];
  Object.entries(PREF_NEUTRAL).forEach(([k, neutral]) => {
    const n = num(d[k]);
    if (n === null){ prefUnanswered.push(k); d[k] = neutral; }
    else d[k] = n;
  });
  d._prefUnanswered = prefUnanswered;

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

/* 선호 적합도 원점수

   설계 원칙: **요구가 있을 때만 점수가 움직인다.**

   이전 판에서는 야간·빛번짐·비용 항목이 양방향으로 작동했다. 즉 환자가 아무 말도
   하지 않은 기본값(4단계 중 1)에서도 야간에 강한 렌즈에 큰 가산점이 붙었고, 그
   결과 "안경을 되도록 안 쓰고 싶다"를 최대로 고른 건강한 눈에서도 프리미엄 단초점
   이나 미니모노비전이 1순위로 나왔다. 기본값은 '특별한 요구 없음'에 가깝지 신호가
   아니므로, 이 세 항목은 이제 **요구가 기본값을 넘을 때만 감점으로** 작동한다.
   반대로 야간 요구가 없다고 해서 야간에 강한 렌즈에 가산점을 주지는 않는다.

   근거리·중간거리·탈안경 요구는 그대로 가산으로 둔다 — 이것들은 환자가 명시적으로
   고른 값이고, 렌즈 선택을 움직여야 하는 신호다. */
function prefBreakdown(d, cap){
  const nightPressure = Math.max(0, d.nightDriving - 1);            // 0..2
  const glarePressure = Math.max(0, (3 - d.dysphTolerance) - 1);    // 0..2
  const costPressure  = Math.max(0, d.costSensitivity - 1);         // 0..2
  const nightWeak = Math.max(0, 2.6 - cap.night) / 1.6;             // 0(야간 안정) .. 1(취약)
  const items = [
    {k:"near",  v:  d.nearPriority  * (cap.near  / 3) * 2.2},
    {k:"inter", v:  d.interPriority * (cap.inter / 3) * 1.7},
    {k:"spec",  v:  d.specIndep     * ((cap.near + cap.inter) / 6) * 2.6},
    {k:"night", v: -nightPressure * nightWeak * 2.4},
    {k:"dysph", v: -glarePressure * nightWeak * 2.0},
    {k:"cost",  v: -costPressure * ((3 - cap.cost) / 3) * 1.6},
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

  /* 예전에는 소구경 IOL 을 특정 상황에서만 상위로 올리는 예외 처리가 여기 있었다.
     소구경 IOL 을 뺀 지금은 필요 없다. 굴절형 분절 이중초점(렌티스)도 같은 예외가
     필요 없는데, 코마·고위수차 규칙이 삼중초점을 감점하면서 렌티스에는 가산을
     주므로 순위가 자연스럽게 뒤집히기 때문이다. */

  const top = viable[0] || scored.find(s => s.id === "mono");
  const alternatives = viable.slice(1, 4);
  const avoid = blockedList.concat(viable.filter(v => v.score < 32 && v !== top));

  return {
    d, top, alternatives, viable, blocked:blockedList, avoid, notes, fired,
    scored: scored.slice().sort((a,b) => (b.blocked?-1:b.score) - (a.blocked?-1:a.score)),
    tests: Array.from(testSet.values()),
    unknowns: d._unknowns,
    prefUnanswered: d._prefUnanswered,
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
