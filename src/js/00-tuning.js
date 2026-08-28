/* ==================================================================
   조정 가능한 값들 (설정 화면에서 고칩니다)

   이 파일의 목적은 하나입니다 — **코드 곳곳에 흩어져 있던 숫자를 한곳에
   모으는 것.** 규칙과 엔진은 이제 리터럴 대신 TU("이름") 을 씁니다.
   여기 없는 숫자를 새로 쓰기 시작하면 설정 화면에서 손댈 수 없게 되므로,
   임상적으로 의미 있는 수치는 반드시 여기에 등록하세요.

   ⚠ 여기 값을 바꾸면 임상 판정이 바뀝니다. 문헌 근거가 붙어 있는 수치
   (HOA 0.3/0.5 µm, chord 0.5–0.6 mm, 난시 1.0 D 등)를 바꿀 때는 화면의
   '근거 문헌' 항목도 함께 확인하세요. 도구는 바꾼 값을 그대로 따르며,
   근거와 어긋나는지 스스로 알지 못합니다.
   ================================================================== */

const TUNING_DEFAULT = {
  /* 설문 답의 가중치 */
  wNear:2.2, wInter:1.7, wSpec:2.6, wNight:2.4, wGlare:2.0,
  affordFree:2.4, affordSlight:1.2, affordMinSpec:2,

  /* 빛번짐 감내 4단계가 만드는 압력 (전혀 못 견딤 → 충분히) */
  glare0:2, glare1:0.5, glare2:0, glare3:0,

  /* 예산대 */
  budgetMid:125, budgetLow:25, bandMid:4.0, bandLow:6.5, toricAddMan:75,

  /* 검사 수치 임계값 */
  cutCyl:0.75, cutToric:1.0, cutComa:0.3, cutHoa4:0.3, cutHoa6:0.5,
  cutChordHigh:0.6, cutChordBorder:0.5,
  cutPupilMeso:6.0, cutPupilPhoto:2.5,
  cutAlLong:26.0, cutAlShort:22.0, cutSaAspheric:0.1, cutAgeYoung:55,

  /* 점수 산식:  기본신뢰도 + scoreBase + 선호×scorePref − 감점×scorePenalty + 가산×scoreBoost */
  scoreBase:30, scorePref:3.5, scorePenalty:7, scoreBoost:5,
};

/* 설정 화면을 만들 때 쓰는 표. 항목을 여기 등록하면 화면에 자동으로 나옵니다. */
const TUNING_SPEC = [
  {g:"survey", k:"wNear",  ko:"근거리 요구 가중치", en:"Near demand weight", step:0.1, min:0, max:6},
  {g:"survey", k:"wInter", ko:"중간거리 요구 가중치", en:"Intermediate demand weight", step:0.1, min:0, max:6},
  {g:"survey", k:"wSpec",  ko:"탈안경 요구 가중치", en:"Spectacle-independence weight", step:0.1, min:0, max:6},
  {g:"survey", k:"wNight", ko:"야간 요구 감점 가중치", en:"Night-demand penalty weight", step:0.1, min:0, max:6},
  {g:"survey", k:"wGlare", ko:"빛번짐 감점 가중치", en:"Glare penalty weight", step:0.1, min:0, max:6},
  {g:"survey", k:"affordFree",   ko:"비용 ‘상관없다’ 가산", en:"Bonus when cost is no object", step:0.1, min:0, max:6},
  {g:"survey", k:"affordSlight", ko:"비용 ‘조금’ 가산", en:"Bonus when cost matters slightly", step:0.1, min:0, max:6},
  {g:"survey", k:"affordMinSpec", ko:"가산이 붙는 최소 탈안경 요구 (0~3)", en:"Minimum spectacle-independence for the bonus", step:1, min:0, max:3,
   hint:"이 값보다 탈안경 요구가 낮으면 비용이 여유로워도 비싼 유형을 밀어 올리지 않습니다."},

  {g:"glare", k:"glare0", ko:"‘전혀 못 견딘다’", en:"“Not at all”", step:0.1, min:0, max:4},
  {g:"glare", k:"glare1", ko:"‘조금은 견딘다’", en:"“A little”", step:0.1, min:0, max:4},
  {g:"glare", k:"glare2", ko:"‘웬만큼 견딘다’", en:"“Reasonably”", step:0.1, min:0, max:4},
  {g:"glare", k:"glare3", ko:"‘충분히 견딘다’", en:"“Easily”", step:0.1, min:0, max:4},

  {g:"budget", k:"budgetMid", ko:"‘꽤’의 예산대 (만원, 단안)", en:"Budget for “considerable” (×10k KRW, per eye)", step:5, min:0, max:1000},
  {g:"budget", k:"budgetLow", ko:"‘매우 크다’의 예산대 (만원, 단안)", en:"Budget for “a lot” (×10k KRW, per eye)", step:5, min:0, max:1000},
  {g:"budget", k:"bandMid", ko:"‘꽤’ 초과분 감점 강도", en:"Over-budget penalty, “considerable”", step:0.5, min:0, max:15},
  {g:"budget", k:"bandLow", ko:"‘매우 크다’ 초과분 감점 강도", en:"Over-budget penalty, “a lot”", step:0.5, min:0, max:15},
  {g:"budget", k:"toricAddMan", ko:"난시교정(토릭) 추가금 (만원)", en:"Toric surcharge (×10k KRW)", step:5, min:0, max:500},

  {g:"cut", k:"cutCyl",   ko:"난시교정 계획 확인 기준 (D)", en:"Astigmatism prompting a toric plan (D)", step:0.05, min:0, max:6},
  {g:"cut", k:"cutToric", ko:"토릭 적응증 기준 (D)", en:"Toric indication threshold (D)", step:0.05, min:0, max:6},
  {g:"cut", k:"cutComa",  ko:"각막 코마 기준 (µm)", en:"Corneal coma threshold (µm)", step:0.01, min:0, max:3},
  {g:"cut", k:"cutHoa4",  ko:"각막 HOA 기준 · 4 mm (µm)", en:"Corneal HOA at 4 mm (µm)", step:0.01, min:0, max:3},
  {g:"cut", k:"cutHoa6",  ko:"각막 HOA 기준 · 6 mm (µm)", en:"Corneal HOA at 6 mm (µm)", step:0.01, min:0, max:3},
  {g:"cut", k:"cutChordHigh",   ko:"Chord mu/alpha 높음 (mm)", en:"Chord mu/alpha, high (mm)", step:0.01, min:0, max:2},
  {g:"cut", k:"cutChordBorder", ko:"Chord mu/alpha 경계 (mm)", en:"Chord mu/alpha, borderline (mm)", step:0.01, min:0, max:2},
  {g:"cut", k:"cutPupilMeso",  ko:"암소시 동공 큼 (mm)", en:"Large mesopic pupil (mm)", step:0.1, min:0, max:9},
  {g:"cut", k:"cutPupilPhoto", ko:"명소시 동공 작음 (mm)", en:"Small photopic pupil (mm)", step:0.1, min:0, max:9},
  {g:"cut", k:"cutAlLong",  ko:"긴 안축장 (mm)", en:"Long axial length (mm)", step:0.1, min:18, max:38},
  {g:"cut", k:"cutAlShort", ko:"짧은 안축장 (mm)", en:"Short axial length (mm)", step:0.1, min:18, max:38},
  {g:"cut", k:"cutSaAspheric", ko:"비구면 IOL 매칭 기준 SA (µm)", en:"Corneal SA for an aspheric IOL (µm)", step:0.01, min:-1, max:2},
  {g:"cut", k:"cutAgeYoung", ko:"‘젊은 연령’ 기준 (세)", en:"“Younger patient” threshold (yr)", step:1, min:18, max:90},

  {g:"score", k:"scoreBase",    ko:"기본 점수", en:"Base offset", step:1, min:0, max:80},
  {g:"score", k:"scorePref",    ko:"선호 점수 배율", en:"Preference multiplier", step:0.1, min:0, max:10},
  {g:"score", k:"scorePenalty", ko:"주의 1단위당 감점", en:"Points per caution unit", step:0.5, min:0, max:20},
  {g:"score", k:"scoreBoost",   ko:"가산 1단위당 점수", en:"Points per boost unit", step:0.5, min:0, max:20},
];
const TUNING_GROUPS = [
  {g:"survey", ko:"설문 답의 가중치", en:"Survey answer weights"},
  {g:"glare",  ko:"빛번짐 감내 4단계", en:"Halo-tolerance scale"},
  {g:"budget", ko:"비용 · 예산대", en:"Cost and budget bands"},
  {g:"cut",    ko:"검사 수치 임계값", en:"Measurement thresholds"},
  {g:"score",  ko:"점수 산식", en:"Score formula"},
];

let TUNING = Object.assign({}, TUNING_DEFAULT);
function setTuning(o){
  TUNING = Object.assign({}, TUNING_DEFAULT);
  if (o) Object.keys(TUNING_DEFAULT).forEach(k => {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(v)) TUNING[k] = v;
  });
}
/* 규칙과 엔진은 숫자를 직접 쓰지 않고 이 함수로 읽습니다 */
function TU(k){ return TUNING[k]; }
