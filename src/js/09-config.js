/* ==================================================================
   병원 공통 설정 (config.json)

   GitHub Pages 는 파일만 내려 주는 정적 호스팅이라 서버가 없습니다.
   그래도 '읽기 전용 서버'로는 쓸 수 있습니다 — 저장소에 config.json 을
   두고 앱이 켜질 때 읽어 오면, 파일 하나를 커밋하는 것으로 원장님·상담실·
   환자 기기가 모두 같은 값을 쓰게 됩니다.

   값이 겹칠 때의 우선순위:
       코드 기본값  <  config.json(병원 확정값)  <  이 기기 설정(실험용)

   기기 설정이 병원 값을 덮는 것은 일부러 그렇게 둔 것입니다. 원장님이
   설정 화면에서 시험해 보는 동안 배포된 값이 그걸 계속 되돌리면 곤란하니까요.
   대신 config.json 의 version 을 올려 커밋하면, 그 파일에 들어 있는 항목에
   한해 기기에 남아 있던 개별 설정을 지우고 병원 값으로 맞춥니다.

   ⚠ config.json 은 공개 저장소에 그대로 올라갑니다. 금액이 들어가지만
   이미 페이지 소스에도 들어 있으므로 노출 수준은 같습니다. 환자 정보는
   이 파일에도, 어디에도 올라가지 않습니다.

   되쓰기(브라우저에서 config.json 을 고쳐 커밋)는 하지 않습니다. 쓰기에는
   깃허브 토큰이 필요한데, 정적 사이트에 토큰을 넣으면 주소만 아는 사람이
   임상 파라미터를 바꿀 수 있게 됩니다. 확정값은 사람이 커밋합니다.
   ================================================================== */

const CONFIG_URL      = "config.json";
const CONFIG_SEEN_KEY = "iolnav-config-seen";
const CONFIG_TIMEOUT  = 3000;

let REMOTE_CONFIG = { version: 0, costs: {}, tuning: {}, loaded: false };

/* 받아온 값을 그대로 믿지 않고, 아는 항목·숫자·허용 범위만 통과시킵니다.
   범위를 벗어난 값은 조용히 무시하지 않고 콘솔에 남깁니다. */
function sanitizeConfig(raw){
  const out = { version: 0, costs: {}, tuning: {}, loaded: true, dropped: [] };
  if (!raw || typeof raw !== "object") return out;

  const ver = Number(raw.version);
  out.version = Number.isFinite(ver) ? ver : 0;

  const costs = (raw.costs && typeof raw.costs === "object") ? raw.costs : {};
  LENSES.forEach(l => {
    const v = costs[l.id];
    if (v === undefined) return;
    if (!v || typeof v !== "object"){ out.dropped.push("costs." + l.id); return; }
    const lo = Number(v.min), hi = Number(v.max);
    const a = Number.isFinite(lo) ? lo : hi;
    const b = Number.isFinite(hi) ? hi : a;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0){
      out.dropped.push("costs." + l.id); return;
    }
    out.costs[l.id] = { min: Math.min(a, b), max: Math.max(a, b) };
  });
  Object.keys(costs).forEach(k => {
    if (!LENSES.some(l => l.id === k)) out.dropped.push("costs." + k + " (모르는 렌즈)");
  });

  const tuning = (raw.tuning && typeof raw.tuning === "object") ? raw.tuning : {};
  TUNING_SPEC.forEach(x => {
    if (tuning[x.k] === undefined) return;
    const v = Number(tuning[x.k]);
    if (!Number.isFinite(v)){ out.dropped.push("tuning." + x.k); return; }
    if (x.min !== undefined && v < x.min){ out.dropped.push("tuning." + x.k + " (최소 " + x.min + " 미만)"); return; }
    if (x.max !== undefined && v > x.max){ out.dropped.push("tuning." + x.k + " (최대 " + x.max + " 초과)"); return; }
    out.tuning[x.k] = v;
  });
  Object.keys(tuning).forEach(k => {
    if (!TUNING_SPEC.some(x => x.k === k)) out.dropped.push("tuning." + k + " (모르는 항목)");
  });

  return out;
}

/* config.json 을 적용합니다. version 이 지난번보다 올라갔으면, 그 파일이
   정해 준 항목에 한해 이 기기의 개별 설정을 지워 병원 값으로 맞춥니다. */
function applyRemoteConfig(raw){
  REMOTE_CONFIG = sanitizeConfig(raw);
  if (REMOTE_CONFIG.dropped.length){
    console.warn("config.json 에서 무시한 항목:", REMOTE_CONFIG.dropped.join(", "));
  }

  let seen = 0;
  try { seen = Number(localStorage.getItem(CONFIG_SEEN_KEY) || 0) || 0; } catch(e){}

  if (REMOTE_CONFIG.version > seen){
    try { localStorage.setItem(CONFIG_SEEN_KEY, String(REMOTE_CONFIG.version)); } catch(e){}
    const s = loadSettings();
    let changed = false;
    Object.keys(REMOTE_CONFIG.costs).forEach(k => {
      if (s.costs && k in s.costs){ delete s.costs[k]; changed = true; }
    });
    Object.keys(REMOTE_CONFIG.tuning).forEach(k => {
      if (s.tuning && k in s.tuning){ delete s.tuning[k]; changed = true; }
    });
    if (changed){ saveSettings(s); return REMOTE_CONFIG; }   // saveSettings 가 applySettings 를 부른다
  }
  applySettings();
  return REMOTE_CONFIG;
}

/* file:// 로 열었거나 파일이 없으면 조용히 넘어갑니다 — 그 경우 코드 기본값과
   이 기기 설정만으로 정상 동작합니다. 오프라인에서도 앱이 멈추면 안 됩니다. */
async function loadRemoteConfig(){
  if (typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return false;
  if (typeof fetch !== "function") return false;
  let timer = null;
  try {
    const ctl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    if (ctl) timer = setTimeout(() => ctl.abort(), CONFIG_TIMEOUT);
    /* Pages 의 캐시에 걸려 옛 값이 오래 남지 않도록 매번 새로 받습니다. */
    const res = await fetch(CONFIG_URL + "?t=" + Date.now(),
                            { cache: "no-store", signal: ctl ? ctl.signal : undefined });
    if (timer){ clearTimeout(timer); timer = null; }
    if (!res.ok) return false;
    applyRemoteConfig(await res.json());
    return true;
  } catch(e){
    if (timer) clearTimeout(timer);
    return false;
  }
}

/* 설정 화면의 '지금 값으로 config.json 만들기' 가 뱉는 내용 */
function buildConfigJson(){
  const cur = collectSettingsForm();
  return JSON.stringify({
    version: (REMOTE_CONFIG.version || 0) + 1,
    note: "연세솔안과 확정값. 이 파일을 고쳐 커밋하면 모든 기기에 반영됩니다. 값을 바꿀 때마다 version 을 1 올리세요.",
    costs: cur.costs,
    tuning: cur.tuning,
  }, null, 2);
}

/* 앱 시작 — config.json 을 먼저 읽고 나서 화면을 그립니다.
   실패하거나 3초를 넘기면 기다리지 않고 기본값으로 시작합니다. */
async function start(){
  try { await loadRemoteConfig(); } catch(e){}
  boot();
}
