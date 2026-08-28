/* =====================================================================
   IOL 내비게이터 — 근거 기반 인공수정체 선택 보조 엔진
   Evidence-based intraocular lens selection support engine
   ===================================================================== */
"use strict";

/* ------------------------------------------------------------------
   근거 수준 (Evidence grade)
   A  체계적 문헌고찰 / 메타분석 / RCT
   B  국제 표준(ISO/ANSI) · 대규모 관찰연구
   C  소규모·후향적 관찰연구 (수치 cut-off 재현성 제한)
   D  전문가 합의 · 종설 · 임상 관행 (정량적 cut-off 근거 부족)
   ------------------------------------------------------------------ */

const REFS = {
  R1:{ n:"Cochrane 2016 — 다초점 vs 단초점 IOL", en:"Cochrane 2016 — Multifocal vs monofocal IOLs",
       cite:"de Silva SR, Evans JR, et al. Cochrane Database Syst Rev. 2016;12:CD003169.",
       key:"안경 의존도 감소 RR 0.63 (95% CI 0.55–0.73, 근거수준 low) · 눈부심(glare) RR 1.41 (1.03–1.93, low) · 헤일로(halo) RR 3.58 (1.99–6.46, moderate)",
       keyEn:"Spectacle dependence RR 0.63 (0.55–0.73, low certainty); glare RR 1.41 (1.03–1.93, low); halo RR 3.58 (1.99–6.46, moderate)",
       url:"https://pubmed.ncbi.nlm.nih.gov/27943250/", grade:"A" },
  R2:{ n:"Eye 2025 — enhanced monofocal 메타분석", en:"Eye 2025 — Enhanced vs monofocal meta-analysis",
       cite:"Visual and patient-reported outcomes of enhanced versus monofocal IOLs. Eye (Lond). 2025.",
       key:"중간거리 DCIVA −0.11 logMAR (−0.13~−0.10), 근거리 DCNVA −0.12 (−0.17~−0.07) ≈ 각 1줄 개선 · 원거리 CDVA 차이 없음(high certainty) · 광학현상 OR 1.13 (0.79–1.63, 단초점과 동등) · 중간거리 탈안경 OR 7.85 (4.08–15.09)",
       keyEn:"DCIVA −0.11 logMAR, DCNVA −0.12 (≈1 line each); CDVA no difference (high certainty); troublesome photic phenomena OR 1.13 (0.79–1.63); intermediate spectacle independence OR 7.85",
       url:"https://www.nature.com/articles/s41433-025-03625-4", grade:"A" },
  R3:{ n:"ISO 11979-7:2024 — 동시시 IOL 분류 표준", en:"ISO 11979-7:2024 — SVIOL classification",
       cite:"ISO 11979-7:2024 Ophthalmic implants — Intraocular lenses — Part 7: Clinical investigations.",
       key:"동시시 IOL(SVIOL)을 MIOL / EDOF / FVR 3군으로 규정 · EDOF: 0.20 logMAR 기준 음의 탈초점 범위가 단초점 대조군보다 ≥0.5 D 넓을 것 · FVR: DCIVA·DCNVA 모두 ≤0.20 logMAR · 전 군 공통 단안 암소시 대비감도 변화 ≤0.3 log unit",
       keyEn:"Defines MIOL / EDOF / FVR. EDOF: negative defocus range at 0.20 logMAR ≥0.5 D greater than monofocal control. FVR: DCIVA and DCNVA both ≤0.20 logMAR. Mesopic contrast sensitivity change ≤0.3 log unit.",
       url:"https://www.ophthalmologytimes.com/view/iso-issues-new-standards-for-presbyopia-correcting-iol-classification", grade:"B" },
  R4:{ n:"ANSI Z80.35 — EDOF 정의 기준 (AAO task force)", en:"ANSI Z80.35 — EDOF criteria",
       cite:"AAO/ASCRS/ANSI Z80.35 EDOF task force criteria. (EyeWiki 요약)",
       key:"EDOF 표방 요건: ≥100안 대조연구 · 0.2 logMAR에서 단안 초점심도가 단초점 대비 ≥0.5 D · 66 cm 명소시 중간거리 시력이 통계적으로 우월 · ≥50%가 66 cm에서 ≤0.2 logMAR · 원거리 시력 비열등",
       keyEn:"≥100 eyes with matched controls; monocular depth of focus ≥0.5 D beyond monofocal at 0.2 logMAR; superior mean 66 cm photopic intermediate VA; ≥50% of eyes ≤0.2 logMAR at 66 cm; non-inferior distance VA",
       url:"https://eyewiki.org/Extended_Depth_of_Focus_IOLs", grade:"B" },
  R5:{ n:"ESCRS Functional Vision WG — 기능적 분류", en:"ESCRS Functional Vision WG — functional classification",
       cite:"Ribeiro F, et al. Evidence-based functional classification of simultaneous vision IOLs. J Cataract Refract Surg. 2024;50(8):794–798.",
       key:"탈초점 곡선 기반 분류 — 부분 시야범위(Partial ROF): narrow(표준 단초점) / enhanced(monofocal-plus = 프리미엄 단초점) / extended(EDOF), 전 시야범위(Full ROF): continuous·smooth·steep transition. ‘프리미엄 단초점’은 EDOF가 아니라 enhanced 군",
       keyEn:"Defocus-curve based: Partial ROF (narrow = standard monofocal / enhanced = monofocal-plus / extended = EDOF) and Full ROF (continuous, smooth, steep transition). Enhanced monofocals are NOT EDOF.",
       url:"https://www.escrs.org/channels/eurotimes-articles/sorting-out-simultaneous-vision-iols", grade:"B" },
  R6:{ n:"EyeWiki — Optical Axes & Angle Kappa", en:"EyeWiki — Optical Axes and Angle Kappa",
       cite:"EyeWiki, American Academy of Ophthalmology. Optical Axes and Angle Kappa.",
       key:"chord mu 평균 ≈0.3 mm, chord alpha 평균 0.45–0.5 mm · 관행적 회피 기준 ≈0.5–0.6 mm(기기·렌즈별 상이) · 그러나 26,470안 자료에서 술전 angle kappa와 술후 시력·만족도 간 임상적 유의 관계 없음 → 단독 변수로 다초점 적응증을 결정할 수 없음 · 장비 간 편차 큼(Orbscan II 0.43 mm vs Galilei G4 0.27 mm, 동일 안)",
       keyEn:"Chord mu mean ≈0.3 mm; chord alpha 0.45–0.5 mm. Commonly cited avoid-threshold ≈0.5–0.6 mm, but the largest dataset (26,470 eyes) found no clinically meaningful relationship with outcomes; large inter-device variability.",
       url:"https://eyewiki.org/Optical_Axes_and_Angle_Kappa", grade:"C" },
  R7:{ n:"CRST 2023 — 고위수차와 회절형 다초점 IOL", en:"CRST 2023 — HOAs and diffractive multifocal IOLs",
       cite:"Higher-Order Aberrations and Diffractive Multifocal IOLs. Cataract & Refractive Surgery Today. 2023 Jul.",
       key:"관행적 기준 HOA RMS <0.3 µm @4 mm · 저자 명시: “실질적 가이드라인은 없다”, 근거 논문 2편뿐 · 378명 자체 분석에서 HOA와 만족도 간 상관 없음(17%가 0.3 µm 초과) · 최대 예측인자는 나안 원거리 시력",
       keyEn:"Conventional threshold RMS HOA <0.3 µm at 4 mm, but the author states there are 'no real guidelines'; in 378 patients no correlation between HOA and satisfaction (17% exceeded 0.3 µm). UDVA was the strongest satisfaction predictor.",
       url:"https://crstoday.com/articles/july-2023/higher-order-aberrations-and-diffractive-multifocal-iols", grade:"C" },
  R8:{ n:"Review of Ophthalmology — 각막 분석 기반 IOL 선택", en:"Review of Ophthalmology — Using corneal analysis to choose an IOL",
       cite:"Using Corneal Analysis To Help Choose an IOL. Review of Ophthalmology.",
       key:"HOA 0.3 µm @4 mm ≈ 0.5 D 탈초점에 해당하는 흐림 · 각막 구면수차(SA) 백인 평균 +0.27 µm @6 mm · SA ≥0.1 µm → 음의 구면수차 비구면 IOL, <0.1 µm → 무수차(aberration-neutral) IOL · 4 mm=주간, 5 mm=야간 조건 대용 · 술후 정규난시 <1.0 D 유지, 원주 ≥1.5 D면 토릭 고려",
       keyEn:"HOA 0.3 µm @4 mm ≈ blur of 0.5 D defocus; mean corneal SA +0.27 µm @6 mm; SA ≥0.1 µm → aspheric IOL, <0.1 µm → aberration-neutral; keep postoperative regular astigmatism <1.0 D, consider toric at ≥1.5 D.",
       url:"https://www.reviewofophthalmology.com/article/using-corneal-analysis-to-help-choose-an-iol", grade:"D" },
  R9:{ n:"CRST 2024 — 굴절교정수술 후 다초점 IOL", en:"CRST 2024 — Multifocal IOLs after refractive surgery",
       cite:"Myth: Multifocal IOLs Are Unsuitable for Patients With a History of Refractive Surgery. CRST. 2024 Oct.",
       key:"라식/라섹 과거력이 절대 금기는 아님 · 3년 후향 분석 기준: HOA <0.5 µm @6 mm, 구면수차 <0.6 µm를 넘으면 불만족 증가 · 신경적응(neuroadaptation) 2–3개월~1년 소요를 술전 설명 필수 · RK는 별도 취급",
       keyEn:"Prior LVC is not an absolute contraindication. Retrospective 3-year review: HOA <0.5 µm at 6 mm and spherical aberration <0.6 µm; exceeding these was associated with dissatisfaction. Neuroadaptation takes 2–3 months to 1 year.",
       url:"https://crstoday.com/articles/oct-2024/multifocal-iols-are-unsuitable-for-patients-with-a-history-of-refractive-surgery", grade:"C" },
  R10:{ n:"ASCRS 2019 — 술전 안구표면질환 알고리즘", en:"ASCRS 2019 — Preoperative OSD algorithm",
       cite:"Starr CE, et al. An algorithm for the preoperative diagnosis and treatment of ocular surface disorders. J Cataract Refract Surg. 2019;45(5):669–684.",
       key:"전 백내장·굴절수술 환자에 OSD 선별 필수 — ASCRS SPEED II 설문 + 눈물삼투압 + MMP-9 + LLPP 진찰(눈깜빡임·눈꺼풀·눈물띠·속눈썹·마이봄샘) · 시력에 영향을 주는(visually significant) OSD는 반드시 치료 후 생체계측을 다시 하고 수술 진행",
       keyEn:"Screen every cataract/refractive candidate: ASCRS SPEED II + tear osmolarity + MMP-9 + LLPP exam. Visually significant OSD must be treated and biometry repeated before surgery.",
       url:"https://pubmed.ncbi.nlm.nih.gov/31030780/", grade:"B" },
  R11:{ n:"Glaucoma Today — 녹내장 환자의 IOL 선택", en:"Glaucoma Today — IOL selection for glaucoma patients",
       cite:"IOL Selection for Glaucoma Patients. Glaucoma Today. 2019 Nov/Dec.",
       key:"녹내장 의증·조절 양호한 초기 녹내장은 프리미엄 IOL 고려 가능 · 중등도~중증 녹내장은 상대적 금기 · 녹내장은 시력보다 대비감도를 먼저 침범하므로 다초점의 대비감도 저하와 중첩 · EDOF는 다초점보다 대비감도 보존이 나음 · PXF·약한 소대에서는 토릭·조절성 IOL 주의",
       keyEn:"Premium IOLs acceptable in suspects and well-controlled early glaucoma; moderate–severe glaucoma is a relative contraindication. Glaucoma impairs contrast sensitivity preferentially, compounding multifocal losses; EDOF preserves contrast better than MIOL.",
       url:"https://glaucomatoday.com/articles/2019-nov-dec/iol-selection-for-glaucoma-patients", grade:"D" },
  R12:{ n:"CRST Europe 2019 — 프리미엄 IOL을 피해야 할 환자", en:"CRST Europe 2019 — Patients who should never receive a premium IOL",
       cite:"Patients Who Should Never Receive a Premium IOL. CRST Europe. 2019 May.",
       key:"증식성 당뇨망막병증은 프리미엄 IOL 금기로 명시 · 현미경·확대경 상시 사용 직업군에는 다초점 비삽입 · 비현실적 기대·불안 성향은 상대적 금기 · 난시 >1.25 D는 배제 기준으로 거론(저자는 0.75 D부터 교정)",
       keyEn:"PDR explicitly stated as a contraindication; multifocals avoided in microscope/magnifier occupations; unrealistic expectations and anxious personality are relative contraindications; astigmatism >1.25 D cited as an exclusion unless corrected.",
       url:"https://crstodayeurope.com/articles/2019-may/patients-who-should-never-receive-a-premium-iol/", grade:"D" },
  R13:{ n:"EyeWiki — Toric IOLs", en:"EyeWiki — Toric IOLs",
       cite:"EyeWiki, American Academy of Ophthalmology. Toric IOLs.",
       key:"각막난시 ≥1.0 D에서 토릭 IOL이 보편적으로 권고 · 대부분 모델이 0.75–4.75 D 각막난시 교정 · 축이 3° 어긋날 때마다 교정효과 약 10% 감소, 약 30°에서 효과 소실 · 불규칙난시·확장증·소대 불안정·산동 불량은 상대적 금기",
       keyEn:"Toric IOLs universally recommended at ≥1.0 D corneal astigmatism; models cover 0.75–4.75 D; ~10% loss of effect per 3° of misalignment, total loss near 30°; irregular astigmatism, ectasia, zonular instability and poor dilation are relative contraindications.",
       url:"https://eyewiki.org/Toric_IOLs", grade:"C" },
  R14:{ n:"EyeWiki — 고도근시와 백내장수술", en:"EyeWiki — High myopia and cataract surgery",
       cite:"EyeWiki, American Academy of Ophthalmology. High Myopia and Cataract Surgery.",
       key:"안축장 >26 mm에서 술후 망막박리 위험 0.9–3.8%, 33.6–35.5 mm에서는 11%까지 상승 · 고도근시 기준 안축장 ≥26.5 mm(또는 SE ≥−6.0 D), 병적근시 ≥32.5 mm · 근시성 망막변성이 최종시력을 제한하는 독립 인자",
       keyEn:"Retinal detachment risk 0.9–3.8% for AL >26 mm, up to 11% at 33.6–35.5 mm. High myopia AL ≥26.5 mm; pathologic myopia ≥32.5 mm. Myopic degeneration independently limits final acuity.",
       url:"https://eyewiki.org/High_Myopia_and_Cataract_Surgery", grade:"C" },
  R15:{ n:"Eye & Vision 2022 — 신경적응 실패와 IOL 교환", en:"Eye & Vision 2022 — MIOL exchange for neuroadaptation failure",
       cite:"Multifocal intraocular lens exchange to monofocal for the management of neuroadaptation failure. Eye Vis (Lond). 2022;9:41.",
       key:"신경적응 실패는 대개 술후 6개월 이내에 드러남 · 본 증례군의 IOL 교환까지 평균 15개월 · 시력이 좋아도 헤일로·글레어·왁시비전이 지속될 수 있으며 술전 설명이 핵심",
       keyEn:"Neuroadaptation failure typically manifests within the first 6 months; mean time to exchange was 15 months in this series. Symptoms persist despite good acuity — preoperative counselling is critical.",
       url:"https://link.springer.com/article/10.1186/s40662-022-00311-4", grade:"C" },
  R16:{ n:"AAO Cataract in the Adult Eye PPP 2021", en:"AAO Cataract in the Adult Eye PPP 2021",
       cite:"American Academy of Ophthalmology. Cataract in the Adult Eye Preferred Practice Pattern. Ophthalmology. 2022;129(1):P1–P126.",
       key:"백내장 수술 표준 진료지침 — 술전 평가 항목, 동반 안질환 평가, 노안교정 IOL 사용 시 기대치 상담과 동반질환 확인의 중요성",
       keyEn:"Standard of care for cataract evaluation; emphasises comorbidity assessment and expectation counselling before presbyopia-correcting IOLs.",
       url:"https://www.aaojournal.org/article/S0161-6420(21)00750-8/fulltext", grade:"B" },
  R17:{ n:"Scoping review 2023 — enhanced monofocal의 위치", en:"Scoping review 2023 — positioning of enhanced monofocals",
       cite:"Positioning of enhanced monofocal IOLs between conventional monofocal and EDOF lenses: a scoping review. 2023.",
       key:"프리미엄 단초점(enhanced monofocal)은 단초점과 EDOF 사이에 위치 — 중간거리를 개선하지만 EDOF의 초점심도 기준(ISO/ANSI)은 충족하지 않음",
       keyEn:"Enhanced monofocals sit between conventional monofocals and EDOF lenses: better intermediate vision but they do not meet the ISO/ANSI depth-of-focus criteria for EDOF.",
       url:"https://pubmed.ncbi.nlm.nih.gov/36918799/", grade:"B" },
  R18:{ n:"CRST 2022 — 불규칙 각막에서의 소구경 IOL", en:"CRST 2022 — Small-aperture IOL for irregular corneas",
       cite:"An Excellent Option for Irregular Corneas (small-aperture IOL). CRST. 2022 Apr.",
       key:"소구경(핀홀) IOL은 방사상각막절개(RK)·불규칙난시·각막이식 후 등 불규칙 각막에서 고위수차 영향을 줄여 시력을 개선 · 단안 삽입이 원칙 · 망막·시신경 질환, 안저 관찰·유리체수술 필요 시 부적합",
       keyEn:"Small-aperture (pinhole) IOLs mitigate higher-order aberrations in irregular corneas (post-RK, irregular astigmatism, post-keratoplasty). Implanted monocularly; unsuitable when retinal/optic nerve disease or future vitreoretinal surgery/fundus view is a concern.",
       url:"https://crstoday.com/crst-issues/apr-2022/an-excellent-option-for-irregular-corneas/44707/", grade:"D" },
  R19:{ n:"Ophthalmology 2021 — 환자와 IOL의 매칭", en:"Ophthalmology 2021 — Matching the patient to the IOL",
       cite:"Matching the Patient to the Intraocular Lens. Ophthalmology. 2021;128(11):e114–e127.",
       key:"동반 안질환(황반질환·녹내장·각막질환), 각막 광학, 기대치를 통합해 IOL을 선택해야 하며 단일 지표로 결정하지 않는다는 종합 권고",
       keyEn:"Comprehensive review: IOL choice must integrate ocular comorbidity, corneal optics and patient expectations rather than any single metric.",
       url:"https://www.aaojournal.org/article/S0161-6420(20)30843-5/fulltext", grade:"B" }
};

/* ------------------------------------------------------------------
   렌즈 카테고리
   cap: 0–3 상대 성능 (far/inter/near/night=야간 광학현상 적음/contrast/cost=비용부담 적음)
   band: 탈초점 글리프 — [원거리%, 중간%, 근거리%] 비율
   base: 근거 기반 기본 신뢰도 가산점
   ------------------------------------------------------------------ */
const LENSES = [
  { id:"mono",      ko:"단초점", en:"Standard monofocal",
    koSub:"Partial ROF · narrow", enSub:"Partial ROF · narrow",
    cap:{far:3, inter:1,   near:0,   night:3,   contrast:3},
    band:[78,18,4], base:20,
    plain:{glasses:3, glare:0, contrast:3},
    koPlain:"먼 곳 한 거리에 초점을 맞춥니다. 밤에 빛 번짐이 가장 적고 보이는 선명함이 가장 안정적인 대신, 책·휴대폰과 컴퓨터 거리는 안경이 필요합니다.",
    enPlain:"Focuses at one distance, usually far. The least night glare and the steadiest clarity, but reading and computer distance need glasses.",
    koDesc:"한 거리(대개 원거리)에만 초점. 대비감도와 야간 시질이 가장 안정적이며, 근거리·중간거리는 안경이 필요합니다.",
    enDesc:"Single focus (usually distance). Best contrast and night-vision stability; glasses needed for intermediate and near." },

  { id:"monoBlend", ko:"단초점 + 미니모노비전", en:"Monofocal with mini-monovision",
    koSub:"blended vision · −0.75~−1.25 D", enSub:"blended vision · −0.75 to −1.25 D",
    cap:{far:2.8, inter:2,  near:1.5, night:2.8, contrast:3},
    band:[52,30,18], base:16,
    plain:{glasses:2, glare:0, contrast:3},
    koPlain:"한쪽 눈은 먼 곳, 다른 쪽 눈은 조금 가까운 곳에 맞춰 두 눈이 서로 보완하게 합니다. 밤 빛 번짐은 거의 없지만 두 눈이 익숙해지는 기간이 필요합니다.",
    enPlain:"One eye is set for distance and the other slightly nearer, so the two eyes complement each other. Almost no night glare, but the eyes need time to adapt.",
    koDesc:"주시안은 원거리, 반대눈은 약간 근시로 맞춰 초점 범위를 넓힙니다. 회절 광학을 쓰지 않아 야간 광학현상이 거의 없지만 양안시 적응이 필요합니다.",
    enDesc:"Dominant eye set for distance, fellow eye slightly myopic. No diffractive optics so minimal dysphotopsia, but requires binocular adaptation." },

  { id:"enhMono",   ko:"프리미엄 단초점 (enhanced monofocal)", en:"Enhanced monofocal (monofocal-plus)",
    koSub:"Partial ROF · enhanced", enSub:"Partial ROF · enhanced",
    cap:{far:3, inter:2,   near:1,   night:3,   contrast:2.9},
    band:[62,30,8], base:18,
    plain:{glasses:2, glare:0, contrast:3},
    koPlain:"단초점을 개량해 컴퓨터·주방 정도의 중간 거리를 조금 더 편하게 보도록 만든 렌즈입니다. 밤 빛 번짐은 단초점과 같은 수준이고, 작은 글씨는 돋보기가 필요합니다.",
    enPlain:"An improved monofocal that makes computer and kitchen distance a little easier. Night glare is the same as a monofocal; small print still needs readers.",
    koDesc:"비회절 방식으로 중간거리를 약 1줄 넓힌 단초점. 광학현상 발생률은 단초점과 통계적으로 동등합니다. EDOF의 국제표준 초점심도 기준은 충족하지 않으므로 ‘연속초점’이 아닙니다.",
    enDesc:"Non-diffractive design giving about one line of extra intermediate vision. Photic phenomena equivalent to a standard monofocal. Does NOT meet the ISO/ANSI EDOF depth-of-focus criterion." },

  { id:"edof",      ko:"연속초점 EDOF", en:"EDOF (continuous range)",
    koSub:"Partial ROF · extended · 비회절", enSub:"Partial ROF · extended · non-diffractive",
    cap:{far:2.95, inter:2.8, near:1.7, night:2.4, contrast:2.5},
    band:[46,36,18], base:15,
    plain:{glasses:1, glare:1, contrast:2},
    koPlain:"먼 곳부터 중간 거리까지 초점이 끊기지 않고 이어지는 렌즈입니다. 빛을 잘게 나누는 구조가 없어 밤 빛 번짐이 적은 편이고, 아주 작은 글씨에는 돋보기가 필요할 수 있습니다.",
    enPlain:"Focus runs continuously from far into the intermediate range. Without a light-splitting ring structure there is less night glare; very small print may still need readers.",
    koDesc:"파면 조절·구면수차 확장 방식으로 초점을 연속적으로 늘립니다. 회절 링이 없어 헤일로가 상대적으로 적고, 아주 작은 글씨에는 대개 돋보기가 일부 필요합니다.",
    enDesc:"Wavefront-shaping / SA-based continuous elongation of focus. No diffractive rings, so fewer halos; fine print usually still needs readers." },

  { id:"lentis",    ko:"굴절형 분절 이중초점 (렌티스)", en:"Refractive segmented bifocal (LENTIS)",
    koSub:"회전비대칭 굴절형 · add +2.0/+3.0 D", enSub:"rotationally asymmetric refractive · +2.0/+3.0 D add",
    cap:{far:2.8, inter:2.4, near:2.6, night:2.0, contrast:2.2},
    band:[40,28,32], base:12,
    plain:{glasses:1, glare:2, contrast:2},
    koPlain:"렌즈 아래쪽에 가까운 곳을 보는 구역을 따로 둔 방식입니다. 빛을 잘게 나누지 않아 선명함 손실이 덜하고, 각막에 굴곡이 있는 눈에도 비교적 잘 맞습니다. 밤에는 불빛이 한쪽으로 번져 보일 수 있습니다.",
    enPlain:"A separate near-vision zone sits in the lower part of the lens. It does not split light into fine rings, so less clarity is lost, and it suits an unevenly shaped cornea reasonably well. At night, lights may smear to one side.",
    koDesc:"아래쪽에 부채꼴 근거리 구역을 둔 굴절형 이중초점입니다. 회절 링이 없어 빛 손실과 대비감도 저하가 회절형보다 적고, 각막 고위수차(특히 코마)가 있는 눈에서 회절형보다 견딜 만하다고 보아 씁니다. 대신 광학이 비대칭이라 중심화·기울어짐에 민감하고, 야간 광원이 한쪽으로 번지는 형태의 현상이 생길 수 있습니다.",
    enDesc:"Refractive bifocal with a sector-shaped near zone. No diffractive rings, so less light loss and less contrast reduction than a diffractive design, and it is used where corneal higher-order aberration (especially coma) makes diffractive optics unattractive. The asymmetric optic is sensitive to decentration and tilt, and night-time flare tends to smear to one side." },

  { id:"trifocal",  ko:"다초점 · 삼중초점 (전 시야범위)", en:"Multifocal / trifocal (full range of vision)",
    koSub:"Full ROF · MIOL/FVR", enSub:"Full ROF · MIOL/FVR",
    cap:{far:2.8, inter:3,  near:3,   night:1,   contrast:1.6},
    band:[34,32,34], base:11,
    plain:{glasses:0, glare:3, contrast:0},
    koPlain:"먼 곳·중간 거리·가까운 곳에 동시에 초점을 나눕니다. 안경을 가장 적게 쓰게 되지만, 밤에 불빛 번짐이 가장 많고 보이는 선명함이 다소 떨어집니다.",
    enPlain:"Splits focus between far, intermediate and near at the same time. You will need glasses least often, but night glare is greatest and clarity is somewhat reduced.",
    koDesc:"원·중간·근거리에 동시에 초점을 나눕니다. 안경 의존도를 가장 크게 줄이지만(RR 0.63) 헤일로 위험이 가장 높고(RR 3.58) 대비감도가 떨어집니다.",
    enDesc:"Splits light across distance, intermediate and near. Largest reduction in spectacle dependence (RR 0.63) but the highest halo risk (RR 3.58) and lowest contrast." }
];

/* ------------------------------------------------------------------
   비급여 비용 — 연세솔안과 기준, **단안**, 환자 부담 (단위: 만원)

   예전에는 렌즈마다 0~3 짜리 '비용' 척도를 손으로 매겨 두고 그것으로
   감점했다. 실제 금액을 알게 된 이상 그 척도는 두 개의 진실을 만들 뿐이라
   없앴다. 점수도, 화면에 찍히는 금액도 모두 이 표 하나에서 나온다.

   · 토릭은 별개의 축이라 렌즈 종류마다 더해지는 고정 금액으로 다룬다
     (토릭 단초점 100 − 논토릭 단초점 25 = 75).
   · 미니모노비전은 단초점 두 개를 쓰는 것이므로 단안 기준 금액이 같다.
   · 병원이 상담 화면에서 고치면 이 값 대신 그 값이 쓰인다(브라우저에만 저장).
   · 금액은 낡는다. 바뀌면 여기와 상담 화면 둘 중 하나만 고쳐도 되지만,
     저장소 값을 고치는 편이 모든 기기에 반영된다.
   ------------------------------------------------------------------ */
const COST_DEFAULT_MAN = {
  mono:      {min:25,  max:25},
  monoBlend: {min:25,  max:25},
  enhMono:   {min:100, max:150},
  edof:      {min:200, max:200},
  lentis:    {min:250, max:300},
  trifocal:  {min:350, max:400},
};
/* 기본값. 실제로 쓰이는 값은 TU("toricAddMan") — 설정 화면에서 바꿉니다. */
const TORIC_ADD_MAN_DEFAULT = 75;

/* 실제로 쓰이는 금액표. 병원이 값을 바꾸면 UI 가 이 객체를 갈아끼운다. */
let COST_MAN = JSON.parse(JSON.stringify(COST_DEFAULT_MAN));
function setCostTable(o){ COST_MAN = Object.assign(JSON.parse(JSON.stringify(COST_DEFAULT_MAN)), o || {}); }
/* 점수 계산에는 범위의 중앙값을 쓴다 */
function costMid(id){
  const c = COST_MAN[id];
  return c ? (Number(c.min) + Number(c.max)) / 2 : null;
}

const LENS_BY_ID = Object.fromEntries(LENSES.map(l => [l.id, l]));
const ALL_PRESBY  = ["enhMono","edof","lentis","trifocal"];
/* 빛을 여러 초점으로 '나누는' 광학 — 대비감도 손실이 구조적으로 따라옵니다.
   렌티스는 회절이 아니라 굴절 분절이지만, 빛을 나눈다는 점은 같아 여기에 넣습니다. */
const FOCUS_SPLIT = ["lentis","trifocal"];
const DIFFRACTIVE = ["trifocal"];
const ALL_PREMIUM = ["monoBlend","enhMono","edof","lentis","trifocal"];
