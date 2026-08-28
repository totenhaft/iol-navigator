/* ==================================================================
   설정 · 잠금

   ⚠ 여기의 비밀번호는 **보안이 아니라 오조작 방지 장치**입니다.
   이 앱은 서버 없이 브라우저에서만 도는 정적 페이지이므로, 판정 로직도
   금액도 모두 페이지 소스에 들어 있습니다. 소스 보기나 개발자도구를 열면
   비밀번호와 무관하게 볼 수 있습니다. 이 잠금이 막아 주는 것은 '환자가
   화면에서 상담·의사 화면을 눌러 들어가는 일'까지입니다.
   진짜로 가려야 하는 정보라면 서버가 필요합니다.

   저장은 브라우저별(localStorage)입니다. 기기를 바꾸면 설정이 따라가지
   않으므로, 아래 '설정 옮기기'로 옮깁니다.
   ================================================================== */

const SETTINGS_KEY = "iolnav-settings-v1";
const UNLOCK_KEY   = "iolnav-unlocked";

function loadSettings(){
  try {
    const o = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return (o && typeof o === "object") ? o : {};
  } catch(e){ return {}; }
}
function saveSettings(o){
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(o)); } catch(e){}
  applySettings();
}
/* 저장된 값을 엔진에 반영한다. 금액과 조정값 모두 여기를 지난다.
   겹치면  코드 기본값 < config.json(병원 확정값) < 이 기기 설정  순으로 덮는다. */
function applySettings(){
  const s = loadSettings();
  const rc = (typeof REMOTE_CONFIG === "object" && REMOTE_CONFIG) ? REMOTE_CONFIG : {costs:{}, tuning:{}};
  setCostTable(Object.assign({}, rc.costs || {}, s.costs || {}));
  setTuning(Object.assign({}, rc.tuning || {}, s.tuning || {}));
}

/* ---------- 비밀번호 ----------
   해시는 가능하면 SHA-256(Web Crypto)으로, 안 되는 환경(file:// 등)에서는
   약한 대체 해시로 만듭니다. 어느 쪽이든 위의 한계는 그대로입니다. */
async function hashPw(pw, salt){
  const text = salt + " " + pw;
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest){
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return "s256:" + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++){
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + text.charCodeAt(i) * (i + 1), 0x85ebca6b) >>> 0;
  }
  return "weak:" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
const pwIsSet = () => { const p = loadSettings().pw; return !!(p && p.hash); };
async function verifyPw(input){
  const pw = loadSettings().pw;
  if (!pw || !pw.hash) return false;
  return (await hashPw(input, pw.salt)) === pw.hash;
}
async function storePw(input){
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const s = loadSettings();
  s.pw = { salt: salt, hash: await hashPw(input, salt) };
  saveSettings(s);
}

function isUnlocked(){
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch(e){ return !!state._unlocked; }
}
function markUnlocked(v){
  state._unlocked = v;
  try {
    if (v) sessionStorage.setItem(UNLOCK_KEY, "1"); else sessionStorage.removeItem(UNLOCK_KEY);
  } catch(e){}
}

const openOvl  = sel => { $(sel).hidden = false; document.body.style.overflow = "hidden"; };
const closeOvl = sel => { $(sel).hidden = true;  document.body.style.overflow = ""; };

/* ---------- 비밀번호 입력 ----------
   비밀번호가 아직 없으면 '정하기'로, 있으면 '확인'으로 동작합니다. */
function requireUnlock(onOk){
  if (state.roleLocked) return;              // 환자에게 건넨 화면에서는 아예 열지 않는다
  if (isUnlocked()){ onOk(); return; }
  const t = L(), first = !pwIsSet();
  const host = $("#pwBody");
  host.textContent = "";
  host.appendChild(el("p", {cls:"hint", text: first ? t.pwFirstHint : t.pwHint}));

  const inp  = el("input", {type:"password", id:"pwIn",  autocomplete:"current-password"});
  const inp2 = el("input", {type:"password", id:"pwIn2", autocomplete:"new-password"});
  const msg  = el("p", {cls:"hint", id:"pwMsg"});
  host.appendChild(el("div", {cls:"field"}, [ el("label", {for:"pwIn", text: first ? t.pwNew : t.pwEnter}), inp ]));
  if (first) host.appendChild(el("div", {cls:"field"}, [ el("label", {for:"pwIn2", text:t.pwAgain}), inp2 ]));

  const fail = txt => { msg.textContent = txt; msg.style.color = "var(--stop)"; };
  const go = async () => {
    const v = inp.value;
    if (!v){ fail(t.pwEmpty); return; }
    if (first){
      if (v.length < 4){ fail(t.pwShort); return; }
      if (v !== inp2.value){ fail(t.pwMismatch); return; }
      await storePw(v);
    } else if (!(await verifyPw(v))){ fail(t.pwWrong); return; }
    markUnlocked(true);
    closeOvl("#pwOvl");
    onOk();
  };
  [inp, inp2].forEach(n => n.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); go(); }
  }));
  host.appendChild(el("div", {cls:"btnrow"}, [
    el("button", {type:"button", cls:"btn primary", text: first ? t.pwSet : t.pwUnlock, onclick:go}),
  ]));
  host.appendChild(msg);
  host.appendChild(el("p", {cls:"hint", text:t.pwCaveat}));
  openOvl("#pwOvl");
  inp.focus();
}

/* ---------- 설정 화면 ---------- */
function numField(id, label, val, opt){
  const inp = el("input", Object.assign({type:"number", id:id}, opt || {}));
  inp.value = (val === undefined || val === null) ? "" : val;
  return el("label", {cls:"setitem", for:id}, [ el("span", {text:label}), inp ]);
}

function collectSettingsForm(){
  const costs = {};
  LENSES.forEach(l => {
    const lo = $("#set_cmin_" + l.id).value, hi = $("#set_cmax_" + l.id).value;
    if (lo !== "" || hi !== ""){
      const a = lo === "" ? Number(hi) : Number(lo);
      const b = hi === "" ? a : Number(hi);
      costs[l.id] = {min: Math.min(a, b), max: Math.max(a, b)};
    }
  });
  const tuning = {};
  TUNING_SPEC.forEach(x => {
    const v = $("#set_t_" + x.k).value;
    if (v !== "" && Number.isFinite(Number(v))) tuning[x.k] = Number(v);
  });
  return {costs: costs, tuning: tuning};
}

function openSettings(){
  const t = L(), ko = state.lang === "ko";
  const host = $("#setBody");
  host.textContent = "";
  host.appendChild(el("p", {cls:"hint", html:t.setCaveat}));

  /* 1) 비밀번호 */
  const npw  = el("input", {type:"password", id:"setPw1", autocomplete:"new-password"});
  const npw2 = el("input", {type:"password", id:"setPw2", autocomplete:"new-password"});
  const pwMsg = el("p", {cls:"hint"});
  const pwBtn = el("button", {type:"button", cls:"btn", id:"setPwBtn", text:t.pwChange, onclick: async () => {
    if (npw.value.length < 4){ pwMsg.textContent = t.pwShort; pwMsg.style.color = "var(--stop)"; return; }
    if (npw.value !== npw2.value){ pwMsg.textContent = t.pwMismatch; pwMsg.style.color = "var(--stop)"; return; }
    await storePw(npw.value);
    npw.value = ""; npw2.value = "";
    pwMsg.textContent = t.pwChanged; pwMsg.style.color = "var(--ok)";
  }});
  host.appendChild(el("section", {cls:"setsec"}, [
    el("h4", {text:t.setPwTitle}),
    el("div", {cls:"setgrid"}, [
      el("label", {cls:"setitem", for:"setPw1"}, [el("span", {text:t.pwNew}), npw]),
      el("label", {cls:"setitem", for:"setPw2"}, [el("span", {text:t.pwAgain}), npw2]),
    ]),
    el("div", {cls:"btnrow"}, [pwBtn]), pwMsg,
  ]));

  /* 2) 렌즈 비급여 금액 */
  const costGrid = el("div", {cls:"setgrid"});
  LENSES.forEach(l => {
    const cur = COST_MAN[l.id] || {min:"", max:""};
    costGrid.appendChild(el("div", {cls:"setitem"}, [
      el("span", {text: tx(l)}),
      el("div", {cls:"costpair"}, [
        el("input", {type:"number", id:"set_cmin_" + l.id, min:0, step:5, value:cur.min,
                     "aria-label": tx(l) + " " + t.costMinLabel}),
        el("span", {cls:"unit", text:"–"}),
        el("input", {type:"number", id:"set_cmax_" + l.id, min:0, step:5, value:cur.max,
                     "aria-label": tx(l) + " " + t.costMaxLabel}),
        el("span", {cls:"unit", text: ko ? t.manWon : "×10k"}),
      ]),
    ]));
  });
  host.appendChild(el("section", {cls:"setsec"}, [
    el("h4", {text:t.setCostTitle}), el("p", {cls:"hint", text:t.costStale}), costGrid,
  ]));

  /* 3) 조정값 — TUNING_SPEC 을 그대로 화면으로 */
  TUNING_GROUPS.forEach(g => {
    const grid = el("div", {cls:"setgrid"});
    TUNING_SPEC.filter(x => x.g === g.g).forEach(x => {
      grid.appendChild(numField("set_t_" + x.k, ko ? x.ko : x.en, TUNING[x.k],
        {step:x.step, min:x.min, max:x.max}));
      if (x.hint && ko) grid.appendChild(el("p", {cls:"hint", style:"grid-column:1/-1;margin-top:-4px", text:x.hint}));
    });
    host.appendChild(el("section", {cls:"setsec"}, [ el("h4", {text: ko ? g.ko : g.en}), grid ]));
  });

  /* 4) 저장 · 되돌리기 · 옮기기 */
  const msg = el("p", {cls:"hint"});
  const save = el("button", {type:"button", cls:"btn primary", id:"setSaveBtn", text:t.costSave, onclick:() => {
    const cur = loadSettings();
    saveSettings(Object.assign({}, cur, collectSettingsForm()));
    msg.textContent = t.setSaved; msg.style.color = "var(--ok)";
    if (state.last) run({scroll:false});
  }});
  const reset = el("button", {type:"button", cls:"btn", id:"setResetBtn", text:t.setResetAll, onclick:() => {
    const cur = loadSettings();
    saveSettings({pw: cur.pw});          // 비밀번호는 남긴다
    if (state.last) run({scroll:false});
    openSettings();
    $("#setBody").appendChild(el("p", {cls:"hint", style:"color:var(--ok)", text:t.setReset}));
  }});
  host.appendChild(el("div", {cls:"btnrow"}, [save, reset]));
  host.appendChild(msg);

  /* 4-b) 병원 공통 설정 — config.json */
  const cfgSec = el("section", {cls:"setsec"}, [ el("h4", {text:t.setCfgTitle}) ]);
  if (REMOTE_CONFIG.loaded){
    cfgSec.appendChild(el("p", {cls:"hint", style:"color:var(--ok)", text:
      t.setCfgLoaded.replace("{v}", String(REMOTE_CONFIG.version))
                    .replace("{c}", String(Object.keys(REMOTE_CONFIG.costs).length))
                    .replace("{t}", String(Object.keys(REMOTE_CONFIG.tuning).length))}));
  } else {
    cfgSec.appendChild(el("p", {cls:"hint", text:t.setCfgNone}));
  }
  cfgSec.appendChild(el("p", {cls:"hint", text:t.setCfgHint}));
  const cfgTa  = el("textarea", {id:"setCfgJson", rows:6, spellcheck:"false", readonly:"readonly",
                                 "aria-label":t.setCfgTitle});
  const cfgMsg = el("p", {cls:"hint"});
  cfgSec.appendChild(el("div", {cls:"btnrow"}, [
    el("button", {type:"button", cls:"btn", id:"setCfgBtn", text:t.setCfgMake, onclick:() => {
      cfgTa.value = buildConfigJson();
      cfgMsg.textContent = t.setCfgMade; cfgMsg.style.color = "var(--ok)";
      cfgTa.focus(); cfgTa.select();
    }}),
  ]));
  cfgSec.appendChild(cfgTa);
  cfgSec.appendChild(cfgMsg);
  host.appendChild(cfgSec);

  const ta = el("textarea", {id:"setJson", rows:4, spellcheck:"false", "aria-label":t.setMoveTitle});
  ta.value = JSON.stringify(collectSettingsForm());
  const impMsg = el("p", {cls:"hint"});
  const imp = el("button", {type:"button", cls:"btn", id:"setImportBtn", text:t.setImport, onclick:() => {
    try {
      const o = JSON.parse(ta.value);
      if (!o || typeof o !== "object") throw new Error("bad");
      const cur = loadSettings();
      saveSettings({pw: cur.pw, costs: o.costs || {}, tuning: o.tuning || {}});
      if (state.last) run({scroll:false});
      openSettings();
      $("#setBody").appendChild(el("p", {cls:"hint", style:"color:var(--ok)", text:t.setImported}));
    } catch(e){ impMsg.textContent = t.setImportBad; impMsg.style.color = "var(--stop)"; }
  }});
  host.appendChild(el("section", {cls:"setsec"}, [
    el("h4", {text:t.setMoveTitle}), el("p", {cls:"hint", text:t.setMoveHint}), ta,
    el("div", {cls:"btnrow"}, [imp]), impMsg,
  ]));

  openOvl("#setOvl");
  $("#setOvl").querySelector(".ovl-card").scrollTop = 0;
}

function wireSettings(){
  applySettings();
  $("#setClose").addEventListener("click", () => closeOvl("#setOvl"));
  $("#setBackdrop").addEventListener("click", () => closeOvl("#setOvl"));
  $("#pwClose").addEventListener("click", () => closeOvl("#pwOvl"));
  $("#pwBackdrop").addEventListener("click", () => closeOvl("#pwOvl"));
  $("#setBtn").addEventListener("click", () => requireUnlock(openSettings));
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$("#setOvl").hidden) closeOvl("#setOvl");
    else if (!$("#pwOvl").hidden) closeOvl("#pwOvl");
  });
}
