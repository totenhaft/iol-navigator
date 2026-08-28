/* ------------------------------------------------------------------
   의사결정 규칙
   layer: "stop"    — 금기 / 해당 렌즈 후보에서 제외
          "caution" — 조건부 가능. 감점(w 단위, 1단위 = 7점) + 설명
          "note"    — 감점 없는 임상 권고 (예: 비구면 매칭)
   targets: 배열(동일 가중) 또는 {렌즈id: 가중} 객체
   grade  : 근거 수준 A/B/C/D
   ------------------------------------------------------------------ */

const T = {
  OCT:      {ko:"황반 OCT", en:"Macular OCT", d_ko:"프리미엄 IOL 상담 전 필수. 미세한 황반질환이 대비감도 손실을 증폭시킵니다.", d_en:"Mandatory before premium IOL counselling; subtle maculopathy amplifies contrast loss.", p_ko:"망막(황반) 정밀 촬영", p_en:"Retinal (macular) scan"},
  TOPO:     {ko:"각막지형도 · 단층촬영 (Placido + Scheimpflug/OCT)", en:"Corneal topography and tomography", d_ko:"불규칙 난시, 후면각막난시, 확장증 선별.", d_en:"Screens irregular astigmatism, posterior astigmatism and ectasia.", p_ko:"각막 모양 검사", p_en:"Corneal shape scan"},
  ABERRO:   {ko:"각막 수차 분석 (HOA·coma·구면수차, 4 mm & 6 mm)", en:"Corneal aberrometry (HOA, coma, SA at 4 and 6 mm)", d_ko:"측정 동공경과 장비를 함께 기록하세요.", d_en:"Record the analysis zone and device.", p_ko:"각막 수차 검사", p_en:"Corneal aberration test"},
  PUPIL:    {ko:"명소시·암소시 동공 계측 (pupillometry)", en:"Photopic and mesopic pupillometry", d_ko:"야간 광학현상 위험 평가.", d_en:"Assesses night-time dysphotopsia risk.", p_ko:"동공 크기 측정", p_en:"Pupil size measurement"},
  KAPPA:    {ko:"Chord mu / chord alpha 측정", en:"Chord mu / chord alpha", d_ko:"단독 변수로 결론짓지 말고 장비명을 함께 기록.", d_en:"Never decide on this alone; record the device.", p_ko:"눈의 시축 위치 측정", p_en:"Visual-axis alignment measurement"},
  OSD:      {ko:"안구표면 평가 (눈물삼투압 · MMP-9 · SPEED II · LLPP 진찰)", en:"Ocular surface workup (osmolarity, MMP-9, SPEED II, LLPP)", d_ko:"ASCRS 알고리즘. 이상 시 치료 후 생체계측 재시행.", d_en:"ASCRS algorithm; re-do biometry after treatment if abnormal.", p_ko:"눈물·눈 표면 검사", p_en:"Tear film and ocular surface test"},
  ENDO:     {ko:"각막내피세포 검사 (specular microscopy)", en:"Specular microscopy", d_ko:"구타타·푹스이상증 의심 시.", d_en:"When guttata or Fuchs dystrophy is suspected.", p_ko:"각막 내피세포 검사", p_en:"Corneal cell count"},
  VF:       {ko:"시야검사 + 시신경 OCT (RNFL·GCC)", en:"Visual field and optic nerve OCT", d_ko:"녹내장 중증도 확정.", d_en:"Establishes glaucoma severity.", p_ko:"시야 검사", p_en:"Visual field test"},
  BIOM:     {ko:"광간섭 생체계측 (안축장·전방깊이·수정체두께)", en:"Optical biometry (AL, ACD, LT)", d_ko:"", d_en:"", p_ko:"눈 길이 정밀 측정", p_en:"Precise eye-length measurement"},
  POSTREF:  {ko:"굴절수술 전 기록 확보 + 굴절수술 후 IOL 계산식 (Barrett True-K, ASCRS 계산기)", en:"Pre-refractive-surgery records and post-LVC IOL formulas (Barrett True-K, ASCRS calculator)", d_ko:"", d_en:"", p_ko:"예전 시력교정수술 기록 확인", p_en:"Records of your earlier laser surgery"},
  MACSTAB:  {ko:"망막 전문의 협진 — 질환 안정성 및 향후 치료 계획 확인", en:"Retina consultation — disease stability and future treatment plan", d_ko:"", d_en:"", p_ko:"망막 전문의 진료", p_en:"Retina specialist review"},
  CS:       {ko:"대비감도 검사 (선택)", en:"Contrast sensitivity testing (optional)", d_ko:"", d_en:"", p_ko:"대비감도 검사", p_en:"Contrast sensitivity test"},
  DILAT:    {ko:"산동 반응 확인 및 IFIS 대비 계획", en:"Dilation response and IFIS plan", d_ko:"", d_en:"", p_ko:"산동(동공을 넓히는) 검사", p_en:"Dilated examination"},
  TCA:      {ko:"총 각막난시(TCA) 측정 — 후면각막 포함", en:"Total corneal astigmatism including posterior surface", d_ko:"", d_en:"", p_ko:"각막 난시 정밀 측정", p_en:"Precise corneal astigmatism measurement"},
  COUNSEL:  {ko:"신경적응 기간(2–3개월~1년)과 잔여 안경 필요성에 대한 문서화된 술전 상담", en:"Documented counselling on neuroadaptation (2–3 months to 1 year) and residual spectacle need", d_ko:"", d_en:""},
};

const RULES = [

/* ============ HARD STOP ============ */
{
  id:"osd_vs", layer:"stop", reversible:true,
  targets:["enhMono","edof","lentis","trifocal","monoBlend"],
  when:d => d.osd === "visually_significant",
  ko:{t:"시력에 영향을 주는 안구표면질환", why:"불안정한 눈물막은 각막곡률·수차 측정을 왜곡시켜 생체계측과 난시 축 자체를 신뢰할 수 없게 만듭니다. 이 상태에서 결정한 렌즈 도수와 종류는 근거가 없습니다.", act:"먼저 안구표면을 치료하고 계측을 다시 한 뒤 이 도구를 재실행하세요. 치료로 해제 가능한 ‘보류’ 항목입니다."},
  en:{t:"Visually significant ocular surface disease", why:"An unstable tear film distorts keratometry and aberrometry, so biometry and astigmatism axis cannot be trusted. Any lens choice made now rests on unreliable numbers.", act:"Treat the surface, repeat biometry, then re-run this tool. This is a reversible hold, not a permanent exclusion."},
  refs:["R10"], grade:"B", tests:[T.OSD, T.TCA]
},
{
  id:"macula_advanced", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => ["amd_advanced","dme","erm_significant","other"].includes(d.macula),
  ko:{t:"시력을 제한하는 황반질환", why:"회절형 광학은 빛을 여러 초점으로 나누어 대비감도를 낮춥니다. 이미 황반질환으로 대비감도가 떨어진 눈에서는 손실이 중첩되어 체감 시질이 크게 나빠집니다.", act:"단초점 또는 프리미엄 단초점을 기본으로 하고, 비회절 EDOF는 망막 전문의와 질환 안정성을 확인한 뒤에만 개별 검토하세요."},
  en:{t:"Vision-limiting macular disease", why:"Diffractive optics split light across foci and lower contrast sensitivity. In an eye whose contrast is already reduced by maculopathy the losses compound.", act:"Default to a monofocal or enhanced monofocal; consider non-diffractive EDOF only after retina review confirms stability."},
  refs:["R11","R19","R1"], grade:"D", tests:[T.OCT, T.MACSTAB]
},
{
  id:"pdr", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => d.dr === "pdr",
  ko:{t:"증식성 당뇨망막병증", why:"문헌에서 프리미엄 IOL의 금기로 명시됩니다. 향후 범망막광응고·유리체절제술·항VEGF 주사가 반복될 가능성이 높고, 이때 선명한 안저 관찰과 넓은 시야가 필수입니다. 황반부종 발생 시 대비감도도 추가로 떨어집니다.", act:"단초점(필요 시 토릭)을 권장합니다."},
  en:{t:"Proliferative diabetic retinopathy", why:"Explicitly named a contraindication to premium IOLs. Repeated panretinal photocoagulation, vitrectomy or anti-VEGF injections are likely, and all require an unobstructed fundus view. Any macular oedema further degrades contrast.", act:"Recommend a monofocal, toric if indicated."},
  refs:["R12","R19"], grade:"D", tests:[T.OCT, T.MACSTAB]
},
{
  id:"glaucoma_adv", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => ["moderate","severe"].includes(d.glaucoma),
  ko:{t:"중등도 이상 녹내장", why:"녹내장은 시력보다 대비감도를 먼저 침범합니다. 회절형 렌즈의 대비감도 손실이 여기에 더해지면 실질적 시기능이 크게 떨어집니다.", act:"단초점 또는 프리미엄 단초점. 중등도이면서 조절이 매우 양호하고 진행이 없는 경우에 한해 비회절 EDOF를 개별 검토할 수 있습니다."},
  en:{t:"Moderate or severe glaucoma", why:"Glaucoma degrades contrast sensitivity before acuity; adding the contrast loss of diffractive optics compounds the deficit.", act:"Monofocal or enhanced monofocal. Non-diffractive EDOF only case-by-case in well-controlled, non-progressing moderate disease."},
  refs:["R11","R19"], grade:"D", tests:[T.VF, T.CS]
},
{
  id:"optic_neuro", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => !!d.opticNeuro,
  ko:{t:"시신경병증 · 시신경위축 · 약시", why:"신경적응은 온전한 시신경 전달과 피질 처리에 의존합니다. 시신경 손상이나 약시가 있으면 회절형 렌즈가 만드는 중첩 이미지를 억제하지 못해 만성적 불만족으로 이어질 가능성이 높습니다.", act:"단초점을 기본으로 하고, 대비감도를 최대한 보존하는 선택을 하세요."},
  en:{t:"Optic neuropathy, optic atrophy or amblyopia", why:"Neuroadaptation depends on intact optic nerve transmission and cortical processing. With nerve damage or amblyopia the superimposed images from a diffractive optic cannot be suppressed, and chronic dissatisfaction is likely.", act:"Default to a monofocal and preserve contrast."},
  refs:["R15","R19"], grade:"D", tests:[T.VF]
},
{
  id:"cornea_irregular", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => ["kc_progressive","scar","graft"].includes(d.cornea) || d.irregularAstig === true,
  ko:{t:"불규칙 각막 (진행성 원추각막 · 혼탁 · 이식 후 · 불규칙 난시)", why:"각막 자체가 이미 예측 불가능한 다초점처럼 작동합니다. 여기에 회절 광학을 더하면 이미지 질이 예측 불가능해지고 토릭의 축 계산 근거도 사라집니다.", act:"각막을 먼저 안정화·규칙화(강막렌즈·각막교차결합·이식)한 뒤 재평가하세요. 그때까지는 단초점을 기본으로 하고, 잔여 불규칙 난시는 안경·하드렌즈로 교정하는 편이 예측 가능합니다."},
  en:{t:"Irregular cornea (progressing keratoconus, scar, post-graft, irregular astigmatism)", why:"The cornea already behaves as an unpredictable multifocal. Adding a diffractive optic makes image quality unpredictable, and a toric axis calculation loses its basis.", act:"Stabilise and regularise the cornea first (scleral lens, CXL, graft), then reassess. Until then a monofocal is the predictable choice, with residual irregular astigmatism corrected by spectacles or a rigid lens."},
  refs:["R13","R18","R9"], grade:"C", tests:[T.TOPO, T.ABERRO]
},
{
  id:"fuchs_edema", layer:"stop",
  targets:["edof","lentis","trifocal"],
  when:d => d.cornea === "fuchs_edema",
  ko:{t:"각막부종을 동반한 푹스이상증", why:"부종된 각막은 그 자체로 빛을 산란시켜 대비감도를 떨어뜨리고, 향후 내피이식(DMEK/DSAEK)이 필요해지면 굴절값이 다시 이동합니다. 초점심도를 나누는 렌즈는 이 위에서 성능을 보장할 수 없습니다.", act:"단초점을 권장하고, 내피이식 병행 또는 단계적 시행을 상의하세요."},
  en:{t:"Fuchs dystrophy with corneal oedema", why:"An oedematous cornea scatters light and lowers contrast on its own, and a future endothelial graft (DMEK/DSAEK) will shift the refraction again. No focus-splitting lens can be relied on over that.", act:"Recommend a monofocal and discuss combined or staged endothelial keratoplasty."},
  refs:["R19"], grade:"D", tests:[T.ENDO]
},
{
  id:"rk", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => d.priorRefSx === "rk",
  ko:{t:"방사상각막절개(RK) 과거력", why:"RK 각막은 하루 중에도 굴절력이 변동하고(diurnal shift) 다구역·불규칙 광학을 가집니다. 도수 예측 오차가 커서 회절형 렌즈의 초점 배치를 신뢰할 수 없습니다.", act:"단초점을 기본으로 검토하고, 잔여 굴절 이상 교정 계획(안경·추가 시술)을 미리 상의하세요. 하루 중 굴절 변동이 큰 만큼 목표 굴절값도 보수적으로 잡습니다."},
  en:{t:"Prior radial keratotomy", why:"An RK cornea shifts refraction through the day and is multizonal and irregular. Power prediction error is large, so the focal placement of a diffractive optic cannot be trusted.", act:"Default to a monofocal and plan in advance for residual refractive error; set a conservative refractive target given the diurnal shift."},
  refs:["R9","R18"], grade:"C", tests:[T.TOPO, T.ABERRO, T.POSTREF]
},
{
  id:"zonule_unstable", layer:"stop",
  targets:["edof","lentis","trifocal","monoBlend"],
  when:d => d.zonule === "phacodonesis",
  ko:{t:"소대 불안정 · 수정체진탕", why:"모든 초점분할 광학과 토릭 광학은 정확한 중심화와 회전 안정성을 전제로 합니다. 소대가 불안정하면 렌즈가 편심·기울어지고 그 즉시 설계된 광학이 무너집니다.", act:"낭내고리(CTR) 등 지지 계획을 먼저 세우고, 중심화 안정성이 확보된 뒤에만 프리미엄 옵션을 논의하세요."},
  en:{t:"Zonular instability / phacodonesis", why:"Every focus-splitting and toric optic assumes accurate centration and rotational stability. Unstable zonules cause decentration and tilt, which immediately destroys the designed optics.", act:"Plan capsular support (CTR) first; discuss premium options only once centration stability is assured."},
  refs:["R13","R19"], grade:"D", tests:[T.DILAT]
},
{
  id:"zonule_unstable_enh", layer:"caution",
  targets:{enhMono:2.5},
  when:d => d.zonule === "phacodonesis",
  ko:{t:"소대 불안정에서의 프리미엄 단초점", why:"프리미엄 단초점의 중간거리 확장은 정밀하게 설계된 전면 비구면 프로파일에서 나오며, 이 효과는 렌즈가 낭 안에서 중심을 유지할 때만 성립합니다. 소대가 약하면 모양체고랑(sulcus) 고정이나 공막고정이 필요해질 수 있고 그때는 이 설계를 쓸 수 없습니다.", act:"중심화가 확실히 보장되는 경우에만 고려하고, 그렇지 않다면 표준 단초점(필요 시 3-piece)으로 계획하세요."},
  en:{t:"Enhanced monofocal with unstable zonules", why:"The intermediate extension of an enhanced monofocal comes from a precisely designed anterior aspheric profile that only works with the lens centred in the bag. Weak zonules may force sulcus placement or scleral fixation, where this design cannot be used.", act:"Consider only if centration is assured; otherwise plan a standard monofocal, 3-piece if needed."},
  refs:["R13","R19"], grade:"D", tests:[T.DILAT]
},
{
  id:"uveitis", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => !!d.uveitis,
  ko:{t:"만성 · 재발성 포도막염", why:"반복되는 염증은 후낭혼탁, 낭수축, 렌즈 표면 침착, 낭포황반부종을 일으켜 회절 광학의 성능을 예측할 수 없게 만듭니다. 안저 관찰도 자주 필요합니다.", act:"염증을 최소 3개월 이상 완전히 조절한 뒤 단초점 계열로 계획하세요."},
  en:{t:"Chronic or recurrent uveitis", why:"Recurrent inflammation causes posterior capsule opacification, capsular contraction, lens surface deposits and cystoid macular oedema, all of which make diffractive performance unpredictable. Frequent fundus review is also needed.", act:"Achieve at least 3 months of quiescence and plan a monofocal-class lens."},
  refs:["R19"], grade:"D", tests:[T.OCT]
},
{
  id:"expectation", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => d.perfectionism === 3 && d.dysphTolerance === 0,
  ko:{t:"완벽한 시력을 요구하면서 빛번짐은 전혀 감내 못 하는 조합", why:"이 조합은 회절형 렌즈에서 구조적으로 충족될 수 없습니다. 렌즈가 정상 작동해도 헤일로는 발생하며, 신경적응 실패는 대개 6개월 안에 드러나고 결국 렌즈 교환으로 이어지기도 합니다(평균 15개월).", act:"기대치 상담을 먼저 진행하세요. 원거리 단초점 또는 프리미엄 단초점처럼 예측 가능한 결과를 주는 선택이 훨씬 안전합니다."},
  en:{t:"Demands perfect vision but tolerates no halo", why:"This combination cannot be satisfied by a diffractive optic. Halos occur even when the lens performs exactly as designed; neuroadaptation failure usually declares itself within 6 months and sometimes ends in exchange (mean 15 months).", act:"Address expectations first. A predictable monofocal or enhanced monofocal result is far safer."},
  refs:["R15","R12","R1"], grade:"D", tests:[T.COUNSEL]
},
{
  id:"precision_near", layer:"stop",
  targets:["lentis","trifocal"],
  when:d => !!d.precisionNearWork,
  ko:{t:"현미경 · 확대경 · 정밀 근업이 직업의 핵심", why:"이 직군은 대비감도와 입체적 이미지 선명도가 생계와 직결됩니다. 문헌에서 다초점을 삽입하지 않는 대표 직군으로 거론됩니다.", act:"단초점(원거리) + 정밀 작업용 안경, 또는 프리미엄 단초점을 권장합니다."},
  en:{t:"Microscope, magnifier or precision near-work is central to the job", why:"Contrast sensitivity and crisp stereoscopic detail are livelihood-critical here. The literature names this group as one in which multifocals are not implanted.", act:"Monofocal for distance plus task-specific spectacles, or an enhanced monofocal."},
  refs:["R12"], grade:"D", tests:[]
},

/* ============ CAUTION ============ */
{
  id:"cornea_irregular_edof", layer:"caution",
  targets:{edof:2},
  when:d => ["kc_progressive","scar","graft"].includes(d.cornea) || d.irregularAstig === true || d.priorRefSx === "rk",
  ko:{t:"불규칙 각막에서의 연속초점 EDOF", why:"연속초점 렌즈는 회절 링이 없어도 초점심도를 늘리기 위해 파면을 다듬습니다. 각막이 이미 불규칙하면 그 위에 얹힌 설계가 의도대로 작동하지 않고, 결과를 예측하기 어렵습니다.", act:"금기는 아니지만, 각막이 안정되고 규칙적임을 확인한 뒤에만 개별적으로 검토하세요. 확신이 없으면 단초점이 안전합니다."},
  en:{t:"Continuous-range EDOF in an irregular cornea", why:"Even without diffractive rings, a continuous-range optic shapes the wavefront to extend depth of focus. Over an already irregular cornea that design does not behave as intended and the outcome is hard to predict.", act:"Not a contraindication, but consider it only once the cornea is confirmed stable and regular. When in doubt a monofocal is safer."},
  refs:["R9","R18"], grade:"D", tests:[T.TOPO, T.ABERRO]
},
{
  id:"macula_early", layer:"caution",
  targets:{trifocal:3, lentis:2.5, edof:1},
  when:d => ["drusen","amd_intermediate","erm_mild"].includes(d.macula),
  ko:{t:"초기 황반 변화 (드루젠 · 중기 건성 황반변성 · 경미한 망막앞막)", why:"현재 시력이 좋아도 이 소견은 진행할 수 있고, 진행 시 회절형 렌즈의 대비감도 손실이 되돌릴 수 없는 문제가 됩니다. 향후 항VEGF 주사나 유리체수술이 필요해질 가능성도 함께 고려해야 합니다.", act:"진행 위험을 환자와 명시적으로 공유하고, 대비감도를 덜 희생하는 선택(프리미엄 단초점 · 비회절 EDOF)으로 무게를 옮기세요."},
  en:{t:"Early macular change (drusen, intermediate dry AMD, mild ERM)", why:"Acuity may be good today, but these findings can progress, and if they do the contrast loss of a diffractive optic becomes an irreversible problem. Future anti-VEGF or vitreoretinal surgery must also be weighed.", act:"Share the progression risk explicitly and shift toward options that sacrifice less contrast (enhanced monofocal, non-diffractive EDOF)."},
  refs:["R19","R11"], grade:"D", tests:[T.OCT, T.MACSTAB]
},
{
  id:"glaucoma_early", layer:"caution",
  targets:{trifocal:2, lentis:1.5, edof:0.5},
  when:d => ["suspect","mild"].includes(d.glaucoma),
  ko:{t:"녹내장 의증 · 초기 녹내장", why:"조절이 잘 되는 초기 녹내장에서는 프리미엄 IOL이 금기가 아닙니다. 다만 녹내장은 대비감도를 먼저 침범하므로, 향후 진행 가능성을 감안하면 대비감도 여유를 남겨 두는 편이 안전합니다.", act:"EDOF는 다초점보다 대비감도 보존이 낫습니다. 진행 속도와 예상 여명을 함께 고려해 결정하세요."},
  en:{t:"Glaucoma suspect or early glaucoma", why:"Premium IOLs are not contraindicated in well-controlled early disease, but glaucoma attacks contrast first, so leaving contrast headroom is prudent given the possibility of progression.", act:"EDOF preserves contrast better than a multifocal. Weigh rate of progression against life expectancy."},
  refs:["R11"], grade:"D", tests:[T.VF]
},
{
  id:"npdr", layer:"caution",
  targets:{trifocal:2.5, lentis:2, edof:1},
  when:d => d.dr === "npdr",
  ko:{t:"비증식성 당뇨망막병증", why:"당뇨망막병증은 진행성 질환입니다. 지금은 황반부종이 없더라도 향후 부종·레이저·주사 치료가 필요해질 수 있고, 그때 회절형 렌즈는 대비감도와 안저 관찰 양쪽에서 불리해집니다.", act:"혈당 조절 상태와 망막병증 등급을 확인하고, 진행 시나리오를 상담에 포함하세요."},
  en:{t:"Non-proliferative diabetic retinopathy", why:"DR is progressive. Even without oedema today, future oedema, laser or injections are possible, and a diffractive optic is then a liability for both contrast and fundus view.", act:"Confirm glycaemic control and retinopathy grade, and include the progression scenario in counselling."},
  refs:["R12","R19"], grade:"D", tests:[T.OCT, T.MACSTAB]
},
{
  id:"guttata", layer:"caution",
  targets:{trifocal:2.5, lentis:2, edof:1},
  when:d => d.cornea === "guttata",
  ko:{t:"각막 구타타 (부종 없음)", why:"구타타는 그 자체로 빛산란을 늘려 대비감도를 낮추고, 백내장 수술의 내피 스트레스 이후 부종으로 진행할 수 있습니다. 내피세포수가 낮을수록 위험이 큽니다.", act:"내피세포 검사와 중심각막두께를 확인하고, 수치가 경계적이면 회절형을 피하세요."},
  en:{t:"Corneal guttata without oedema", why:"Guttata increases light scatter and lowers contrast on its own, and can decompensate after the endothelial stress of surgery. Risk rises as endothelial cell count falls.", act:"Check specular microscopy and central corneal thickness; avoid diffractive optics if borderline."},
  refs:["R19"], grade:"D", tests:[T.ENDO]
},
{
  id:"kc_stable", layer:"caution",
  targets:{trifocal:3, lentis:2, edof:1.5},
  when:d => d.cornea === "kc_stable",
  ko:{t:"안정된 원추각막 · forme fruste", why:"안정적이어도 각막 고위수차가 정상보다 크고, 향후 진행 가능성이 완전히 사라진 것은 아닙니다. 도수 계산 오차도 큽니다.", act:"수차 수치를 직접 확인하고, 진행이 없음을 여러 시점의 지형도로 확인하세요."},
  en:{t:"Stable keratoconus or forme fruste", why:"Even when stable, corneal higher-order aberrations exceed normal and progression is not fully excluded. Power calculation error is also larger.", act:"Measure the aberrations directly and confirm stability on serial topography."},
  refs:["R13","R18"], grade:"C", tests:[T.TOPO, T.ABERRO]
},
{
  id:"ebmd", layer:"caution",
  targets:{trifocal:2, lentis:1.5, edof:1, enhMono:0.5},
  when:d => d.cornea === "ebmd",
  ko:{t:"전기저막이상증 (EBMD)", why:"불규칙한 상피가 각막 계측을 왜곡하고 시질을 변동시킵니다. 치료 가능한 원인이므로 계측 전에 해결하는 것이 원칙입니다.", act:"필요 시 상피박리(superficial keratectomy) 후 각막이 안정된 뒤 계측을 다시 하세요."},
  en:{t:"Epithelial basement membrane dystrophy", why:"An irregular epithelium distorts keratometry and makes vision fluctuate. It is treatable, so it should be addressed before biometry.", act:"Consider superficial keratectomy, then repeat biometry once the surface is stable."},
  refs:["R10","R8"], grade:"D", tests:[T.TOPO, T.OSD]
},
{
  id:"osd_mild", layer:"caution",
  targets:{trifocal:1.5, lentis:1.2, edof:1, enhMono:0.5},
  when:d => d.osd === "mild",
  ko:{t:"경미한 안구표면질환", why:"수술 자체가 건성안을 일시적으로 악화시킵니다. 프리미엄 렌즈에 대한 술후 불만의 상당수는 렌즈가 아니라 눈물막 때문이며, 이는 치료 가능한 원인입니다.", act:"술전에 안구표면을 적극적으로 최적화하고, 술후 건성안 악화 가능성을 미리 설명하세요."},
  en:{t:"Non-visually-significant ocular surface disease", why:"Surgery itself transiently worsens dry eye. A large share of premium-IOL dissatisfaction traces to the tear film rather than the lens — and that cause is treatable.", act:"Optimise the surface pre-operatively and warn the patient about transient post-operative worsening."},
  refs:["R10"], grade:"B", tests:[T.OSD]
},
{
  id:"prior_lvc", layer:"caution",
  targets:{trifocal:2.5, lentis:1.5, edof:0.5},
  when:d => ["myopic_lvc","hyperopic_lvc"].includes(d.priorRefSx),
  ko:{t:"라식 · 라섹 · 스마일 과거력", why:"과거력 자체는 절대 금기가 아닙니다. 다만 각막이 다구역이 되어 고위수차와 구면수차가 변하고, IOL 도수 예측 오차가 커집니다. 이 환자군은 기대치도 높습니다. 후향 분석에서 HOA <0.5 µm @6 mm, 구면수차 <0.6 µm를 넘긴 경우 불만족이 늘었습니다.", act:"수차를 실제로 측정해 위 기준과 대조하고, 굴절수술 후 전용 계산식(Barrett True-K 등)을 사용하며, 잔여 굴절 이상 교정 계획을 미리 합의하세요."},
  en:{t:"Prior LASIK / PRK / SMILE", why:"A history of LVC is not an absolute contraindication, but the cornea becomes multizonal with altered HOA and spherical aberration, and IOL power prediction error rises. Expectations in this group are high. In a retrospective series, exceeding HOA 0.5 µm at 6 mm or SA 0.6 µm was associated with dissatisfaction.", act:"Measure the aberrations against those thresholds, use post-LVC formulas (e.g. Barrett True-K), and agree a plan for residual refractive error in advance."},
  refs:["R9","R8"], grade:"C", tests:[T.ABERRO, T.TOPO, T.POSTREF, T.COUNSEL]
},
{
  id:"chord_high", layer:"caution",
  targets:{trifocal:2, lentis:1.5, edof:0.5},
  when:d => (num(d.chordAlpha) !== null && d.chordAlpha >= TU("cutChordHigh")) || (num(d.chordMu) !== null && d.chordMu >= TU("cutChordHigh")),
  ko:{t:"Chord mu / alpha ≥ 0.6 mm", why:"동공 중심과 시축이 크게 어긋나면 회절 링에 대해 렌즈가 상대적으로 편심된 것처럼 작동해 광학현상이 늘 수 있습니다. 다만 근거는 상충합니다 — 26,470안 자료에서는 술전 angle kappa와 술후 결과 사이에 임상적으로 유의한 관계가 없었고, 장비 간 값 차이도 큽니다(동일 안에서 0.27 vs 0.43 mm).", act:"이 값 하나로 결정하지 마세요. 각막지형도상 동공 중심 대비 시축 위치를 직접 보고, 다른 위험인자와 합쳐서 판단하세요."},
  en:{t:"Chord mu / alpha ≥ 0.6 mm", why:"A large offset between pupil centre and visual axis makes the lens behave as if decentred relative to its diffractive rings, potentially increasing dysphotopsia. The evidence conflicts: in 26,470 eyes preoperative angle kappa showed no clinically meaningful relationship to outcomes, and devices disagree markedly (0.27 vs 0.43 mm in the same eye).", act:"Do not decide on this value alone. Inspect the visual-axis position on topography and weigh it alongside other risk factors."},
  refs:["R6"], grade:"C", tests:[T.KAPPA, T.TOPO]
},
{
  id:"chord_border", layer:"caution",
  targets:{trifocal:1, lentis:0.7},
  when:d => {
    const a = num(d.chordAlpha), m = num(d.chordMu);
    const hi = (a !== null && a >= TU("cutChordHigh")) || (m !== null && m >= TU("cutChordHigh"));
    if (hi) return false;
    return (a !== null && a >= TU("cutChordBorder")) || (m !== null && m >= TU("cutChordBorder"));
  },
  ko:{t:"Chord mu / alpha 0.5–0.6 mm (경계 구간)", why:"관행적으로 인용되는 회피 기준(0.5–0.6 mm)의 경계에 있습니다. 이 구간의 근거는 약하며 기기 의존적입니다.", act:"측정 기기를 기록하고 가능하면 다른 장비로 교차 확인하세요. 단독 배제 근거로는 부족합니다."},
  en:{t:"Chord mu / alpha 0.5–0.6 mm (borderline)", why:"This sits at the boundary of the conventionally cited 0.5–0.6 mm avoid-threshold. The evidence for this band is weak and device-dependent.", act:"Record the device and cross-check on a second platform if possible. Not sufficient grounds for exclusion on its own."},
  refs:["R6"], grade:"C", tests:[T.KAPPA]
},
{
  id:"hoa_high", layer:"caution",
  targets:{trifocal:2.5, edof:1}, boost:{lentis:0.8},
  when:d => {
    const v = num(d.hoaRMS); if (v === null) return false;
    return d.hoaZone === "6" ? v > TU("cutHoa6") : v > TU("cutHoa4");
  },
  ko:{t:"각막 고위수차가 통상 기준을 초과", why:"HOA 0.3 µm @4 mm는 약 0.5 D 탈초점에 해당하는 흐림을 만듭니다. 각막이 이미 상당한 수차를 가지면 회절형 렌즈가 만드는 이미지 질을 예측하기 어렵습니다. 다만 이 cut-off의 근거는 제한적입니다 — 원 저자도 “실질적 가이드라인은 없다”고 명시했고, 378명 분석에서 HOA와 만족도의 상관은 없었습니다.", act:"수치 하나로 배제하지 말고 지형도 패턴, 나안 시력, 다른 위험인자와 함께 종합하세요. 기준: 4 mm에서 0.3 µm, 6 mm에서 0.5 µm."},
  en:{t:"Corneal higher-order aberrations above the conventional threshold", why:"HOA of 0.3 µm at 4 mm produces blur equivalent to about 0.5 D of defocus. When the cornea already carries substantial aberration, diffractive image quality becomes hard to predict. But this cut-off is weakly supported — the originating author states there are 'no real guidelines', and in 378 patients HOA did not correlate with satisfaction.", act:"Do not exclude on the number alone; combine it with the topographic pattern, uncorrected acuity and other risk factors. Thresholds: 0.3 µm at 4 mm, 0.5 µm at 6 mm."},
  refs:["R7","R8","R9"], grade:"C", tests:[T.ABERRO]
},
{
  id:"coma_high", layer:"caution",
  targets:{trifocal:2.5, edof:0.8}, boost:{lentis:1.2},
  when:d => num(d.cornealComa) !== null && d.cornealComa > TU("cutComa"),
  ko:{t:"각막 코마 > 0.3 µm @6 mm", why:"코마는 비대칭 수차로, 회절형 렌즈의 초점 분리와 겹치면 잔상·꼬리끌림 형태의 광학현상으로 나타나기 쉽습니다. 원추각막·편심 절제·이식 후 각막에서 흔합니다.", act:"원인(확장증·편심 절제·이식)을 먼저 규명하세요. 노안교정을 원하는 환자라면, 회절 링이 없는 굴절형 분절 이중초점(렌티스)이 회절형보다 코마를 덜 증폭한다고 보아 이 진료에서는 그쪽을 씁니다 — 비교 임상시험이 아니라 임상 관행에 따른 선택입니다."},
  en:{t:"Corneal coma > 0.3 µm at 6 mm", why:"Coma is an asymmetric aberration; combined with the focal separation of a diffractive optic it tends to produce comet-tail smearing. It is common in keratoconus, decentred ablations and grafts.", act:"Identify the cause (ectasia, decentred ablation, graft) first. For a patient who still wants presbyopia correction, this practice uses a segmented refractive bifocal (LENTIS), on the view that without diffractive rings it amplifies coma less — a practice-based choice rather than one from a comparative trial."},
  refs:["R8","R18"], grade:"C", tests:[T.ABERRO, T.TOPO]
},
{
  id:"pupil_meso_large", layer:"caution",
  targets:{trifocal:2, lentis:1.5, edof:0.5},
  when:d => num(d.pupMesopic) !== null && d.pupMesopic >= TU("cutPupilMeso"),
  ko:{t:"암소시 동공 ≥ 6.0 mm", why:"야간에 동공이 크게 열리면 회절 구조의 바깥 영역과 각막 주변부 수차까지 동원되어 헤일로·글레어·스타버스트가 커집니다. 야간 운전 요구가 함께 높으면 위험이 곱해집니다.", act:"야간 광학현상 가능성을 구체적으로 설명하고, 야간 요구가 높다면 비회절 설계로 무게를 옮기세요."},
  en:{t:"Mesopic pupil ≥ 6.0 mm", why:"A widely dilated pupil at night recruits the outer diffractive zones and peripheral corneal aberrations, enlarging halo, glare and starburst. Risk multiplies when night-driving demand is also high.", act:"Counsel concretely about night-time phenomena and shift toward non-diffractive designs if night demand is high."},
  refs:["R8","R1"], grade:"C", tests:[T.PUPIL]
},
{
  id:"pupil_photo_small", layer:"caution",
  targets:{trifocal:1.5, lentis:1.5, edof:0.3},
  when:d => num(d.pupPhotopic) !== null && d.pupPhotopic < TU("cutPupilPhoto"),
  ko:{t:"명소시 동공 < 2.5 mm", why:"동공이 작으면 바깥쪽 근거리 영역이 가려져 설계된 근거리 성능이 나오지 않을 수 있습니다. 회절형은 바깥 링이, 굴절형 분절 렌즈(렌티스)는 아래쪽 근거리 섹터가 가려지는 형태로 나타납니다.", act:"해당 렌즈의 동공 의존성을 확인하고, 동공 비의존 설계를 우선 고려하세요."},
  en:{t:"Photopic pupil < 2.5 mm", why:"A small pupil masks the outer near-addition zones, so the designed near performance may not be realised — the outer rings in a diffractive optic, or the inferior near sector in a segmented refractive lens (LENTIS).", act:"Check the pupil dependence of the specific lens and favour pupil-independent designs."},
  refs:["R8","R18"], grade:"C", tests:[T.PUPIL]
},
{
  id:"astig_uncorrected", layer:"caution",
  targets:{trifocal:3, lentis:2.5, edof:2, enhMono:1.5, monoBlend:1},
  when:d => num(d.cylD) !== null && d.cylD >= TU("cutCyl") && d.toricPlanned !== true && d.toricPlanKnown,
  ko:{t:"각막난시 ≥ 0.75 D인데 난시교정 계획이 없음 (집도의가 계획을 세우는 화면에서만 표시)", why:"잔여 난시는 초점분할 렌즈의 이미 얇은 이미지 질 여유를 그대로 잠식합니다. 프리미엄 렌즈 술후 불만의 가장 흔하고 가장 교정 가능한 원인입니다. 각막난시 ≥1.0 D에서는 토릭이 보편적으로 권고되며, 술후 정규난시는 1.0 D 미만으로 유지하는 것이 목표입니다.", act:"토릭 IOL 또는 각막이완절개를 함께 계획하세요. 난시를 교정하지 않을 것이라면 프리미엄 렌즈 자체를 재고해야 합니다."},
  en:{t:"Corneal astigmatism ≥ 0.75 D with no astigmatic correction planned", why:"Residual cylinder consumes the already-thin image-quality margin of a focus-splitting lens. It is the most common and most correctable cause of premium-IOL dissatisfaction. Toric IOLs are universally recommended at ≥1.0 D, and postoperative regular astigmatism should stay below 1.0 D.", act:"Plan a toric IOL or limbal relaxing incisions. If astigmatism will not be corrected, reconsider the premium lens itself."},
  refs:["R13","R8","R12"], grade:"C", tests:[T.TCA, T.TOPO]
},
{
  id:"al_long", layer:"caution",
  targets:{trifocal:1.5, lentis:1.2, edof:0.8},
  when:d => num(d.al) !== null && d.al >= TU("cutAlLong"),
  ko:{t:"긴 안축장 (고도근시)", why:"안축장 26 mm 초과에서 술후 망막박리 위험이 0.9–3.8%, 33.6–35.5 mm에서는 11%까지 보고됩니다. 근시성 망막변성이 최종시력을 제한하는 독립 인자이며, 도수 예측 오차도 큽니다. 향후 유리체망막 수술 시 안저 관찰이 필요합니다.", act:"주변부 망막을 산동 후 반드시 확인하고, 황반 OCT로 근시성 변화를 평가하세요. 망막박리 위험을 명시적으로 상담하세요."},
  en:{t:"Long axial length (high myopia)", why:"Retinal detachment risk after surgery is 0.9–3.8% above 26 mm and up to 11% at 33.6–35.5 mm. Myopic degeneration independently limits final acuity, and power prediction error is larger. Future vitreoretinal surgery would require a clear fundus view.", act:"Examine the peripheral retina dilated and assess myopic macular change on OCT. Counsel explicitly about detachment risk."},
  refs:["R14"], grade:"C", tests:[T.OCT, T.BIOM, T.MACSTAB]
},
{
  id:"al_short", layer:"caution",
  targets:{trifocal:1.5, lentis:1.2, edof:1},
  when:d => num(d.al) !== null && d.al < TU("cutAlShort"),
  ko:{t:"짧은 안축장", why:"짧은 눈에서는 유효렌즈위치(ELP) 예측 오차가 커져 목표 굴절값에서 벗어날 확률이 높습니다. 초점이 정확히 놓여야 성능이 나오는 회절형 렌즈에서는 이 오차가 바로 불만족으로 이어집니다.", act:"짧은 눈에 최적화된 최신 계산식을 사용하고, 필요 시 술후 굴절 이상 교정 계획을 미리 합의하세요."},
  en:{t:"Short axial length", why:"Effective lens position is harder to predict in short eyes, so refractive outcomes scatter more. A diffractive optic depends on accurate focal placement, so that scatter translates directly into dissatisfaction.", act:"Use a formula optimised for short eyes and agree a plan for residual refractive error."},
  refs:["R14","R16"], grade:"C", tests:[T.BIOM]
},
{
  id:"ifis", layer:"caution",
  targets:{trifocal:1, lentis:1.2, edof:0.5},
  when:d => !!d.ifis,
  ko:{t:"IFIS 위험 또는 산동 불량", why:"수술 중 홍채이완증후군은 낭절개 크기와 렌즈 중심화의 정확도를 떨어뜨립니다. 초점분할·토릭 광학은 중심화와 회전 안정성에 민감합니다.", act:"산동 보조 기구와 IFIS 대비 계획을 미리 준비하세요. 중심화 확신이 없다면 프리미엄 선택을 재고하세요."},
  en:{t:"IFIS risk or poor dilation", why:"Intraoperative floppy iris syndrome degrades the accuracy of capsulotomy sizing and lens centration, and focus-splitting and toric optics are sensitive to both centration and rotation.", act:"Prepare pupil-expansion devices and an IFIS plan. Reconsider premium options if centration cannot be assured."},
  refs:["R13"], grade:"D", tests:[T.DILAT]
},
{
  id:"pxf", layer:"caution",
  targets:{trifocal:2, lentis:2, edof:1},
  when:d => d.zonule === "pxf",
  ko:{t:"거짓비늘증후군 (소대 약화 의심)", why:"소대가 약하면 후기 낭수축과 렌즈 편심·기울어짐, 후기 탈구가 생길 수 있습니다. 이 경우 회절 광학과 토릭 축이 모두 무너집니다. 녹내장 동반도 흔합니다.", act:"낭내고리 사용을 검토하고 장기 추적 계획을 세우세요. 녹내장 동반 여부를 반드시 확인하세요."},
  en:{t:"Pseudoexfoliation with suspected weak zonules", why:"Weak zonules risk late capsular contraction, decentration, tilt and late dislocation, all of which destroy both diffractive optics and toric axis. Coexisting glaucoma is common.", act:"Consider a capsular tension ring and plan long-term follow-up. Always check for glaucoma."},
  refs:["R11","R13"], grade:"D", tests:[T.VF, T.DILAT]
},
{
  id:"vitrectomy_other", layer:"caution",
  targets:{trifocal:2, lentis:1.5, edof:0.8},
  when:d => !!d.vitrectomy,
  ko:{t:"유리체절제술 과거력 또는 향후 필요 가능성", why:"유리체가 없는 눈은 굴절 예측과 렌즈 안정성이 달라지고, 대개 기저 망막질환이 함께 있습니다. 향후 수술 시 선명한 안저 관찰이 필요합니다.", act:"기저 망막 상태와 황반 구조를 확인하고 망막 전문의와 상의하세요."},
  en:{t:"Prior or anticipated vitrectomy", why:"A vitrectomised eye behaves differently for refractive prediction and lens stability, and usually carries underlying retinal disease. Future surgery needs an unobstructed fundus view.", act:"Confirm the underlying retinal status and macular architecture with a retina specialist."},
  refs:["R19"], grade:"D", tests:[T.OCT, T.MACSTAB]
},
{
  id:"unilateral", layer:"caution",
  targets:{trifocal:1.5, lentis:1.5, edof:0.8, monoBlend:2},
  when:d => d.bilateral === "no",
  ko:{t:"한쪽 눈만 수술", why:"동시시 렌즈의 이점은 상당 부분 양안 합산에서 나옵니다. 한쪽만 삽입하면 양안의 이미지 질과 대비가 달라 융합이 어렵고 불편감이 커질 수 있습니다. 미니모노비전은 반대눈 굴절값을 전제로 하므로 성립하지 않습니다.", act:"반대눈의 현재 굴절값·수정체 상태·향후 수술 계획을 확인하고, 양안 계획이 정해진 뒤에 프리미엄을 결정하는 편이 안전합니다."},
  en:{t:"Unilateral surgery", why:"Much of the benefit of simultaneous-vision lenses comes from binocular summation. A single implanted eye creates an interocular mismatch in image quality that can be hard to fuse. Mini-monovision presupposes a known fellow-eye refraction and does not apply.", act:"Establish the fellow eye's refraction, lens status and surgical plan before committing to a premium option."},
  refs:["R19"], grade:"D", tests:[]
},
{
  id:"night_demand", layer:"caution",
  targets:{trifocal:2.5, lentis:1.8, edof:0.8},
  when:d => d.nightDriving === 3 || d.nightWork === true,
  ko:{t:"야간 운전 · 야간 근무가 직업적으로 필수", why:"헤일로는 다초점에서 단초점 대비 약 3.6배 흔합니다(RR 3.58, 95% CI 1.99–6.46). 야간 시력이 생계와 직결되는 경우 이 위험은 취향의 문제가 아니라 안전의 문제입니다.", act:"야간 요구를 가장 앞에 두고 설계하세요. 단초점 + 근거리 안경, 또는 초점을 나누지 않는 설계가 안전합니다."},
  en:{t:"Night driving or night work is occupationally essential", why:"Halos are about 3.6× more common with multifocals (RR 3.58, 95% CI 1.99–6.46). When night vision is livelihood-critical this is a safety question, not a preference.", act:"Design around the night requirement: non-diffractive optics, or a monofocal plus reading glasses."},
  refs:["R1"], grade:"A", tests:[T.PUPIL, T.COUNSEL]
},
{
  id:"expect_high", layer:"caution",
  targets:{trifocal:2, lentis:1.5, edof:0.8},
  when:d => d.perfectionism === 3 && d.dysphTolerance > 0,
  ko:{t:"매우 높은 기대 수준 · 완벽주의 성향", why:"신경적응 실패는 시력이 좋아도 발생하며 대개 6개월 안에 드러납니다. 이 성향에서는 작은 광학현상도 지속적 불만으로 이어지기 쉽습니다.", act:"‘안경을 덜 쓴다’와 ‘완벽한 시질’은 동시에 보장할 수 없다는 점을 술전에 문서화해 설명하세요."},
  en:{t:"Very high expectations / perfectionist temperament", why:"Neuroadaptation failure occurs even with excellent acuity and usually declares itself within 6 months. In this temperament small photic phenomena readily become persistent complaints.", act:"Document preoperatively that 'fewer glasses' and 'flawless image quality' cannot both be guaranteed."},
  refs:["R15","R12"], grade:"D", tests:[T.COUNSEL]
},
{
  id:"young_age", layer:"caution",
  targets:{trifocal:0.8, lentis:0.6},
  when:d => num(d.age) !== null && d.age < TU("cutAgeYoung"),
  ko:{t:"비교적 젊은 연령 (< 55세)", why:"남은 기대여명이 길어 향후 황반·녹내장 질환이 발생할 확률이 높고, 그때 렌즈를 되돌리기 어렵습니다. 동공도 더 크고 시각 요구도 까다로운 경향이 있습니다.", act:"장기 시나리오를 상담에 포함하고, 백내장이 아닌 굴절 목적 수술이라면 각막 굴절수술 등 다른 선택지도 비교하세요."},
  en:{t:"Younger patient (< 55 years)", why:"A long remaining lifespan raises the chance of later macular or glaucomatous disease, at which point the lens is hard to undo. Pupils are also larger and visual demands more exacting.", act:"Include the long-term scenario in counselling; if this is refractive rather than cataract surgery, compare corneal refractive options too."},
  refs:["R19","R16"], grade:"D", tests:[]
},

/* ============ NOTE (감점 없음) ============ */
{
  id:"sa_match_aspheric", layer:"note", targets:[],
  when:d => num(d.cornealSA) !== null && d.cornealSA >= TU("cutSaAspheric"),
  ko:{t:"비구면 IOL 매칭 권고", why:"측정된 각막 구면수차가 0.1 µm 이상이므로 음의 구면수차를 가진 비구면 IOL로 상쇄하는 것이 대비감도에 유리합니다. 모집단 평균은 +0.27 µm @6 mm입니다.", act:"각막 SA 값에 맞춰 IOL 비구면도(−0.20 / −0.27 µm 등)를 선택하세요. 렌즈 종류 선택과는 별개의 축입니다."},
  en:{t:"Match the aspheric IOL to the measured corneal SA", why:"Measured corneal spherical aberration is ≥0.1 µm, so a negative-SA aspheric IOL should be used to offset it. Population mean is +0.27 µm at 6 mm.", act:"Choose IOL asphericity (−0.20 / −0.27 µm) to match. This is a separate axis from the lens category."},
  refs:["R8"], grade:"D", tests:[]
},
{
  id:"sa_match_neutral", layer:"note", targets:[],
  when:d => num(d.cornealSA) !== null && d.cornealSA < TU("cutSaAspheric"),
  ko:{t:"무수차(aberration-neutral) IOL 권고", why:"각막 구면수차가 0.1 µm 미만입니다. 음의 구면수차 비구면 IOL을 넣으면 과보정되어 오히려 이미지 질이 나빠질 수 있습니다.", act:"구면수차 0에 가까운 무수차 IOL을 선택하세요. 근시 라식 후에는 양의 SA가 증가하고 원시 교정 후에는 음으로 이동하므로 반드시 실측값을 쓰세요."},
  en:{t:"Use an aberration-neutral IOL", why:"Corneal spherical aberration is below 0.1 µm. A negative-SA aspheric IOL would overcorrect and could worsen image quality.", act:"Select an aberration-neutral (SA ≈ 0) IOL. Myopic LVC raises positive SA and hyperopic LVC shifts it negative, so always use the measured value."},
  refs:["R8"], grade:"D", tests:[]
},
{
  id:"lentis_plan", layer:"note", targets:[],
  when:d => d.specIndep >= 2 && ((num(d.cornealComa) !== null && d.cornealComa > TU("cutComa")) ||
            (num(d.hoaRMS) !== null && (d.hoaZone === "6" ? d.hoaRMS > TU("cutHoa6") : d.hoaRMS > TU("cutHoa4")))),
  ko:{t:"굴절형 분절 이중초점을 쓴다면 양안 가입도와 주시안을 먼저 정하세요", why:"이 진료에서는 각막 고위수차가 큰 노안교정 희망 환자에게 굴절형 분절 이중초점(렌티스)을 쓰고, 가입도 +2.0 D와 +3.0 D를 눈에 따라 나누어 배정합니다. 두 눈의 가입도가 다르면 근거리 거리와 양안 융합이 달라지므로, 어느 눈에 어느 가입도를 넣을지는 수술 전에 정해져 있어야 합니다.", act:"주시안을 확인하고 환자의 주된 근업 거리(책·휴대폰·악보·컴퓨터)를 물어 가입도 배정을 먼저 결정하세요. 이 조합은 비교 임상시험이 아니라 임상 경험에 근거한 운용 방식임을 환자에게도 설명하세요."},
  en:{t:"If using a segmented refractive bifocal, decide the add powers and dominant eye first", why:"This practice uses a segmented refractive bifocal (LENTIS) for presbyopia-correction candidates with high corneal higher-order aberration, splitting +2.0 D and +3.0 D adds between the eyes. Different adds change the working distance and binocular fusion, so the assignment must be decided before surgery.", act:"Establish ocular dominance and the patient's main near working distance, then assign the adds. Explain that this arrangement rests on clinical experience rather than a comparative trial."},
  refs:["R19"], grade:"D", tests:[T.COUNSEL]
},
{
  id:"astig_toric_axis", layer:"note", targets:[],
  when:d => num(d.cylD) !== null && d.cylD >= TU("cutCyl") && !d.toricPlanKnown,
  ko:{t:"난시가 있으므로 토릭 병용을 전제로 봅니다", why:"토릭은 렌즈 종류와 별개의 축입니다. 단초점·프리미엄 단초점·연속초점·다초점 어느 쪽에도 함께 쓸 수 있으므로, 난시가 있다는 사실만으로 렌즈 종류의 순위가 바뀌지는 않습니다. 다만 난시를 교정하지 않은 채로는 어떤 렌즈를 넣어도 기대한 시력이 나오지 않으며, 초점을 나누는 렌즈일수록 잔여 난시의 타격이 큽니다.", act:"이 화면에서는 토릭 병용 여부를 정할 수 없으므로 '함께 쓴다'고 보고 순위를 매겼습니다. 실제 계획은 총 각막난시(후면 포함) 측정값을 보고 집도의가 정합니다. 토릭을 쓰지 않기로 하면 그때 프리미엄 선택지를 다시 검토해야 합니다."},
  en:{t:"Astigmatism present — a toric option is assumed", why:"Toric is an axis separate from the lens category: it combines with a monofocal, an enhanced monofocal, an EDOF or a multifocal alike. So the presence of astigmatism alone does not reorder the lens categories. Left uncorrected, however, no lens will deliver the expected result, and focus-splitting designs suffer most from residual cylinder.", act:"This screen cannot set the toric plan, so the ranking assumes toric will be used. The surgeon decides from the measured total corneal astigmatism. If toric is not used, the premium options must be revisited."},
  refs:["R13","R8"], grade:"C", tests:[T.TCA, T.TOPO]
},
{
  id:"toric_indicated", layer:"note", targets:[],
  when:d => num(d.cylD) !== null && d.cylD >= TU("cutToric"),
  ko:{t:"토릭 IOL 적응증", why:"각막난시 1.0 D 이상에서 토릭 IOL이 보편적으로 권고됩니다. 축이 3° 어긋날 때마다 교정효과가 약 10% 줄고 약 30°에서 완전히 소실되므로 축 표시와 정렬 정확도가 중요합니다.", act:"후면각막난시를 포함한 총 각막난시(TCA)로 계산하고, 술중 축 정렬 방법(디지털 마킹 등)을 계획하세요."},
  en:{t:"Toric IOL indicated", why:"Toric IOLs are universally recommended at ≥1.0 D of corneal astigmatism. Correction falls ~10% per 3° of misalignment and is lost near 30°, so marking and alignment accuracy matter.", act:"Calculate from total corneal astigmatism including the posterior surface, and plan intraoperative axis alignment (e.g. digital marking)."},
  refs:["R13","R8"], grade:"C", tests:[T.TCA]
},
{
  id:"neuroadapt_note", layer:"note", targets:[],
  when:d => d.specIndep >= 2,
  ko:{t:"신경적응과 잔여 안경에 대한 사전 합의", why:"안경 의존도를 크게 줄이고자 하는 경우 회절형 렌즈가 후보가 됩니다. 이 렌즈들은 신경적응에 2–3개월에서 1년까지 걸리고, 그 기간의 헤일로·왁시비전은 정상 경과입니다. 다초점에서도 안경이 전혀 필요 없다는 보장은 없습니다(안경 의존 RR 0.63, 즉 감소이지 소거가 아님).", act:"적응 기간, 잔여 안경 가능성, 야간 광학현상을 술전에 문서화해 설명하고 서면 동의에 포함하세요."},
  en:{t:"Agree on neuroadaptation and residual spectacle use in advance", why:"A strong wish for spectacle independence brings diffractive optics into play. These take 2–3 months to a year to neuroadapt, and halo or waxy vision during that period is expected. Even multifocals do not abolish glasses — spectacle dependence RR 0.63 is a reduction, not elimination.", act:"Document the adaptation period, the possibility of residual glasses, and night-time phenomena in the consent discussion."},
  refs:["R15","R1","R9"], grade:"A", tests:[T.COUNSEL]
},
];
