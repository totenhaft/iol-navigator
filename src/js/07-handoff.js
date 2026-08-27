/* ------------------------------------------------------------------
   인계 코드 — 환자 → 상담직원 → 의사

   서버가 없는 정적 사이트이므로 입력값을 짧은 코드에 담아 넘깁니다.
   코드는 QR 로도 표시되고, 링크(#h=…)로도 열립니다.

   설계 원칙
   · 이름·생년월일·연락처 같은 개인 식별정보는 코드에 넣지 않습니다.
     사람 확인은 진료실에서 직접 하고, 코드는 임상 입력값만 나릅니다.
   · 스키마가 바뀌면 코드 형식도 바뀝니다. 지문(fingerprint)을 함께 실어
     형식이 다른 코드는 조용히 잘못 읽히는 대신 명확히 거부됩니다.
   · 값을 비운 항목은 '없음'으로 실려서, 받는 쪽에서도 그대로 비어 있습니다.
     (임의의 기본값으로 채우지 않는다는 이 앱의 원칙을 코드에서도 지킵니다)
   ------------------------------------------------------------------ */

const HANDOFF_VER = 1;
/* Crockford Base32 — I·L·O·U 를 뺀 32글자. 손으로 옮겨 적을 때 헷갈리지 않습니다. */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const bitsFor = n => { let b = 1; while ((1 << b) - 1 < n) b++; return b; };
const decimalsOf = step => (String(step).split(".")[1] || "").length;

/* 세 역할의 스키마를 합쳐 코드 형식을 자동으로 만듭니다.
   항목을 추가하면 여기에 자동 반영되고, 지문이 바뀌어 예전 코드는 거부됩니다. */
function buildHandoffSpec(){
  const map = new Map();
  const addField = f => {
    if (f.type === "checks"){
      f.items.forEach(it => map.set(it.key, {key:it.key, kind:"bool", bits:1}));
    } else if (f.type === "select" || f.type === "scale"){
      const prev = map.get(f.key);
      const vals = new Set(prev ? prev.values : []);
      f.options.forEach(o => vals.add(o.v));
      map.set(f.key, {key:f.key, kind:"enum", values:Array.from(vals).sort()});
    } else if (f.type === "number"){
      const prev = map.get(f.key);
      map.set(f.key, {key:f.key, kind:"num",
        min:  prev ? Math.min(prev.min, f.min)   : f.min,
        max:  prev ? Math.max(prev.max, f.max)   : f.max,
        step: prev ? Math.min(prev.step, f.step) : f.step});
    }
  };
  [SECTIONS_PATIENT, SECTIONS_COUNSELOR, SECTIONS_PRO]
    .forEach(secs => secs.forEach(s => s.fields.forEach(addField)));

  const list = Array.from(map.values()).sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  list.forEach(f => {
    if (f.kind === "enum") f.bits = bitsFor(f.values.length);          // 0 = 미입력
    if (f.kind === "num"){
      f.count = Math.round((f.max - f.min) / f.step) + 1;
      f.bits  = bitsFor(f.count - 1);                                  // 앞에 '있음' 1비트가 따로 붙습니다
      f.dec   = decimalsOf(f.step);
    }
  });
  return list;
}
const HANDOFF_SPEC = buildHandoffSpec();

/* 형식 지문 — FNV-1a 32비트에서 하위 16비트 */
function handoffFingerprint(spec){
  const s = spec.map(f => f.kind === "enum" ? `${f.key}:e:${f.values.join(",")}`
                        : f.kind === "num"  ? `${f.key}:n:${f.min}:${f.max}:${f.step}`
                        : `${f.key}:b`).join("|") + "|v" + HANDOFF_VER;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h & 0xffff;
}
const HANDOFF_FP = handoffFingerprint(HANDOFF_SPEC);
/* 코드 전체 길이(비트). 뒤쪽 0 은 잘라서 보내고 읽을 때 다시 채웁니다 —
   비어 있는 항목이 많은 초기 문진일수록 코드가 짧아집니다. */
const HANDOFF_BITS = 20 + HANDOFF_SPEC.reduce((n,f) => n + f.bits + (f.kind === "num" ? 1 : 0), 0);

/* ---- 비트 입출력 ---- */
function bitWriter(){
  const bits = [];
  return {
    bits,
    put(val, n){ for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); },
  };
}
function bitReader(bits){
  let p = 0;
  return {
    left(){ return bits.length - p; },
    take(n){
      if (p + n > bits.length) throw new Error("코드가 너무 짧습니다");
      let v = 0;
      for (let i = 0; i < n; i++) v = (v << 1) | bits[p + i];
      p += n;
      return v >>> 0;
    },
  };
}

/* ---- 값 ↔ 비트 ---- */
function encodeHandoff(values){
  const w = bitWriter();
  w.put(HANDOFF_VER, 4);
  w.put(HANDOFF_FP, 16);

  HANDOFF_SPEC.forEach(f => {
    const raw = values[f.key];
    if (f.kind === "bool"){ w.put(raw === true || raw === "true" ? 1 : 0, 1); return; }

    if (f.kind === "enum"){
      const i = (raw === undefined || raw === null || raw === "") ? -1 : f.values.indexOf(String(raw));
      w.put(i < 0 ? 0 : i + 1, f.bits);
      return;
    }

    // 숫자: '있음' 1비트 + 값
    const n = (raw === null || raw === undefined || raw === "") ? null : Number(raw);
    if (n === null || !Number.isFinite(n)){ w.put(0, 1); return; }
    let idx = Math.round((n - f.min) / f.step);
    idx = Math.max(0, Math.min(f.count - 1, idx));
    w.put(1, 1);
    w.put(idx, f.bits);
  });

  // 5비트 단위로 채워 Base32 로
  while (w.bits.length % 5) w.bits.push(0);
  let out = "";
  for (let i = 0; i < w.bits.length; i += 5){
    let v = 0;
    for (let j = 0; j < 5; j++) v = (v << 1) | w.bits[i + j];
    out += B32[v];
  }
  out = out.replace(/0+$/, "");                 // 뒤쪽 미입력 구간은 잘라냄
  if (out.length < 5) out = out.padEnd(5, "0"); // 버전·지문(20비트)은 항상 남김
  return out.replace(/(.{4})(?=.)/g, "$1-");
}

function normalizeHandoffCode(code){
  return String(code || "")
    .toUpperCase()
    .replace(/[\s\-–—_.]/g, "")
    .replace(/^IOL:?/, "")
    .replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
}

function decodeHandoff(code){
  const s = normalizeHandoffCode(code);
  if (!s) return {ok:false, reason:"empty"};
  const bits = [];
  for (const ch of s){
    const v = B32.indexOf(ch);
    if (v < 0) return {ok:false, reason:"charset", detail:ch};
    for (let i = 4; i >= 0; i--) bits.push((v >>> i) & 1);
  }
  while (bits.length < HANDOFF_BITS) bits.push(0);   // 잘려 온 뒤쪽을 0(미입력)으로 복원
  const r = bitReader(bits);
  try {
    if (r.take(4) !== HANDOFF_VER) return {ok:false, reason:"version"};
    if (r.take(16) !== HANDOFF_FP) return {ok:false, reason:"fingerprint"};
    const values = {};
    HANDOFF_SPEC.forEach(f => {
      if (f.kind === "bool"){ if (r.take(1)) values[f.key] = true; return; }
      if (f.kind === "enum"){
        const i = r.take(f.bits);
        if (i > 0 && i <= f.values.length) values[f.key] = f.values[i - 1];
        return;
      }
      if (!r.take(1)) return;                       // 미입력
      const idx = r.take(f.bits);
      const v = f.min + idx * f.step;
      values[f.key] = Number(v.toFixed(f.dec));
    });
    return {ok:true, values};
  } catch (e) {
    return {ok:false, reason:"short"};
  }
}

/* 구두 확인용 4자리 — 상담직원과 의사가 "같은 코드 맞죠?" 를 말로 맞춰볼 때 씁니다.
   코드 자체의 해시일 뿐 환자 정보가 아닙니다. */
function handoffCheckDigits(code){
  const s = normalizeHandoffCode(code);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return String(h % 10000).padStart(4, "0");
}

/* 코드가 담긴 링크 — 같은 페이지를 다른 기기에서 열면 값이 채워집니다. */
function handoffUrl(code){
  if (typeof location === "undefined") return "#h=" + code;
  const base = location.origin + location.pathname;
  if (location.protocol === "file:") return "#h=" + code;
  return base + "#h=" + code;
}
