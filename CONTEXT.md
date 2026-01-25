# HandsFree 프로젝트 컨텍스트

> **다른 기기에서 이 대화를 이어가려면:**
> 1. 이 저장소를 clone/pull
> 2. Cursor에서 이 파일을 열고
> 3. "이 CONTEXT.md 파일 읽고 컨텍스트 파악해서 이어서 진행해줘"라고 말하면 됨

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | HandsFree (핸즈프리) |
| 서비스 설명 | 성수동 24시 물품 보관 서비스 |
| 타겟 | 성수동 방문 여행객/외국인 |
| 랜딩페이지 | https://handsfree.vercel.app |
| 일본어 페이지 | https://handsfree.vercel.app/jp |
| GitHub | https://github.com/pretotyper-sth/handsfree-landing |

---

## 현재 상태 (2025-01-25 기준)

### 완료된 작업

#### UI/UX
- [x] 헤더: 좌측 로고/태그라인 + 우측 언어 드롭다운 (한국어/日本語)
- [x] 헤더 sticky 고정 (스크롤 시에도 상단 고정)
- [x] Hero 섹션: PASONA(G) 프레임워크 적용
  - 태그라인: "짐을 맡기고 자유롭게 성수를 즐기세요"
  - 서브: "역에서 도보 6분 · 24시간 · 오늘 21명 이용 중"
  - CTA 버튼 2개: "살펴보기" + "채널 추가" (나중에 이용하기)
  - 할인 텍스트: "🎫 오픈 기념, 3월까지 25% 할인" (shine 효과)
- [x] 채널 선택 모달: 인스타그램 / 카카오톡 선택 (카카오는 준비 중)
- [x] 살펴보기 버튼 클릭 → 일시 선택 섹션으로 스크롤 + "여기부터 시작" 토스트 태그
- [x] 지도 섹션: "위치" 타이틀 추가
- [x] 지도: Leaflet.js + OSRM 도보 경로 (다크 테마)
- [x] 위치 모달: Intersection Observer로 지도 보일 때 표시
- [x] 위치 권한 저장: localStorage로 재방문 시 자동 적용
- [x] 기본 위치: 성수역 (위치 허용 안 할 때, 도보 6분 고정)
- [x] 성수역 마커: 지하철 이모지 + 역명 라벨
- [x] 가격 표시: 원가 취소선 + 할인가 표시 (3월까지 25% 할인)
- [x] 일본어 페이지 동기화: 모든 UI 요소 번역 완료

#### Analytics (GA4) - MECE 정리됨

**페이지/세션**
| 이벤트 | 설명 | 속성 |
|--------|------|------|
| `page_view` | 페이지 조회 | referrer, screenWidth/Height, browserLanguage, pageLanguage, isReturning, visitCount |
| `scroll_depth` | 스크롤 깊이 | depth (25/50/75/100) |

**퍼널 진행**
| 이벤트 | 설명 | 속성 |
|--------|------|------|
| `hero_cta_click` | 상단 CTA 클릭 | type (reserve_now, later_use) |
| `bottom_cta_click` | 하단 CTA 클릭 | type (later_use) |
| `size_selected` | 사이즈 선택 | size, previousSize, price |
| `time_selected` | 시간 선택 | hours, previousHours, price |
| `datetime_selected` | 날짜/시간 선택 | type (date/time), value, isToday |
| `reserve_click` | 예약 클릭 | attempt, size, hours, price, timeOnPage |

**채널 전환**
| 이벤트 | 설명 | 속성 |
|--------|------|------|
| `channel_modal_open` | 채널 모달 오픈 | language |
| `channel_selected` | 채널 선택 | channel (instagram, kakao) |
| `channel_modal_close` | 채널 모달 닫기 | - |

**위치/지도**
| 이벤트 | 설명 | 속성 |
|--------|------|------|
| `location_modal_shown` | 위치 모달 표시 | - |
| `location_permission` | 위치 권한 응답 | action (allow, skip, backdrop_close) |
| `geolocation_result` | 지오로케이션 결과 | success, lat, lng, accuracy / reason, code |
| `route_calculated` | 경로 계산 | durationMin, distanceM, source (osrm/fallback), userLat, userLng |

**기타 상호작용**
| 이벤트 | 설명 | 속성 |
|--------|------|------|
| `language_selected` | 언어 변경 | from, to |
| `copy_address` | 주소 복사 | - |

**오류/이탈**
| 이벤트 | 설명 | 속성 |
|--------|------|------|
| `error_modal_shown` | 오류 모달 표시 | - |
| `modal_close` | 모달 닫기 | method (button, backdrop) |
| `retry_click` | 재시도 클릭 | - |
| `503_page_shown` | 503 페이지 표시 | - |

#### 가격 정책 (2026년 3월까지 25% 할인)

| 사이즈 | 4시간 원가 | 4시간 할인가 | 8시간 원가 | 8시간 할인가 |
|--------|-----------|------------|-----------|------------|
| S (소형) | ₩4,000 | ₩3,000 | ₩7,000 | ₩5,250 |
| M (중형) | ₩4,000 | ₩3,000 | ₩7,000 | ₩5,250 |
| L (대형) | ₩5,000 | ₩3,750 | ₩8,000 | ₩6,000 |

#### 배포
- [x] Vercel 자동 배포 설정
- [x] vercel.json: trailingSlash: false (/jp → /jp로 정리)

---

### 광고 실험 결과 (2025.01.23~25)

| 지표 | 수치 |
|------|------|
| 광고 CTR | 2.0~2.5% |
| 고유 방문자 | 272명 |
| 예약 완료 | 6명 |
| 전환율 | 2.2% |

**주요 이탈 구간:**
- 74% First Fold에서 이탈 (스크롤 안 함)
- geolocation_error 91건 (인앱 브라우저 문제)
- size_selected 13 → reserve_click 6 (54% 이탈)

**상세 리포트:** `experiments/2025-01-24_instagram-ad-test.md`

---

## 다음 할 일 (TODO)

### 가설 검증 실험
> **"짐 보관은 미리 예약이 아니라 현장에서 필요할 때 이용하는 서비스다"**

- [ ] 실험 A: "알림 받기" vs "지금 예약하기" CTA 비교
- [ ] 실험 B: 카카오 채널 추가 유도 테스트
- [ ] 실험 C: 리타겟팅 광고 전환율 비교 (첫 방문 vs 재방문)

### 퍼널 최적화
- [ ] 인앱 브라우저 감지 → Safari/Chrome 열기 배너
- [ ] First Fold 가치 제안 강화
- [ ] 위치 권한 없이도 예약 가능하게 (주소 직접 입력)
- [ ] 신뢰도 강화: 실제 보관 시설 사진, 이용 후기

---

## 기술 스택

- **Frontend:** Vanilla HTML/CSS/JS
- **지도:** Leaflet.js + CartoDB Dark Tiles
- **경로:** OSRM API (도보 경로 계산)
- **Analytics:** Google Analytics 4
- **배포:** Vercel (GitHub 연동)

---

## 파일 구조

```
/
├── index.html          # 한국어 랜딩페이지
├── jp/index.html       # 일본어 랜딩페이지
├── styles.css          # 스타일시트
├── script.js           # 메인 로직 (지도, 예약, 분석)
├── favicon.png         # 로고 아이콘
├── kakao-logo.png      # 카카오톡 로고
├── og-image.jpg        # 소셜 공유 이미지
├── vercel.json         # Vercel 설정
├── CONTEXT.md          # 이 파일 (프로젝트 컨텍스트)
└── experiments/
    └── 2025-01-24_instagram-ad-test.md  # 실험 리포트
```

---

## 주요 결정 사항

1. **위치 권한 UX**: 페이지 로드 즉시 요청 → 지도 보일 때 모달로 변경
2. **기본 위치**: 성수역 좌표 사용 (도보 6분 고정 표시)
3. **일본어 지원**: /jp 경로로 분리, 동일 script.js 공유
4. **PASONA(G) 적용**: Hero 섹션에 문제-해결 구조 적용
5. **채널 전환 전략**: 즉시 예약 외에 "나중에 이용하기" 옵션 추가

---

## 연락처 / 참고

- 인스타그램: 팔로워 5명 획득 (광고 기간 중)
- 광고 채널: Facebook Ad Manager → Instagram

---

*마지막 업데이트: 2025-01-25*
