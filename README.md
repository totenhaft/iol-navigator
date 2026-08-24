# IOL 내비게이터

백내장 수술에서 **인공수정체(IOL)를 고를 때 쓰는 근거 기반 의사결정 보조 도구**입니다.
환자용 설문 모드와 전문가용 정밀 입력 모드를 모두 제공하며, 한국어와 영어를 지원합니다.

**웹에서 바로 쓰기 → https://YOUR-USERNAME.github.io/iol-navigator/**

> ⚠️ **의료 고지**
> 이 도구는 **임상 의사결정 보조(CDS)** 이며 **의료기기가 아닙니다.**
> 진단하지 않고, 처방하지 않으며, 담당 안과의사의 진찰과 판단을 대체하지 않습니다.
> 최종 인공수정체 선택은 반드시 실제 검사 소견과 집도의의 판단에 따라야 합니다.

---

## 처음 한 번만: GitHub에 올리고 웹사이트 켜기

이 폴더에서 아래 한 줄을 실행하면 저장소 생성 · 업로드 · 웹사이트 공개까지 한 번에 끝납니다.

```bash
bash setup.sh
```

GitHub CLI(`gh`)가 필요합니다. 없으면 `brew install gh` 로 설치한 뒤 다시 실행하세요.
스크립트가 로그인 → 저장소 생성 → 업로드 → Pages 켜기 순서로 진행하고, 마지막에 웹 주소를 알려 줍니다.

<details>
<summary>gh 없이 직접 하고 싶다면</summary>

1. https://github.com/new 에서 이름 `iol-navigator`, **Public** 으로 만듭니다. README·gitignore·license는 **추가하지 마세요.**
2. 이 폴더에서:

```bash
git init
git add -A
git commit -m "첫 커밋"
git branch -M main
git remote add origin https://github.com/내계정이름/iol-navigator.git
git push -u origin main
```

3. 저장소 **Settings → Pages → Source** 를 `GitHub Actions` 로 바꿉니다.
4. `README.md` 안의 `YOUR-USERNAME` 을 실제 계정 이름으로 바꿔 주세요.

</details>

---

## 무엇을 하는가

입력한 눈 상태와 생활 요구를 7가지 렌즈 유형에 대해 평가하고, 다음을 보여줍니다.

- **추천 1순위**와 그 이유
- **대안**과 각각의 적합도 점수
- **피해야 할 유형**과 배제된 근거
- **확인할 추가 검사** 목록
- 각 판단에 연결된 **근거 문헌과 근거 수준**

비교 대상: 단초점 · 단초점+미니모노비전 · 프리미엄 단초점(enhanced monofocal) · 비회절 EDOF · 회절 EDOF · 다초점/삼중초점 · 소구경 IOL. 토릭은 별개의 축으로 다룹니다.

## 설계에서 중요한 세 가지

**1. 용어를 국제 표준에 맞췄습니다.**
`프리미엄 단초점(enhanced monofocal)`은 EDOF가 **아닙니다.** ESCRS 기능적 분류상 Partial ROF의 `enhanced` 군이며, ISO 11979-7:2024 / ANSI Z80.35의 EDOF 초점심도 기준(0.20 logMAR에서 단초점 대비 +0.5 D)을 충족하지 않습니다. 국내에서 이 둘이 자주 혼용되기 때문에 도구 안에서 경계를 명시적으로 그었습니다.

**2. 단순 점수 합산이 아니라 3계층 로직입니다.**

| 계층 | 뜻 | 개수 |
|---|---|---|
| **금기(hard stop)** | 해당 렌즈를 후보에서 완전히 제외 | 14 |
| **주의(caution)** | 감점 + 사유와 조치를 함께 표시 | 21 |
| **권고(note)** | 감점 없는 임상 권고 | 4 |

어떤 입력에서도 **단초점은 배제되지 않고, 1순위는 항상 존재하며, 추가검사 목록은 비지 않습니다.** 이 세 가지는 테스트로 강제됩니다.

**3. 근거가 약한 수치는 약하다고 화면에 씁니다.**
angle kappa 0.5–0.6 mm 기준을 쓰되 26,470안 연구에서 술후 결과와 무관했다는 점과 장비 간 편차(동일 안에서 0.27 vs 0.43 mm)를 같은 화면에 함께 싣습니다. 각막 고위수차 기준도 마찬가지입니다. 모든 규칙에 근거 수준 배지(A/B/C/D)와 문헌 링크가 붙습니다.

---

## 직접 열어보기

가장 간단한 방법은 **`index.html` 파일을 브라우저로 여는 것**입니다. 인터넷 연결 없이도 동작하고, 입력한 내용은 브라우저 밖으로 전송되지 않습니다.

```bash
git clone https://github.com/YOUR-USERNAME/iol-navigator.git
cd iol-navigator
open index.html          # 맥. 윈도우는 start index.html, 리눅스는 xdg-open index.html
```

주소 뒤에 `?test=1` 을 붙이면 임상 로직 자체 검증 56건이 화면에 출력됩니다.

## 고치는 법

`index.html` 은 **빌드 결과물이라 직접 고치지 마세요.** 원본은 `src/` 에 나뉘어 있습니다.

```
src/
├── head.html          디자인 토큰(색·글꼴)과 모든 CSS
├── body.html          화면 구조
└── js/
    ├── 01-data.js     근거 문헌 목록, 렌즈 7종 정의
    ├── 02-schema.js   입력 항목 (환자 모드 / 전문가 모드)
    ├── 03-rules.js    ★ 의사결정 규칙 — 대부분의 수정은 여기서
    ├── 04-engine.js   규칙 실행과 점수 계산
    ├── 05-i18n.js     한국어·영어 문구, 용어 체계 표
    ├── 06-ui.js       화면 그리기
    └── 07-tests.js    임상 로직 자체 검증
```

고친 뒤 다시 합칩니다.

```bash
npm install     # 처음 한 번만
npm run build   # src/ → index.html
```

### 규칙 하나 추가하기

`src/js/03-rules.js` 의 `RULES` 배열에 객체 하나를 넣으면 끝입니다.

```js
{
  id: "규칙_고유이름",
  layer: "caution",                  // "stop"(금기) | "caution"(주의) | "note"(권고)
  targets: { trifocal: 2, edofDiff: 1.5 },   // 렌즈별 감점 (1 = 7점)
  when: d => d.어떤값 > 기준치,       // 조건. d 는 정규화된 입력값
  ko: { t: "제목", why: "왜 문제인지", act: "무엇을 할지" },
  en: { t: "...",  why: "...",        act: "..." },
  refs: ["R9"],                       // 01-data.js 의 문헌 ID
  grade: "C",                         // 근거 수준 A/B/C/D
  tests: [T.ABERRO]                   // '확인할 추가 검사'에 넣을 항목
}
```

`when` 안에서 값이 `null`(미입력)일 수 있다는 점만 주의하세요. `num(d.값) !== null && ...` 형태로 확인합니다. **미입력을 임의의 기본값으로 추론하지 않는 것이 이 도구의 원칙입니다.** 대신 '확인할 추가 검사'에 표시됩니다.

## 테스트

```bash
npm test
```

두 가지를 검사합니다.

- **임상 로직 56건** — 시나리오(황반변성, 증식성 당뇨망막병증, 중증 녹내장, 안구표면질환, RK 후, 원추각막, 소대 불안정, 야간운전, 완벽주의 조합), 수치 경계값, 미입력 처리, 데이터 정합성(문헌 ID·렌즈 ID·근거수준·한영 대응·중복 ID)
- **화면과 버튼 접근성** — 6개 화면 크기 × 2개 모드 × 4개 스크롤 위치에서 '결과 보기' 버튼이 실제로 보이고 눌리는지

`main` 에 푸시하면 GitHub Actions가 자동으로 빌드 → 테스트 → 배포합니다. **테스트가 실패하면 배포되지 않습니다.** 임상 도구이므로 이 순서는 바꾸지 마세요.

---

## 근거 문헌

도구 화면 하단의 '근거 문헌' 섹션에 19건이 근거 수준과 함께 정리되어 있습니다. 주요 출처:

- de Silva SR, Evans JR, et al. **Multifocal versus monofocal intraocular lenses after cataract extraction.** Cochrane Database Syst Rev. 2016;12:CD003169. — 안경 의존 RR 0.63, 헤일로 RR 3.58
- **Visual and patient-reported outcomes of enhanced versus monofocal IOLs.** Eye (Lond). 2025. — 중간거리 −0.11 logMAR, 광학현상 OR 1.13
- **ISO 11979-7:2024** — 동시시 IOL을 MIOL / EDOF / FVR 로 구분하는 국제 표준
- Ribeiro F, et al. **Evidence-based functional classification of simultaneous vision IOLs.** J Cataract Refract Surg. 2024;50(8):794–798. — ESCRS 기능적 분류
- Starr CE, et al. **An algorithm for the preoperative diagnosis and treatment of ocular surface disorders.** J Cataract Refract Surg. 2019;45(5):669–684. — ASCRS OSD 알고리즘
- **Matching the Patient to the Intraocular Lens.** Ophthalmology. 2021;128(11):e114–e127.
- American Academy of Ophthalmology. **Cataract in the Adult Eye Preferred Practice Pattern.** Ophthalmology. 2022;129(1):P1–P126.

## 알려진 한계

- 규칙별 **가중치는 문헌이 아니라 임상적 판단으로 정한 값**입니다. 실제 진료 데이터로 보정할 여지가 큽니다.
- 국내 비급여 비용 정보와 유통 렌즈 모델명 매핑은 의도적으로 넣지 않았습니다(빠르게 낡고 검증이 어렵습니다).
- 양안 비대칭 설계(각 눈에 다른 렌즈)와 목표 굴절값 계산은 범위 밖입니다.
- 개인정보는 수집하지 않습니다. 서버가 없고 모든 계산이 브라우저 안에서 끝납니다.

## 라이선스

[MIT](LICENSE). 다만 `LICENSE` 파일 하단의 의료 고지를 함께 확인하세요.
