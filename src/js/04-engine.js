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

  /* 토릭 병용 계획을 '입력할 수 있는' 화면인가.
     의사 화면에만 그 칸이 있다. 환자·상담 화면에서 토릭 계획이 비어 있는 것은
     '토릭을 안 쓰기로 했다'가 아니라 '아직 정하지 않았다'는 뜻이다. 둘을 같게
     다루면 난시가 있다는 이유만으로 프리미엄 렌즈가 통째로 감점된다. */
  d.toricPlanKnown = (role === "doctor" || role === "pro");   // "pro" 는 의사 화면의 옛 이름

  /* 토릭이 붙을 가능성이 높은가. 금액 표시와 예산대 계산에 함께 쓴다.
     렌즈 종류의 순위를 바꾸지는 않는다 — 토릭은 모든 유형에 같은 금액이 더해진다. */
  d.toricLikely = d.toricPlanned === true || (num(d.cylD) !== null && d.cylD >= TU("cutToric"));

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
/* 비용 답이 가리키는 예산대(만원, 단안). null 이면 상한이 없다는 뜻.
   0 상관없다 / 1 조금 → 상한 없음
   2 꽤            → 프리미엄 단초점·토릭 단초점 대(125만원 근처)
   3 매우 크다      → 가장 저렴한 대(25만원, 논토릭 단초점)
   난시가 있으면 모든 유형에 토릭 금액이 똑같이 더해지므로, 그때는 토릭 단초점
   (25+75=100)이 '꽤'의 목표대에 자연스럽게 들어온다. */
const budgetTargets = () => [null, null, TU("budgetMid"), TU("budgetLow")];

function prefBreakdown(d, lens, cost){
  const cap = lens.cap;
  const nightPressure = Math.max(0, d.nightDriving - 1);            // 0..2
  /* 빛번짐 감내는 4단계가 고르게 나뉘지 않는다. 겪어본 적 없는 증상이라 대부분
     '조금은'이나 '웬만큼'을 고르는데, 예전 계산('조금은'=1, 최대의 절반)에서는
     그 한 칸이 회절형에서만 7점을 깎아 결과가 뒤집혔다. '전혀 못 견딘다'는
     여전히 강한 신호로 두되, '조금은'은 가벼운 유보로만 반영한다. */
  const GLARE = [TU("glare0"), TU("glare1"), TU("glare2"), TU("glare3")];
  const glarePressure = GLARE[Math.max(0, Math.min(3, Math.round(d.dysphTolerance)))];
  const nightWeak = Math.max(0, 2.6 - cap.night) / 1.6;             // 0(야간 안정) .. 1(취약)

  /* ── 비용 ────────────────────────────────────────────────────────────
     비용 답을 '얼마나 싫어하는가'가 아니라 '어느 예산대인가'로 읽는다.
     · 상한이 없는 답(상관없다·조금)에서는 감점이 없고, 대신 초점 범위가 넓은
       쪽을 밀어 준다. **금액이 아니라 초점 범위에 비례시킨다** — 가격 자체가
       추천 사유가 되면 환자도 보는 화면에서 '비싸서 골랐다'가 되기 때문이다.
       탈안경 의지가 없는 환자에게까지 밀어 올리지 않도록 조건을 함께 건다.
     · 상한이 있는 답(꽤·매우 크다)에서는 목표 예산대에서 멀어질수록 감점한다.
       '매우 크다'의 목표가 최저가이므로 결과적으로 금액에 비례한 감점이 된다.
     토릭은 모든 후보에 같은 금액이 더해져 서로의 거리를 바꾸지 않지만,
     목표대와의 거리는 바꾸므로 여기서는 더해서 계산한다. */
  const lv = Math.max(0, Math.min(3, Math.round(d.costSensitivity)));
  const target = budgetTargets()[lv];
  const priceBase = costMid(lens.id);
  const price = priceBase === null ? null : priceBase + (d.toricLikely ? TU("toricAddMan") : 0);
  const span = (cost && cost.span > 0) ? cost.span : 0;

  /* 예산대를 '넘는' 만큼만 감점한다. 한쪽으로만 작동하는 것이 중요하다 —
     예산보다 싼 것은 아무 문제가 아닌데 양쪽으로 벌점을 주면 "안경 써도 괜찮다"
     고 답한 환자에게 25만원 단초점 대신 125만원 프리미엄 단초점이 올라온다.
     '매우 크다'는 '꽤'보다 훨씬 세게 작동한다 — 상한이 빡빡할수록 예산이 임상
     선호를 이길 수 있어야 하기 때문이다. */
  const BAND_W = [0, 0, TU("bandMid"), TU("bandLow")];
  let costTerm = 0;
  if (price !== null && span > 0 && target !== null){
    const aim = target + (d.toricLikely ? TU("toricAddMan") : 0);
    costTerm = -(Math.min(1, Math.max(0, price - aim) / span)) * BAND_W[lv];
  }

  /* 예산 상한이 없을 때의 가산. 비용을 답하지 않은 것은 '상관없다'가 아니라
     '아직 모름'이므로 제외한다. */
  const noCeiling = (target === null) && !(d._prefUnanswered || []).includes("costSensitivity");
  const affordW = lv === 0 ? TU("affordFree") : TU("affordSlight");
  const afford = (noCeiling && d.specIndep >= TU("affordMinSpec")) ? ((cap.near + cap.inter) / 6) * affordW : 0;

  const items = [
    {k:"near",  v:  d.nearPriority  * (cap.near  / 3) * TU("wNear")},
    {k:"inter", v:  d.interPriority * (cap.inter / 3) * TU("wInter")},
    {k:"spec",  v:  d.specIndep     * ((cap.near + cap.inter) / 6) * TU("wSpec")},
    {k:"night", v: -nightPressure * nightWeak * TU("wNight")},
    {k:"dysph", v: -glarePressure * nightWeak * TU("wGlare")},
    {k:"cost",  v: costTerm},
    {k:"afford", v: afford},
  ];
  return {items, total: items.reduce((s,i) => s + i.v, 0), price, budgetTarget: target};
}

/* 순위 비교자.
   화면에 보이는 점수는 raw 를 반올림하고 3~100 으로 자른 값이다. raw 로만 줄을
   세우면 54.4 와 53.8 이 화면에는 똑같이 '54' 인데 순서만 갈리고, 상담 중에
   "왜 같은 점수인데 이게 위에 있나요"에 답할 수가 없다. 그래서 먼저 표시 점수로
   묶고, 동점 안에서 비용 답에 따라 방향을 정한다.
     · 비용 '상관없다/조금'(또는 무응답) → 더 비싼(=기능 범위가 넓은) 렌즈를 위로
     · 비용 '꽤/매우 크다'              → 더 싼 렌즈를 위로
   값이 같은 단초점과 마이크로 모노비전처럼 가격까지 같으면 raw 로 가른다. */
function rankCompare(d){
  const cheapFirst = Number(d.costSensitivity) >= 2;
  return (a, b) => (b.score - a.score)
                || (cheapFirst ? (a.price - b.price) : (b.price - a.price))
                || (b.raw - a.raw);
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

  /* 비용 척도의 양 끝 — 토릭은 모든 후보에 같은 금액이 더해지므로 렌즈 사이의
     상대적 부담을 바꾸지 않는다. 그래서 점수에는 토릭을 뺀 본체 금액만 쓰고,
     토릭 추가금은 화면에 금액을 보여줄 때만 더한다. */
  const _prices = LENSES.map(l => costMid(l.id)).filter(v => v !== null);
  const costFloor = _prices.length ? Math.min(..._prices) : 0;
  const costSpan  = _prices.length ? Math.max(..._prices) - costFloor : 0;

  // 점수
  const scored = LENSES.map(l => {
    const st = state[l.id];
    const pb = prefBreakdown(d, l, {floor:costFloor, span:costSpan});
    const blocked = st.stops.length > 0;
    /* 자르기 전 원점수를 함께 들고 다닌다. 100 에서 잘린 뒤에 정렬하면 서로 다른
       점수가 동점이 되고, 그때 순서가 렌즈 배열 순서(=싼 것부터)로 갈려 버린다. */
    const raw = l.base + TU("scoreBase") + pb.total * TU("scorePref") - st.penalty * TU("scorePenalty") + st.boost * TU("scoreBoost");
    const score = blocked ? 0 : clamp(Math.round(raw), 3, 100);
    return {
      id:l.id, lens:l, score, raw, blocked, price:pb.price,
      stops:st.stops, cautions:st.cautions.slice().sort((a,b)=>b.w-a.w), boosts:st.boosts,
      penalty:st.penalty, pref:pb
    };
  });

  const cmp = rankCompare(d);
  const viable = scored.filter(s => !s.blocked).sort(cmp);
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
    scored: scored.slice().sort((a,b) => (a.blocked === b.blocked) ? cmp(a,b) : (a.blocked ? 1 : -1)),
    tests: Array.from(testSet.values()),
    unknowns: d._unknowns,
    prefUnanswered: d._prefUnanswered,
    toricLikely: d.toricLikely,
    /* 비용 답이 가리키는 예산대(만원, 토릭 포함). null 이면 상한 없음 — 화면 설명에 쓴다. */
    budgetAim: (() => {
      const t = budgetTargets()[Math.max(0, Math.min(3, Math.round(d.costSensitivity)))];
      return t === null ? null : t + (d.toricLikely ? TU("toricAddMan") : 0);
    })(),
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
