/* ------------------------------------------------------------------
   입력 스키마 — 환자 설문 모드 / 전문가 정밀 모드
   ------------------------------------------------------------------ */
const S = (v,ko,en) => ({v,ko,en});
const UNK = S("unknown","모름 / 확인 필요","Not known / to be checked");

const SCALE4 = (a,b,c,d, ea,eb,ec,ed) => [S("0",a,ea),S("1",b,eb),S("2",c,ec),S("3",d,ed)];

/* ---- 공통 선택지 ---- */
const OPT_MACULA = [
  S("normal","이상 없음","Normal"),
  S("drusen","드루젠만 있음 (시력 정상)","Drusen only, normal acuity"),
  S("amd_intermediate","중기 건성 황반변성","Intermediate dry AMD"),
  S("amd_advanced","진행성 황반변성 (지도모양위축·습성)","Advanced AMD (GA or neovascular)"),
  S("erm_mild","경미한 망막앞막 (시력 영향 없음)","Mild ERM, acuity unaffected"),
  S("erm_significant","시력에 영향을 주는 망막앞막·황반원공","ERM or macular hole affecting acuity"),
  S("dme","당뇨황반부종 (과거 또는 현재)","Diabetic macular oedema (past or present)"),
  S("other","기타 시력 영향 황반질환","Other vision-limiting maculopathy"),
  UNK
];
const OPT_GLAUCOMA = [
  S("none","없음","None"),
  S("suspect","녹내장 의증 / 고안압증","Suspect or ocular hypertension"),
  S("mild","초기 (시야 결손 경미, 조절 양호)","Early — mild field loss, controlled"),
  S("moderate","중등도 (시야 결손 뚜렷)","Moderate — definite field loss"),
  S("severe","중증 (중심시야 침범·진행성)","Severe — central field involved or progressing"),
  UNK
];
const OPT_DR = [
  S("none","당뇨 없음 또는 망막병증 없음","No diabetes or no retinopathy"),
  S("npdr","비증식성 당뇨망막병증 (NPDR)","Non-proliferative DR"),
  S("pdr","증식성 당뇨망막병증 (PDR)","Proliferative DR"),
  UNK
];
const OPT_CORNEA = [
  S("normal","이상 없음","Normal"),
  S("guttata","구타타 (부종 없음)","Guttata without oedema"),
  S("fuchs_edema","푹스이상증 + 각막부종","Fuchs dystrophy with oedema"),
  S("ebmd","전기저막이상증 (EBMD)","Epithelial basement membrane dystrophy"),
  S("kc_stable","안정된 원추각막 / forme fruste","Stable keratoconus / forme fruste"),
  S("kc_progressive","진행성 원추각막·각막확장증","Progressive keratoconus or ectasia"),
  S("scar","각막 혼탁·반흔","Corneal scar or opacity"),
  S("graft","각막이식 후","Post-keratoplasty"),
  UNK
];
const OPT_OSD = [
  S("none","없음","None"),
  S("mild","경미 — 시력에 영향 없음","Non-visually-significant"),
  S("visually_significant","시력에 영향을 주는 상태 (불규칙 각막상피·계측 불안정)","Visually significant"),
  UNK
];
const OPT_REFSX = [
  S("none","없음","None"),
  S("myopic_lvc","근시 라식·라섹·스마일","Myopic LASIK / PRK / SMILE"),
  S("hyperopic_lvc","원시 라식·라섹","Hyperopic LASIK / PRK"),
  S("rk","방사상각막절개 (RK)","Radial keratotomy (RK)"),
  UNK
];
const OPT_ZONULE = [
  S("stable","안정","Stable"),
  S("pxf","거짓비늘증후군 (소대 약화 의심)","Pseudoexfoliation, suspected weak zonules"),
  S("phacodonesis","수정체진탕·소대 불안정","Phacodonesis / zonular instability"),
  UNK
];

/* ---- 전문가 정밀 모드 ---- */
const SECTIONS_PRO = [
 { id:"basics", ko:"기본 정보", en:"Basics", open:true, fields:[
   {key:"age", type:"number", ko:"나이", en:"Age", unit:"세 / yr", min:18, max:105, step:1, ph:"예: 68"},
   {key:"bilateral", type:"select", ko:"수술 계획", en:"Surgical plan", options:[
     S("yes","양안 수술 예정","Bilateral surgery planned"),
     S("no","한쪽 눈만 수술 (반대눈은 자연 수정체 또는 기존 IOL)","Unilateral only")], def:"yes"},
 ]},

 { id:"ocular", ko:"동반 안질환", en:"Ocular comorbidity", open:true, fields:[
   {key:"macula", type:"select", ko:"황반 상태", en:"Macula", options:OPT_MACULA, def:"normal",
    hint:"OCT 소견 기준. 시력에 영향을 주는 황반질환은 회절형 렌즈의 대비감도 손실과 중첩됩니다.",
    hintEn:"Based on OCT. Vision-limiting maculopathy compounds the contrast loss of diffractive optics."},
   {key:"glaucoma", type:"select", ko:"녹내장", en:"Glaucoma", options:OPT_GLAUCOMA, def:"none"},
   {key:"dr", type:"select", ko:"당뇨망막병증", en:"Diabetic retinopathy", options:OPT_DR, def:"none"},
   {key:"cornea", type:"select", ko:"각막", en:"Cornea", options:OPT_CORNEA, def:"normal"},
   {key:"osd", type:"select", ko:"안구표면질환 (OSD)", en:"Ocular surface disease", options:OPT_OSD, def:"none",
    hint:"ASCRS 알고리즘: 시력에 영향을 주는 OSD는 치료 후 생체계측을 다시 해야 합니다.",
    hintEn:"ASCRS algorithm: visually significant OSD must be treated and biometry repeated."},
   {key:"zonule", type:"select", ko:"소대 / 수정체 지지", en:"Zonular support", options:OPT_ZONULE, def:"stable"},
   {key:"flags", type:"checks", ko:"해당 사항 선택", en:"Check all that apply", items:[
     {key:"opticNeuro", ko:"시신경병증 · 시신경위축 · 약시", en:"Optic neuropathy, optic atrophy or amblyopia"},
     {key:"uveitis",    ko:"만성·재발성 포도막염", en:"Chronic or recurrent uveitis"},
     {key:"vitrectomy", ko:"유리체절제술 과거력 또는 향후 필요 가능성", en:"Prior vitrectomy or likely future vitreoretinal surgery"},
     {key:"ifis",       ko:"탐술로신 등 α-차단제 복용 (IFIS 위험) 또는 산동 불량", en:"Alpha-blocker use (IFIS risk) or poor dilation"},
   ]},
 ]},

 { id:"cornealOptics", ko:"각막 광학", en:"Corneal optics", open:true, fields:[
   {key:"priorRefSx", type:"select", ko:"이전 각막 굴절수술", en:"Prior corneal refractive surgery", options:OPT_REFSX, def:"none"},
   {key:"cylD", type:"number", ko:"각막 난시", en:"Corneal astigmatism", unit:"D", min:0, max:12, step:0.05, ph:"예: 1.25",
    hint:"후면각막난시를 반영한 총 각막난시(TCA)를 권장합니다.",
    hintEn:"Total corneal astigmatism including the posterior surface is preferred."},
   {key:"cornealSA", type:"number", ko:"각막 구면수차 (SA)", en:"Corneal spherical aberration", unit:"µm @6 mm", min:-1, max:2, step:0.01, ph:"예: 0.27",
    hint:"모집단 평균 ≈ +0.27 µm @6 mm.", hintEn:"Population mean ≈ +0.27 µm at 6 mm."},
   {key:"cornealComa", type:"number", ko:"각막 코마 (coma RMS)", en:"Corneal coma RMS", unit:"µm @6 mm", min:0, max:3, step:0.01, ph:"예: 0.18"},
   {key:"hoaRMS", type:"number", ko:"총 각막 고위수차 (HOA RMS)", en:"Total corneal HOA RMS", unit:"µm", min:0, max:3, step:0.01, ph:"예: 0.28"},
   {key:"hoaZone", type:"select", ko:"HOA 측정 동공경", en:"HOA analysis zone", options:[
     S("4","4 mm (주간 조건)","4 mm (photopic)"), S("6","6 mm (야간 조건)","6 mm (mesopic)")], def:"4"},
   {key:"chordMu", type:"number", ko:"Chord mu (angle kappa)", en:"Chord mu (angle kappa)", unit:"mm", min:0, max:2, step:0.01, ph:"예: 0.28",
    hint:"장비 간 편차가 큽니다. 측정 기기를 함께 기록하세요.", hintEn:"Large inter-device variability — record the measuring device."},
   {key:"chordAlpha", type:"number", ko:"Chord alpha (angle alpha)", en:"Chord alpha (angle alpha)", unit:"mm", min:0, max:2, step:0.01, ph:"예: 0.45"},
   {key:"cflags", type:"checks", ko:"해당 사항 선택", en:"Check all that apply", items:[
     {key:"irregularAstig", ko:"불규칙 난시 (지형도상 비대칭·불규칙 패턴)", en:"Irregular astigmatism on topography"},
     {key:"toricPlanned",   ko:"난시교정(토릭 IOL 또는 각막절개) 병용 계획", en:"Toric IOL or corneal incision planned"},
   ]},
 ]},

 { id:"biometry", ko:"동공 · 생체계측", en:"Pupil and biometry", open:true, fields:[
   {key:"pupPhotopic", type:"number", ko:"명소시 동공 (photopic)", en:"Photopic pupil", unit:"mm", min:1, max:9, step:0.1, ph:"예: 3.0"},
   {key:"pupMesopic", type:"number", ko:"암소시 동공 (mesopic)", en:"Mesopic pupil", unit:"mm", min:1, max:9, step:0.1, ph:"예: 5.2"},
   {key:"al", type:"number", ko:"안축장 (AL)", en:"Axial length", unit:"mm", min:18, max:38, step:0.01, ph:"예: 23.60"},
 ]},

 { id:"lifestyle", ko:"생활 요구와 선호", en:"Visual demands and preferences", open:true, fields:[
   {key:"specIndep", type:"scale", ko:"안경으로부터 자유롭고 싶은 정도", en:"Desire for spectacle independence",
    options:SCALE4("상관없음","약간","꽤","매우 강함","Not important","Slightly","Quite","Very strong"), def:"1"},
   {key:"nearPriority", type:"scale", ko:"근거리 작업 비중 (독서·휴대폰·바느질)", en:"Near-work demand (reading, phone, handwork)",
    options:SCALE4("거의 없음","가끔","자주","매일 많이","Rare","Occasional","Frequent","Heavy daily"), def:"1"},
   {key:"interPriority", type:"scale", ko:"중간거리 작업 비중 (컴퓨터·주방·악보)", en:"Intermediate demand (computer, kitchen, music)",
    options:SCALE4("거의 없음","가끔","자주","매일 많이","Rare","Occasional","Frequent","Heavy daily"), def:"1"},
   {key:"nightDriving", type:"scale", ko:"야간 운전의 중요도", en:"Night-driving demand",
    options:SCALE4("안 함","드물게","자주","직업적·필수","None","Rare","Frequent","Occupational"), def:"1"},
   {key:"dysphTolerance", type:"scale", ko:"빛번짐·헤일로 감내 가능 정도", en:"Tolerance for halo and glare",
    options:SCALE4("전혀 못 견딤","조금","웬만큼","충분히","None","Little","Moderate","High"), def:"1"},
   {key:"perfectionism", type:"scale", ko:"완벽주의·불안 성향 / 기대 수준", en:"Perfectionism, anxiety, expectation level",
    options:SCALE4("느긋함","보통","높음","매우 높음 (완벽 요구)","Relaxed","Average","High","Very high"), def:"1"},
   {key:"costSensitivity", type:"scale", ko:"비용 민감도", en:"Cost sensitivity",
    options:SCALE4("상관없음","약간","꽤","매우 큼","Not a factor","Slight","Considerable","Major"), def:"1"},
   {key:"lflags", type:"checks", ko:"해당 사항 선택", en:"Check all that apply", items:[
     {key:"precisionNearWork", ko:"현미경·확대경·정밀 근업이 직업의 핵심", en:"Microscope, magnifier or precision near-work is central to the job"},
     {key:"nightWork", ko:"야간 근무 또는 야간 시력이 직업적으로 중요", en:"Night shift work or occupational night vision"},
   ]},
 ]},
];

/* ---- 환자 설문 모드 ---- */
const SECTIONS_PATIENT = [
 { id:"pbasics", ko:"나에 대해", en:"About you", open:true, fields:[
   {key:"age", type:"number", ko:"나이", en:"Age", unit:"세 / yr", min:18, max:105, step:1, ph:"예: 68"},
   {key:"bilateral", type:"select", ko:"수술 계획", en:"Surgical plan", options:[
     S("yes","양쪽 눈 모두 수술 예정","Both eyes"),
     S("no","한쪽 눈만 수술","One eye only"),
     UNK], def:"yes"},
 ]},

 { id:"pwant", ko:"내가 원하는 시력", en:"The vision you want", open:true, fields:[
   {key:"specIndep", type:"scale", ko:"안경 없이 지내고 싶은 정도", en:"How much do you want to be free of glasses?",
    options:SCALE4("안경 써도 괜찮다","조금 줄면 좋겠다","꽤 줄이고 싶다","되도록 안 쓰고 싶다","Fine with glasses","A little less","Quite a lot less","As little as possible"), def:"1",
    hint:"완전한 탈안경을 보장하는 렌즈는 없습니다. 다초점에서도 상황에 따라 안경이 필요할 수 있습니다.",
    hintEn:"No lens guarantees total spectacle freedom; glasses may still be needed in some situations."},
   {key:"nearPriority", type:"scale", ko:"가까운 곳을 보는 일 (책·휴대폰·바느질)", en:"Near tasks (reading, phone, handwork)",
    options:SCALE4("거의 없다","가끔","자주","하루 종일","Rare","Sometimes","Often","All day"), def:"1"},
   {key:"interPriority", type:"scale", ko:"중간 거리를 보는 일 (컴퓨터·요리·악보)", en:"Intermediate tasks (computer, cooking, music)",
    options:SCALE4("거의 없다","가끔","자주","하루 종일","Rare","Sometimes","Often","All day"), def:"1"},
   {key:"nightDriving", type:"scale", ko:"밤 운전을 얼마나 하시나요", en:"How much night driving?",
    options:SCALE4("안 한다","가끔","자주","일 때문에 꼭 필요","Never","Sometimes","Often","Required for work"), def:"1"},
   {key:"dysphTolerance", type:"scale", ko:"밤에 불빛 주변 번짐(헤일로)을 견딜 수 있나요", en:"Could you live with halos around lights at night?",
    options:SCALE4("전혀 못 견딘다","조금은","웬만큼 견딘다","충분히 견딘다","Not at all","A little","Reasonably","Easily"), def:"1",
    hint:"헤일로는 다초점 렌즈에서 단초점보다 약 3.6배 흔합니다 (Cochrane).",
    hintEn:"Halos are about 3.6× more common with multifocal lenses (Cochrane)."},
 ]},

 { id:"pstyle", ko:"성향과 생활", en:"Temperament and lifestyle", open:true, fields:[
   {key:"perfectionism", type:"scale", ko:"작은 불편도 크게 신경 쓰는 편인가요", en:"Do small imperfections bother you a lot?",
    options:SCALE4("느긋한 편","보통","신경 쓰는 편","매우 예민한 편","Relaxed","Average","Somewhat","Very much"), def:"1"},
   {key:"costSensitivity", type:"scale", ko:"비용이 선택에 얼마나 영향을 주나요", en:"How much does cost affect your choice?",
    options:SCALE4("상관없다","조금","꽤","매우 크다","Not at all","A little","Quite","A lot"), def:"1"},
   {key:"lflags", type:"checks", ko:"해당되는 것을 모두 선택하세요", en:"Check all that apply", items:[
     {key:"precisionNearWork", ko:"현미경·확대경을 쓰거나 아주 정밀한 손작업을 직업으로 한다", en:"I use a microscope/magnifier or do precision handwork for a living"},
     {key:"nightWork", ko:"야간 근무를 하거나 밤에 잘 보이는 것이 직업상 중요하다", en:"I work nights or need good night vision for work"},
   ]},
 ]},

 { id:"peye", ko:"눈 건강 (아는 만큼만)", en:"Eye health (as far as you know)", open:true, fields:[
   {key:"macula", type:"select", ko:"망막·황반 관련 진단을 받은 적이 있나요", en:"Any retina or macula diagnosis?", def:"normal", options:[
     S("normal","없다","No"),
     S("drusen","황반에 드루젠이 있다고 들었다 (시력은 정상)","Told I have drusen, vision normal"),
     S("amd_intermediate","황반변성이 있다고 들었다 (주사 치료는 안 함)","Macular degeneration, no injections"),
     S("amd_advanced","황반변성으로 주사 치료를 받고 있다/받았다","Macular degeneration treated with injections"),
     S("erm_mild","망막앞막이 있다고 들었다 (시력은 괜찮다)","Epiretinal membrane, vision still good"),
     S("erm_significant","망막앞막·황반원공으로 시력이 떨어졌다","ERM or macular hole reducing my vision"),
     S("dme","당뇨로 황반이 부은 적이 있다","Diabetic swelling of the macula"),
     UNK]},
   {key:"glaucoma", type:"select", ko:"녹내장", en:"Glaucoma", def:"none", options:[
     S("none","없다","No"),
     S("suspect","녹내장 의심이라고 들었다 / 안압이 높다","Told I am a glaucoma suspect"),
     S("mild","초기 녹내장으로 안약을 쓰고 있다","Early glaucoma, on drops"),
     S("moderate","녹내장이 꽤 진행됐다고 들었다","Told my glaucoma is fairly advanced"),
     S("severe","녹내장으로 시야가 많이 좁아졌다 / 수술을 받았다","Severe field loss or glaucoma surgery"),
     UNK]},
   {key:"dr", type:"select", ko:"당뇨망막병증", en:"Diabetic retinopathy", def:"none", options:[
     S("none","당뇨가 없거나 망막에는 이상이 없다","No diabetes, or retina normal"),
     S("npdr","당뇨로 망막에 초기 변화가 있다","Early diabetic retinal changes"),
     S("pdr","당뇨망막병증으로 레이저·주사 치료를 받았다","Laser or injections for diabetic retinopathy"),
     UNK]},
   {key:"cornea", type:"select", ko:"각막", en:"Cornea", def:"normal", options:[
     S("normal","이상 없다","Normal"),
     S("guttata","각막 내피가 약하다고 들었다","Told my corneal endothelium is weak"),
     S("fuchs_edema","각막이 붓는 병(푹스이상증)이 있다","Fuchs dystrophy with swelling"),
     S("kc_stable","원추각막이 있으나 안정적이다","Keratoconus, stable"),
     S("kc_progressive","원추각막이 진행 중이다","Keratoconus, progressing"),
     S("scar","각막에 흉터·혼탁이 있다","Corneal scar or haze"),
     S("graft","각막이식을 받았다","Had a corneal transplant"),
     UNK]},
   {key:"osd", type:"select", ko:"안구건조증", en:"Dry eye", def:"none", options:[
     S("none","없다","No"),
     S("mild","가벼운 편이다","Mild"),
     S("visually_significant","심해서 시야가 흐려지거나 인공눈물을 자주 넣는다","Severe — vision blurs, frequent drops"),
     UNK]},
   {key:"priorRefSx", type:"select", ko:"라식·라섹 등 시력교정수술", en:"Prior laser vision correction", def:"none", options:[
     S("none","받은 적 없다","Never"),
     S("myopic_lvc","근시 교정으로 라식/라섹/스마일을 받았다","Myopic LASIK / PRK / SMILE"),
     S("hyperopic_lvc","원시 교정 수술을 받았다","Hyperopic laser correction"),
     S("rk","오래전 각막에 방사형으로 칼자국을 내는 수술(RK)을 받았다","Radial keratotomy long ago"),
     UNK]},
   {key:"astigKnown", type:"select", ko:"난시가 있다고 들으셨나요", en:"Were you told you have astigmatism?", def:"unknown", options:[
     S("no","없다고 들었다","No"),
     S("some","약간 있다고 들었다","A little"),
     S("lots","많다고 들었다 / 난시교정 렌즈 이야기를 들었다","A lot, or toric lens was mentioned"),
     UNK]},
   {key:"pflags", type:"checks", ko:"해당되는 것을 모두 선택하세요", en:"Check all that apply", items:[
     {key:"opticNeuro", ko:"시신경 질환·약시(어릴 때부터 한쪽 눈이 나쁨)가 있다", en:"Optic nerve disease or lifelong amblyopia"},
     {key:"uveitis",    ko:"포도막염(눈 속 염증)이 반복된다", en:"Recurrent intraocular inflammation"},
     {key:"vitrectomy", ko:"망막 수술(유리체절제술)을 받은 적이 있다", en:"Previous retinal (vitrectomy) surgery"},
     {key:"ifis",       ko:"전립선약(탐술로신 등)을 복용 중이다", en:"Taking a prostate medication such as tamsulosin"},
   ]},
 ]},
];
