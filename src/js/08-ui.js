/* ------------------------------------------------------------------
   UI
   ------------------------------------------------------------------ */
const state = {
  lang:"ko",
  role:"patient",          // patient | counselor | doctor
  values:{},
  last:null,
  decision:null,           // 상담에서 환자와 확인한 렌즈 유형 (id)
  toric:false,             // 토릭 병용 여부
};
let _rerunTimer = null;

/* 레일 높이 동기화 — 레일의 실제 화면상 top 을 읽어 액션바가 항상 화면 안에 들어오게 한다.
   상단 고지 배너가 스크롤에 따라 사라지면서 레일의 top 이 60px~125px 사이에서 변하므로
   CSS 의 calc(100vh - 고정값) 으로는 맞출 수 없다. */
let _railRaf = null;
function syncRailHeight(){
  const rail = document.querySelector(".rail");
  if (!rail) return;
  if (window.matchMedia("(max-width:1000px)").matches){ rail.style.maxHeight = ""; return; }
  const top = rail.getBoundingClientRect().top;
  const h = window.innerHeight - top - 14;          // 화면 아래 14px 여유
  rail.style.maxHeight = Math.max(320, h) + "px";
}
/* 모바일 고정 액션바가 푸터를 가리지 않도록 실제 높이만큼 여백 확보 */
function syncBarPadding(){
  const act = document.querySelector(".actions");
  if (!act) return;
  const mobile = window.matchMedia("(max-width:1000px)").matches;
  document.body.style.paddingBottom = mobile ? (act.offsetHeight + 16) + "px" : "";
}
function queueRailSync(){
  if (_railRaf) return;
  _railRaf = requestAnimationFrame(() => { _railRaf = null; syncRailHeight(); syncBarPadding(); });
}

/* 결과가 이미 떠 있으면 입력 변경을 자동 반영한다 — 버튼을 찾아 헤매지 않도록 */
function scheduleRerun(){
  if (!state.last) return;
  clearTimeout(_rerunTimer);
  _rerunTimer = setTimeout(() => run({scroll:false}), 320);
}
const $ = s => document.querySelector(s);
const L = () => STR[state.lang];
const tx = o => state.lang === "ko" ? o.ko : (o.en || o.ko);

function el(tag, props, kids){
  const n = document.createElement(tag);
  if (props) for (const [k,v] of Object.entries(props)){
    if (v === null || v === undefined || v === false) continue;
    if (k === "html") n.innerHTML = v;
    else if (k === "text") n.textContent = v;
    else if (k === "cls") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach(c => {
    if (c === null || c === undefined || c === false) return;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return n;
}
const ic = p => {
  const s = document.createElementNS("http://www.w3.org/2000/svg","svg");
  s.setAttribute("viewBox","0 0 24 24"); s.setAttribute("width","15"); s.setAttribute("height","15");
  s.setAttribute("fill","none"); s.setAttribute("stroke","currentColor");
  s.setAttribute("stroke-width","2"); s.setAttribute("stroke-linecap","round"); s.setAttribute("stroke-linejoin","round");
  s.setAttribute("aria-hidden","true");
  s.innerHTML = p; return s;
};
const IC_CHEV  = '<path d="m9 18 6-6-6-6"/>';
const IC_CHECK = '<path d="M20 6 9 17l-5-5"/>';
const IC_PRINT = '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>';
const IC_SHARE = '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 3v13M8 7l4-4 4 4"/>';
const IC_ASK   = '<path d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="9"/>';

/* ---------- 폼 ---------- */
function sectionsFor(role){ return SECTIONS_BY_ROLE[role] || SECTIONS_PATIENT; }

function renderForm(){
  const host = $("#formSections");
  host.textContent = "";
  host.appendChild(el("p", {cls:"rolehint", text: L().roleHint[state.role]}));
  const secs = sectionsFor(state.role);
  secs.forEach(sec => {
    const body = el("div", {cls:"sect-b"});
    sec.fields.forEach(f => body.appendChild(renderField(f)));
    const det = el("details", {cls:"sect", open: sec.open !== false}, [
      el("summary", {}, [
        el("span", {text: tx(sec)}),
        (() => { const c = ic(IC_CHEV); c.classList.add("chev"); return c; })()
      ]),
      body
    ]);
    host.appendChild(det);
    det.addEventListener("toggle", queueRailSync);
  });
  queueRailSync();
}

function labelFor(f){
  const kids = [ el("span", {text: tx(f)}) ];
  if (f.unit) kids.push(el("span", {cls:"unit", text: f.unit}));
  return kids;
}
function hintFor(f){
  const h = state.lang === "ko" ? f.hint : (f.hintEn || f.hint);
  return h ? el("div", {cls:"hint", html:h}) : null;
}

function renderField(f){
  const wrap = el("div", {cls:"field"});
  const id = "f_" + f.key;

  if (f.type === "checks"){
    wrap.appendChild(el("div", {cls:"flabel", text: tx(f)}));
    const box = el("div", {cls:"checks"});
    f.items.forEach(it => {
      const cb = el("input", {type:"checkbox", id:"c_"+it.key});
      cb.checked = state.values[it.key] === true;
      cb.addEventListener("change", () => { state.values[it.key] = cb.checked; scheduleRerun(); });
      box.appendChild(el("label", {cls:"chk", for:"c_"+it.key}, [cb, el("span", {text: tx(it)})]));
    });
    wrap.appendChild(box);
    return wrap;
  }

  if (f.type === "scale"){
    wrap.appendChild(el("div", {cls:"flabel"}, labelFor(f)));
    const h = hintFor(f); if (h) wrap.appendChild(h);
    const grid = el("div", {cls:"scale", role:"radiogroup", "aria-label": tx(f)});
    const cur = state.values[f.key] !== undefined ? String(state.values[f.key]) : (f.def || "1");
    state.values[f.key] = cur;
    f.options.forEach(o => {
      const r = el("input", {type:"radio", name:id, value:o.v, id:id+"_"+o.v});
      r.checked = (cur === o.v);
      r.addEventListener("change", () => { if (r.checked){ state.values[f.key] = o.v; scheduleRerun(); } });
      grid.appendChild(el("label", {for:id+"_"+o.v}, [r, el("span", {text: tx(o)})]));
    });
    wrap.appendChild(grid);
    return wrap;
  }

  if (f.type === "select"){
    wrap.appendChild(el("label", {for:id}, labelFor(f)));
    const h = hintFor(f); if (h) wrap.appendChild(h);
    const sel = el("select", {id});
    const cur = state.values[f.key] !== undefined ? state.values[f.key] : (f.def ?? f.options[0].v);
    state.values[f.key] = cur;
    f.options.forEach(o => {
      const op = el("option", {value:o.v, text: tx(o)});
      if (o.v === cur) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener("change", () => { state.values[f.key] = sel.value; scheduleRerun(); });
    wrap.appendChild(sel);
    return wrap;
  }

  // number
  wrap.appendChild(el("label", {for:id}, labelFor(f)));
  const h = hintFor(f); if (h) wrap.appendChild(h);
  const inp = el("input", {type:"number", id, min:f.min, max:f.max, step:f.step, placeholder:f.ph || ""});
  if (state.values[f.key] !== undefined && state.values[f.key] !== null) inp.value = state.values[f.key];
  inp.addEventListener("input", () => { state.values[f.key] = inp.value === "" ? null : inp.value; scheduleRerun(); });
  wrap.appendChild(inp);
  return wrap;
}

/* ---------- 결과 ---------- */
function defocusStrip(lens){
  const [a,b,c] = lens.band;
  const s = el("div", {cls:"dstrip", title:`${L().bandFar} ${a}% · ${L().bandInter} ${b}% · ${L().bandNear} ${c}%`});
  s.appendChild(el("i", {style:`width:${a}%;background:var(--accent)`}));
  s.appendChild(el("i", {style:`width:${b}%;background:color-mix(in srgb,var(--accent) 55%, var(--sunken))`}));
  s.appendChild(el("i", {style:`width:${c}%;background:color-mix(in srgb,var(--accent) 26%, var(--sunken))`}));
  return s;
}

function refChips(rule){
  const box = el("span", {cls:"f-meta"});
  box.appendChild(el("span", {cls:"grade", "data-g":rule.grade, text:"Grade " + rule.grade}));
  (rule.refs || []).forEach(r => {
    box.appendChild(el("a", {cls:"refbtn", href:"#ref-"+r, text:r,
      onclick:() => { const t = document.getElementById("ref-"+r); if (t) t.scrollIntoView({block:"center", behavior:"smooth"}); }}));
  });
  return box;
}

function findingNode(rule, lensIds, lvl){
  const o = tx(rule);
  const body = el("div", {cls:"f-body"}, [
    el("div", {cls:"f-head"}, [ el("span", {cls:"f-title", text:o.t}) ]),
    el("p", {cls:"f-why", text:o.why}),
  ]);
  if (lensIds && lensIds.length){
    const chips = el("div", {cls:"f-lens"});
    chips.appendChild(el("span", {cls:"chip", text: L().affects + " ·"}));
    lensIds.forEach(x => chips.appendChild(el("span", {cls:"chip", text: tx(LENS_BY_ID[x.id || x]) + (x.w ? ` (−${x.w})` : "")})));
    body.appendChild(chips);
  }
  if (o.act) body.appendChild(el("div", {cls:"f-act", text:o.act}));
  body.appendChild(refChips(rule));
  return el("div", {cls:"finding lv-"+lvl}, [ el("div", {cls:"f-stripe"}), body ]);
}

function card(title, tag, tagCls, node){
  const h = el("div", {cls:"card-h"}, [ el("h3", {text:title}) ]);
  if (tag) h.appendChild(el("span", {cls:"tag " + (tagCls || "t-neutral"), text:tag}));
  return el("section", {cls:"card"}, [h, node]);
}

function renderResults(res){
  const host = $("#resultBody");
  host.textContent = "";
  host.hidden = false;
  $("#emptyState").hidden = true;
  const t = L();
  const isPatient = state.role === "patient";

  /* 잠정 결과 경고 */
  if (res.unknowns.length || (res.d.mode === "patient")){
    const box = el("div", {cls:"card", style:"border-color:color-mix(in srgb,var(--caution) 45%, var(--line))"});
    const b = el("div", {cls:"card-b", style:"display:flex;flex-direction:column;gap:9px"});
    if (res.d.mode === "patient")
      b.appendChild(el("p", {cls:"f-why", html:t.patientNote}));
    if (res.unknowns.length){
      b.appendChild(el("p", {cls:"f-why", html:"<b>"+t.unknownTitle+"</b> — "+t.unknownBody}));
      const ul = el("div", {cls:"f-lens"});
      res.unknowns.forEach(k => ul.appendChild(el("span", {cls:"chip", text: tx(CRITICAL_UNKNOWN[k])})));
      b.appendChild(ul);
    }
    if (res.d.astigEstimated) b.appendChild(el("p", {cls:"hint", text:t.astigEst}));
    box.appendChild(b);
    host.appendChild(box);
  }

  /* 1순위 */
  const top = res.top;
  const topLens = top.lens;
  const v = el("section", {cls:"verdict"});
  const vt = el("div", {cls:"verdict-top"}, [
    el("div", {cls:"eyebrow", text:t.recTitle}),
    el("h2", {cls:"verdict-name", text: tx(topLens)}),
    el("div", {cls:"verdict-en", text: (state.lang === "ko" ? topLens.en : topLens.ko) + " · " + tx({ko:topLens.koSub, en:topLens.enSub})}),
    defocusStrip(topLens),
    el("p", {cls:"verdict-why", text: state.lang === "ko" ? topLens.koDesc : topLens.enDesc}),
  ]);
  const fit = el("div", {cls:"fitrow"}, [
    el("span", {cls:"eyebrow", text:t.fitLabel}),
    el("span", {cls:"fitnum", text: top.score}),
    el("div", {cls:"fitbar"}, el("i", {style:`width:${top.score}%`})),
  ]);
  vt.appendChild(fit);
  v.appendChild(vt);

  /* 1순위 사유 */
  const why = el("div", {cls:"flist"});
  const reasons = topReasons(res);
  reasons.forEach(r => why.appendChild(
    el("div", {cls:"finding lv-pref"}, [
      el("div", {cls:"f-stripe"}),
      el("div", {cls:"f-body"}, [
        el("div", {cls:"f-head"}, [el("span", {cls:"f-title", text:r.t})]),
        el("p", {cls:"f-why", text:r.d})
      ])
    ])
  ));
  v.appendChild(el("div", {cls:"card-h", style:"border-top:1px solid var(--line);border-bottom:0"}, el("h3", {text:t.whyTop})));
  v.appendChild(why);
  host.appendChild(v);

  /* 순위표 */
  const rank = el("div", {cls:"rank"});
  res.scored.forEach(s => {
    const blocked = s.blocked;
    const caut = s.cautions.length > 0;
    const row = el("div", {cls:"rank-row" + (blocked ? " is-out" : "")});
    const nm = el("div", {cls:"rank-nm"}, [
      el("b", {text: tx(s.lens)}),
      el("small", {text: tx({ko:s.lens.koSub, en:s.lens.enSub})}),
    ]);
    if (!blocked) nm.appendChild(defocusStrip(s.lens));
    row.appendChild(nm);
    row.appendChild(el("div", {}, [
      el("div", {cls:"bar" + (blocked ? " b-stop" : caut ? " b-caut" : "")},
        el("i", {style:`width:${blocked ? 100 : s.score}%`})),
      el("div", {style:"margin-top:6px"},
        el("span", {cls:"tag " + (blocked ? "t-stop" : caut ? "t-caut" : "t-ok"),
          text: blocked ? t.excluded : caut ? t.cautionTag + " ×" + s.cautions.length : t.fitTag}))
    ]));
    row.appendChild(el("div", {cls:"rank-sc", text: blocked ? "—" : String(s.score)}));
    rank.appendChild(row);
  });
  const legend = el("div", {cls:"legend"}, [
    el("span", {cls:"eyebrow", text: state.lang === "ko" ? "초점 분포" : "Focus distribution"}),
    el("span", {cls:"lg"}, [el("i", {cls:"sw", style:"background:var(--accent)"}), el("span",{text:L().bandFar})]),
    el("span", {cls:"lg"}, [el("i", {cls:"sw", style:"background:color-mix(in srgb,var(--accent) 55%, var(--sunken))"}), el("span",{text:L().bandInter})]),
    el("span", {cls:"lg"}, [el("i", {cls:"sw", style:"background:color-mix(in srgb,var(--accent) 26%, var(--sunken))"}), el("span",{text:L().bandNear})]),
  ]);
  host.appendChild(card(t.rankTitle, null, null, el("div", {}, [legend, rank])));

  /* 렌즈 유형 설명 — 환자·상담 화면에서 설명 자료로 씁니다 */
  if (state.role !== "doctor") host.appendChild(lensGuideCard());

  /* 금기 — 환자 화면에서는 규칙 원문 대신 아래 ‘피해야 할 유형’으로만 보여줍니다 */
  if (!isPatient && res.allStopRules.length){
    const list = el("div", {cls:"flist"});
    res.allStopRules.forEach(r => {
      const affected = res.scored.filter(s => s.stops.includes(r)).map(s => s.id);
      list.appendChild(findingNode(r, affected, "stop"));
    });
    host.appendChild(card(t.stopTitle, String(res.allStopRules.length), "t-stop", list));
  }

  /* 피해야 할 유형 */
  const avoidBox = el("div", {cls:"flist"});
  if (res.avoid.length){
    res.avoid.forEach(s => {
      const rs = s.blocked
        ? s.stops.map(r => tx(r).t)
        : s.cautions.slice(0,3).map(c => tx(c.rule).t);
      avoidBox.appendChild(el("div", {cls:"finding lv-stop"}, [
        el("div", {cls:"f-stripe"}),
        el("div", {cls:"f-body"}, [
          el("div", {cls:"f-head"}, [
            el("span", {cls:"f-title", text: tx(s.lens)}),
            el("span", {cls:"tag " + (s.blocked ? "t-stop" : "t-caut"),
              text: s.blocked ? t.excluded : t.cautionTag}),
          ]),
          el("p", {cls:"f-why", text: rs.join(" · ")})
        ])
      ]));
    });
  } else {
    avoidBox.appendChild(el("div", {cls:"finding"}, [
      el("div", {cls:"f-stripe"}),
      el("div", {cls:"f-body"}, el("p", {cls:"f-why", text:t.noAvoid}))
    ]));
  }
  host.appendChild(card(t.avoidTitle, null, null, avoidBox));

  /* 대안 */
  const altBox = el("div", {cls:"flist"});
  if (res.alternatives.length){
    res.alternatives.forEach(s => {
      const b = el("div", {cls:"f-body"}, [
        el("div", {cls:"f-head"}, [
          el("span", {cls:"f-title", text: tx(s.lens)}),
          el("span", {cls:"mono", style:"font-size:12px;color:var(--muted)", text: s.score + " / 100"}),
        ]),
        el("p", {cls:"f-why", text: state.lang === "ko" ? s.lens.koDesc : s.lens.enDesc}),
      ]);
      b.appendChild(defocusStrip(s.lens));
      if (s.cautions.length){
        const chips = el("div", {cls:"f-lens"});
        chips.appendChild(el("span", {cls:"chip", text: t.cautionTag + " ·"}));
        s.cautions.slice(0,4).forEach(c => chips.appendChild(el("span", {cls:"chip", text: tx(c.rule).t})));
        b.appendChild(chips);
      }
      altBox.appendChild(el("div", {cls:"finding lv-pref"}, [el("div", {cls:"f-stripe"}), b]));
    });
  } else {
    altBox.appendChild(el("div", {cls:"finding"}, [el("div", {cls:"f-stripe"}),
      el("div", {cls:"f-body"}, el("p", {cls:"f-why", text:t.noAlt}))]));
  }
  host.appendChild(card(t.altTitle, null, null, altBox));

  /* 주의 */
  if (!isPatient && res.allCautionRules.length){
    const list = el("div", {cls:"flist"});
    res.allCautionRules
      .slice().sort((a,b) => Math.max(...b.lenses.map(x=>x.w)) - Math.max(...a.lenses.map(x=>x.w)))
      .forEach(c => list.appendChild(findingNode(c.rule, c.lenses, "caution")));
    host.appendChild(card(t.cautionTitle, String(res.allCautionRules.length), "t-caut", list));
  }

  /* 권고 */
  if (!isPatient && res.notes.length){
    const list = el("div", {cls:"flist"});
    res.notes.forEach(r => list.appendChild(findingNode(r, null, "pref")));
    host.appendChild(card(t.noteTitle, String(res.notes.length), "t-pref", list));
  }

  /* 추가검사 — 환자 화면에서는 ‘진료 때 여쭤볼 것’으로 바꿔 보여줍니다 */
  if (isPatient){
    host.appendChild(patientAskCard(res));
  } else {
    const tests = el("div", {cls:"tests"});
    res.tests.forEach(x => {
      const d = state.lang === "ko" ? x.d_ko : (x.d_en || x.d_ko);
      tests.appendChild(el("div", {cls:"test"}, [
        ic(IC_CHECK),
        el("div", {}, [ el("span", {text: tx(x)}), d ? el("small", {text:d}) : null ])
      ]));
    });
    host.appendChild(card(t.testsTitle, String(res.tests.length), "t-neutral", tests));
  }

  /* 선택 확인 — 상담직원 화면 전용 */
  if (state.role === "counselor") host.appendChild(decisionCard(res));

  /* 인쇄 · 인계 */
  host.appendChild(el("div", {cls:"btnrow", style:"padding:2px 0"}, [
    el("button", {type:"button", cls:"btn", onclick:() => window.print()}, [ic(IC_PRINT), el("span",{text:t.printBtn})]),
    el("button", {type:"button", cls:"btn", onclick:() => openHandoff()}, [ic(IC_SHARE), el("span",{text:t.handoffBtn})]),
  ]));
}

/* 1순위 사유 생성 */
function topReasons(res){
  const s = res.top, d = res.d, t = L(), out = [];
  const ko = state.lang === "ko";

  const others = res.viable.filter(x => x !== s);
  const gap = others.length ? s.score - others[0].score : 0;

  // 선호 매칭에서 가장 크게 기여한 항목
  const contrib = s.pref.items.slice().sort((a,b) => b.v - a.v).filter(i => i.v > 0.4).slice(0,2);
  if (contrib.length){
    out.push({
      t: ko ? "생활 요구와의 매칭" : "Match to visual demands",
      d: (ko ? "가장 크게 작용한 요소: " : "Strongest contributing factors: ")
         + contrib.map(c => t.prefKeys[c.k]).join(", ")
         + (ko ? ". 이 요구들에 대해 이 렌즈 유형의 특성이 가장 잘 맞습니다."
               : ". This lens type matches those demands most closely.")
    });
  } else {
    out.push({
      t: ko ? "특별한 시각적 요구가 두드러지지 않음" : "No dominant visual demand",
      d: ko ? "탈안경·근거리·중간거리 요구가 모두 낮게 입력되어, 가장 예측 가능하고 대비감도가 안정적인 선택이 1순위가 됩니다."
            : "Spectacle-independence, near and intermediate demands were all entered low, so the most predictable and contrast-stable option ranks first."
    });
  }

  // 배제된 상위 유형
  const blockedPremium = res.blocked.filter(b => ["trifocal","edofDiff","edofND","smallAp"].includes(b.id));
  if (blockedPremium.length){
    out.push({
      t: ko ? "더 넓은 초점 범위의 선택지가 금기로 제외됨" : "Wider-range options were excluded",
      d: (ko ? "다음 유형이 금기 항목에 걸려 후보에서 빠졌습니다: " : "These types were removed by contraindications: ")
         + blockedPremium.map(b => tx(b.lens)).join(", ")
         + (ko ? ". 자세한 사유는 ‘금기’ 항목을 확인하세요." : ". See the contraindications section for details.")
    });
  }

  // 감점 요인
  if (s.cautions.length){
    out.push({
      t: ko ? "이 선택에도 남아 있는 주의사항" : "Cautions that still apply to this choice",
      d: s.cautions.slice(0,3).map(c => tx(c.rule).t).join(" · ")
         + (ko ? " — 1순위라도 무조건 안전하다는 뜻은 아닙니다." : " — ranking first does not mean risk-free.")
    });
  }

  // 근소한 차이
  if (others.length && gap <= 6){
    out.push({
      t: ko ? "2순위와의 차이가 작습니다" : "The margin over the runner-up is small",
      d: (ko ? `${tx(others[0].lens)}와 ${gap}점 차이입니다. 이 정도 차이는 입력값의 작은 변화로 뒤집힐 수 있으므로, 두 선택지를 함께 상담하는 편이 적절합니다.`
             : `Only ${gap} points separate this from ${tx(others[0].lens)}. A margin this small can flip with minor input changes, so both should be discussed.`)
    });
  }
  return out;
}

/* ---------- 정적 섹션 ---------- */
function renderTaxonomy(){
  const tb = $("#taxTable"); tb.textContent = "";
  const cols = L().taxCols;
  const thead = el("thead", {}, el("tr", {}, cols.map(c => el("th", {text:c}))));
  const tbody = el("tbody");
  TAXONOMY.forEach(row => {
    const cells = state.lang === "ko" ? row.ko : row.en;
    const tr = el("tr");
    cells.forEach((c,i) => tr.appendChild(el("td", i === 0 ? {html:"<b>"+c+"</b>"} : {html:c})));
    tbody.appendChild(tr);
  });
  tb.appendChild(thead); tb.appendChild(tbody);
}

function renderRefs(){
  const host = $("#refList"); host.textContent = "";
  Object.entries(REFS).forEach(([id, r]) => {
    host.appendChild(el("div", {cls:"ref", id:"ref-"+id}, [
      el("div", {cls:"ref-id"}, [ el("div",{text:id}), el("span",{cls:"grade","data-g":r.grade,text:r.grade}) ]),
      el("div", {}, [
        el("b", {text: state.lang === "ko" ? r.n : r.en}),
        el("div", {cls:"hint", style:"margin-top:2px", text:r.cite}),
        el("span", {cls:"ref-key", text: state.lang === "ko" ? r.key : (r.keyEn || r.key)}),
        el("a", {href:r.url, target:"_blank", rel:"noopener noreferrer", text:r.url})
      ])
    ]));
  });
}

function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(n => {
    const v = L()[n.getAttribute("data-i18n")];
    if (v !== undefined) n.innerHTML = v;
  });
  document.documentElement.lang = state.lang;
}

/* ---------- 실행 ---------- */
function run(opts){
  const scroll = !opts || opts.scroll !== false;
  const res = evaluate(state.values, state.role);
  state.last = res;
  renderResults(res);
  const hint = $("#autoHint");
  if (hint) hint.hidden = false;
  queueRailSync();
  if (scroll && window.matchMedia("(max-width:1000px)").matches)
    $("#results").scrollIntoView({behavior:"smooth", block:"start"});
  return res;
}

function setRole(r){
  if (!ROLES.includes(r)) r = "patient";
  state.role = r;
  ROLES.forEach(x => $("#role_" + x).setAttribute("aria-pressed", String(x === r)));
  document.body.setAttribute("data-role", r);
  $("#taxonomyCard").hidden = (r === "patient");
  $("#refCard").hidden      = (r === "patient");
  renderForm();
  if (state.last) run({scroll:false});
}
function setLang(l){
  state.lang = l;
  $("#langKo").setAttribute("aria-pressed", String(l === "ko"));
  $("#langEn").setAttribute("aria-pressed", String(l === "en"));
  applyI18n(); renderForm(); renderTaxonomy(); renderRefs(); syncRoleLabels();
  if (state.last) run({scroll:false});
}

function boot(){
  applyI18n();
  renderForm();
  renderTaxonomy();
  renderRefs();

  ROLES.forEach(r => $("#role_" + r).addEventListener("click", () => setRole(r)));
  syncRoleLabels();
  setRole(state.role);
  wireHandoff();
  $("#langKo").addEventListener("click", () => setLang("ko"));
  $("#langEn").addEventListener("click", () => setLang("en"));
  $("#runBtn").addEventListener("click", () => run({scroll:true}));
  $("#resetBtn").addEventListener("click", () => {
    state.values = {}; state.last = null; state.decision = null; state.toric = false;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    renderForm();
    $("#resultBody").hidden = true; $("#resultBody").textContent = "";
    $("#emptyState").hidden = false;
    $("#autoHint").hidden = true;
    clearTimeout(_rerunTimer);
  });
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = cur ? (cur === "dark" ? "light" : "dark") : (sysDark ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("iolnav-theme", next); } catch(e){}
  });
  try {
    const saved = localStorage.getItem("iolnav-theme");
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
  } catch(e){}

  syncRailHeight(); syncBarPadding();
  window.addEventListener("scroll", queueRailSync, {passive:true});
  window.addEventListener("resize", queueRailSync);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", queueRailSync);

  loadFromHash();
  if (new URLSearchParams(location.search).has("test")) runSelfTests();
}

/* ==================================================================
   렌즈 유형 설명 — 환자·상담 화면
   ================================================================== */
function dots(n, max){
  const box = el("span", {cls:"dots", "aria-hidden":"true"});
  for (let i = 0; i < (max || 3); i++) box.appendChild(el("i", {cls: i < n ? "on" : ""}));
  return box;
}
function meter(level, labels){
  return el("span", {cls:"meter"}, [ dots(level, 3), el("span", {cls:"mlabel", text: labels[level]}) ]);
}

function lensGuideCard(){
  const t = L();
  const tbl = el("table", {cls:"gloss guide"});
  tbl.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {text: state.lang === "ko" ? "유형" : "Type"}),
    el("th", {text: t.guideFar + " · " + t.guideInter + " · " + t.guideNear}),
    el("th", {text: t.guideGlasses}),
    el("th", {text: t.guideGlare}),
    el("th", {text: t.guideContrast}),
    el("th", {text: t.guideCost}),
  ])));
  const tb = el("tbody");
  LENSES.forEach(l => {
    const p = l.plain;
    tb.appendChild(el("tr", {}, [
      el("td", {}, [ el("b", {text: tx(l)}),
                     el("small", {cls:"gsub", text: state.lang === "ko" ? l.koDesc : l.enDesc}) ]),
      el("td", {}, defocusStrip(l)),
      el("td", {}, meter(p.glasses, t.lvl)),
      el("td", {}, meter(p.glare, t.lvl)),
      el("td", {}, meter(p.contrast, t.lvlContrast)),
      el("td", {}, meter(p.cost, t.lvlCost)),
    ]));
  });
  tbl.appendChild(tb);
  const body = el("div", {}, [
    el("p", {cls:"hint", style:"padding:12px 18px 0", html:t.guideIntro}),
    el("div", {cls:"tblwrap"}, tbl),
  ]);
  return card(t.guideTitle, null, null, body);
}

/* ==================================================================
   환자 화면 — 진료 때 여쭤볼 것
   ================================================================== */
function patientAskCard(res){
  const t = L();
  const list = el("div", {cls:"tests"});
  res.unknowns.forEach(k => list.appendChild(el("div", {cls:"test"}, [
    ic(IC_ASK),
    el("div", {}, el("span", {text: tx(CRITICAL_UNKNOWN[k]) + (state.lang === "ko" ? " — 검사 결과가 어떤지" : " — what the test showed")}))
  ])));
  res.tests.slice(0, 6).forEach(x => list.appendChild(el("div", {cls:"test"}, [
    ic(IC_CHECK), el("div", {}, el("span", {text: tx(x)}))
  ])));
  const body = el("div", {}, [
    el("p", {cls:"hint", style:"padding:12px 18px", text:t.askIntro}),
    list,
  ]);
  return card(t.askTitle, null, null, body);
}

/* ==================================================================
   상담직원 화면 — 선택 확인과 비용
   비용은 이 브라우저(localStorage)에만 남습니다. 저장소에 커밋되지 않습니다.
   ================================================================== */
const COST_KEY = "iolnav-cost-v1";
function loadCosts(){ try { return JSON.parse(localStorage.getItem(COST_KEY) || "{}"); } catch(e){ return {}; } }
function saveCosts(o){ try { localStorage.setItem(COST_KEY, JSON.stringify(o)); } catch(e){} }
const wonFmt = n => Number(n).toLocaleString(state.lang === "ko" ? "ko-KR" : "en-US");

function decisionCard(res){
  const t = L();
  const costs = loadCosts();
  const body = el("div", {cls:"card-b", style:"display:flex;flex-direction:column;gap:14px"});
  body.appendChild(el("p", {cls:"hint", text:t.decisionHint}));

  const sel = el("select", {id:"decisionSel", "aria-label":t.decisionPick});
  sel.appendChild(el("option", {value:"", text:t.decisionNone}));
  LENSES.forEach(l => {
    const o = el("option", {value:l.id, text: tx(l)});
    if (state.decision === l.id) o.selected = true;
    sel.appendChild(o);
  });
  const field = el("div", {cls:"field"}, [ el("label", {for:"decisionSel", text:t.decisionPick}), sel ]);
  body.appendChild(field);

  const tcb = el("input", {type:"checkbox", id:"decisionToric"});
  tcb.checked = !!state.toric;
  tcb.addEventListener("change", () => { state.toric = tcb.checked; run({scroll:false}); });
  body.appendChild(el("label", {cls:"chk", for:"decisionToric"}, [tcb, el("span", {text:t.decisionToric})]));

  if (state.decision){
    const picked = res.scored.find(x => x.id === state.decision);
    if (picked){
      if (picked.blocked)
        body.appendChild(el("div", {cls:"finding lv-stop", style:"border-top:0;padding-left:0"}, [
          el("div", {cls:"f-stripe"}),
          el("div", {cls:"f-body"}, el("p", {cls:"f-why", text:t.decisionMismatch}))]));
      else if (picked.cautions.length)
        body.appendChild(el("div", {cls:"finding lv-caution", style:"border-top:0;padding-left:0"}, [
          el("div", {cls:"f-stripe"}),
          el("div", {cls:"f-body"}, [
            el("p", {cls:"f-why", text:t.decisionCaution}),
            el("div", {cls:"f-lens"}, picked.cautions.slice(0,5).map(c => el("span", {cls:"chip", text: tx(c.rule).t})))])]));

      const c = costs[state.decision];
      body.appendChild(el("div", {cls:"costrow"}, [
        el("span", {cls:"eyebrow", text:t.costTitle}),
        el("b", {cls:"mono", style:"font-size:16px",
                 text: (c === undefined || c === "" || c === null) ? t.costEmpty : wonFmt(c) + " " + t.costUnit}),
      ]));
    }
  }
  sel.addEventListener("change", () => { state.decision = sel.value || null; run({scroll:false}); });

  /* 비용 설정 */
  const editor = el("div", {cls:"costgrid", hidden:true});
  LENSES.forEach(l => {
    const inp = el("input", {type:"number", min:0, step:10000, id:"cost_"+l.id, placeholder:t.costEmpty});
    if (costs[l.id] !== undefined && costs[l.id] !== null) inp.value = costs[l.id];
    editor.appendChild(el("label", {cls:"costitem", for:"cost_"+l.id}, [ el("span", {text: tx(l)}), inp ]));
  });
  const saveBtn = el("button", {type:"button", cls:"btn", text:t.costSave, onclick:() => {
    const o = {};
    LENSES.forEach(l => { const v = $("#cost_"+l.id).value; if (v !== "") o[l.id] = Number(v); });
    saveCosts(o); run({scroll:false});
  }});
  const toggle = el("button", {type:"button", cls:"btn ghost", text:t.costEdit, onclick:() => {
    editor.hidden = !editor.hidden; saveBtn.hidden = editor.hidden;
  }});
  saveBtn.hidden = true;
  body.appendChild(el("p", {cls:"hint", text:t.costHint}));
  body.appendChild(el("div", {cls:"btnrow"}, [toggle, saveBtn]));
  body.appendChild(editor);

  return card(t.decisionTitle, null, null, body);
}

/* ==================================================================
   인계 코드 패널
   ================================================================== */
function syncRoleLabels(){
  const t = L();
  $("#role_patient").textContent   = t.rolePatient;
  $("#role_counselor").textContent = t.roleCounselor;
  $("#role_doctor").textContent    = t.roleDoctor;
}

let _copyTimer = null;
function copyText(str, btn){
  const done = () => {
    const old = btn.dataset.label || btn.textContent;
    btn.dataset.label = old;
    btn.textContent = L().handoffCopied;
    clearTimeout(_copyTimer);
    _copyTimer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(str).then(done, () => fallback());
  } else fallback();
  function fallback(){
    const ta = el("textarea", {style:"position:fixed;opacity:0"});
    ta.value = str; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch(e){}
    ta.remove();
  }
}

function openHandoff(){
  const t = L();
  const code = encodeHandoff(state.values);
  const url  = handoffUrl(code);
  const host = $("#handoffBody");
  host.textContent = "";

  host.appendChild(el("p", {cls:"hint", html:t.handoffDesc}));

  host.appendChild(el("div", {cls:"field"}, [
    el("span", {cls:"eyebrow", text:t.handoffCodeLabel}),
    el("div", {cls:"codebox mono", id:"handoffCode", text:code}),
  ]));

  host.appendChild(el("div", {cls:"costrow"}, [
    el("span", {cls:"eyebrow", text:t.handoffCheckLabel}),
    el("b", {cls:"mono", style:"font-size:18px;letter-spacing:.12em", text: handoffCheckDigits(code)}),
    el("span", {cls:"hint", text:t.handoffCheckHint}),
  ]));

  const bcopy = el("button", {type:"button", cls:"btn primary", text:t.handoffCopy});
  bcopy.addEventListener("click", () => copyText(code, bcopy));
  const blink = el("button", {type:"button", cls:"btn", text:t.handoffCopyLink});
  blink.addEventListener("click", () => copyText(url, blink));
  host.appendChild(el("div", {cls:"btnrow"}, [bcopy, blink]));

  try {
    host.appendChild(el("div", {cls:"qrbox"}, [
      el("div", {html: qrSvg(url, 176)}),
      el("p", {cls:"hint", text:t.handoffScan}),
    ]));
  } catch(e){
    host.appendChild(el("p", {cls:"hint", text:t.qrFail}));
  }

  /* 코드 불러오기 */
  const inp = el("input", {type:"text", id:"handoffIn", placeholder:t.handoffLoadPh, autocomplete:"off", spellcheck:"false"});
  const msg = el("p", {cls:"hint", id:"handoffMsg"});
  const load = () => {
    const r = decodeHandoff(inp.value);
    if (!r.ok){
      msg.textContent = t.handoffErr[r.reason] || t.handoffErr.charset;
      msg.style.color = "var(--stop)";
      return;
    }
    applyHandoffValues(r.values);
    msg.textContent = t.handoffLoaded;
    msg.style.color = "var(--ok)";
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); load(); } });
  host.appendChild(el("div", {cls:"loadbox"}, [
    el("span", {cls:"eyebrow", text:t.handoffLoadTitle}),
    el("div", {cls:"loadrow"}, [inp, el("button", {type:"button", cls:"btn", text:t.handoffLoadBtn, onclick:load})]),
    msg,
  ]));

  $("#handoffOvl").hidden = false;
  document.body.style.overflow = "hidden";
  bcopy.focus();
}
function closeHandoff(){
  $("#handoffOvl").hidden = true;
  document.body.style.overflow = "";
}
function applyHandoffValues(values){
  state.values = Object.assign({}, values);
  renderForm();
  run({scroll:false});
}
function wireHandoff(){
  $("#handoffClose").addEventListener("click", closeHandoff);
  $("#handoffBackdrop").addEventListener("click", closeHandoff);
  $("#handoffBtn").addEventListener("click", openHandoff);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#handoffOvl").hidden) closeHandoff();
  });
}
/* 주소의 #h=... 로 열렸으면 값을 채웁니다 */
function loadFromHash(){
  const m = /[#&]h=([^&]+)/.exec(location.hash || "");
  if (!m) return;
  const r = decodeHandoff(decodeURIComponent(m[1]));
  if (!r.ok) return;
  applyHandoffValues(r.values);
  run({scroll:false});
}
