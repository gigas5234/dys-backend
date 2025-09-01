# 눈 분석 시스템 상세 문서

## 📋 개요

MediaPipe Face Landmarker를 사용하여 눈 관련 3가지 분석을 수행합니다:
1. **깜빡임 분석** (Blinking Analysis)
2. **시선 분석** (Gaze Analysis) 
3. **집중도 분석** (Concentration Analysis)

## 👁️ 1. 깜빡임 분석 (Blinking Analysis)

### 📍 사용되는 랜드마크

#### 왼쪽 눈 (18개 포인트 - 확장됨):
**기본 윤곽 (6개):**
- `landmarks[33]` - 왼쪽 눈 외곽 좌측
- `landmarks[7]` - 왼쪽 눈 위쪽
- `landmarks[163]` - 왼쪽 눈 외곽 우측
- `landmarks[144]` - 왼쪽 눈 아래쪽 좌측
- `landmarks[145]` - 왼쪽 눈 아래쪽
- `landmarks[153]` - 왼쪽 눈 아래쪽 우측

**눈꺼풀 추가 (6개):**
- `landmarks[160]`, `landmarks[158]`, `landmarks[157]`
- `landmarks[173]`, `landmarks[133]`, `landmarks[155]`

**눈동자 영역 (6개):**
- `landmarks[46]`, `landmarks[53]`, `landmarks[52]`
- `landmarks[51]`, `landmarks[48]`, `landmarks[115]`

#### 오른쪽 눈 (18개 포인트 - 확장됨):
**기본 윤곽 (6개):**
- `landmarks[362]` - 오른쪽 눈 외곽 좌측
- `landmarks[382]` - 오른쪽 눈 위쪽
- `landmarks[381]` - 오른쪽 눈 외곽 우측
- `landmarks[380]` - 오른쪽 눈 아래쪽 좌측
- `landmarks[374]` - 오른쪽 눈 아래쪽
- `landmarks[373]` - 오른쪽 눈 아래쪽 우측

**눈꺼풀 추가 (6개):**
- `landmarks[387]`, `landmarks[385]`, `landmarks[384]`
- `landmarks[398]`, `landmarks[359]`, `landmarks[384]`

**눈동자 영역 (6개):**
- `landmarks[276]`, `landmarks[283]`, `landmarks[282]`
- `landmarks[281]`, `landmarks[278]`, `landmarks[344]`

**총 사용 랜드마크**: 36개 (각 눈당 18개) - 기존 12개에서 3배 확장

### 🧮 EAR (Eye Aspect Ratio) 계산

```javascript
function eyeAspectRatio(eye) {
    const A = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const B = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const C = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (A + B) / (2.0 * C);
}
```

**EAR 공식 설명:**
- **A**: 상하 세로 거리 (위쪽-아래쪽)
- **B**: 상하 세로 거리 (중앙 위-중앙 아래)
- **C**: 좌우 가로 거리 (외곽 좌-외곽 우)
- **EAR**: (A + B) / (2 × C)

### 📊 깜빡임 상태 판단

```javascript
const blinkEarThreshold = 0.19;     // 깜빡임 시작 임계값
const blinkClosedThreshold = 0.22;  // 눈 감김 임계값

if (avgEAR < blinkClosedThreshold) {
    blinkStatus = 'closed';     // 눈 감김
} else if (avgEAR < blinkEarThreshold) {
    blinkStatus = 'blinking';   // 깜빡이는 중
} else {
    blinkStatus = 'open';       // 눈 뜸
}
```

### 📈 깜빡임 통계 추적

#### 유효한 깜빡임 조건:
- **지속시간**: 50ms - 500ms
- **EAR 변화**: 임계값 이하로 떨어졌다가 다시 올라옴

#### 추적 데이터:
```javascript
{
    score: 85,                    // 깜빡임 점수 (0-100)
    ear: 0.23,                   // 현재 EAR 값
    blinkStatus: 'open',         // 현재 상태
    blinkRatePerMinute: 18,      // 분당 깜빡임 횟수
    avgBlinkDuration: 150,       // 평균 깜빡임 지속시간 (ms)
    totalBlinkCount: 45          // 총 깜빡임 횟수
}
```

### 🎯 깜빡임 점수 계산 (개선된 관대한 기준)

```javascript
// 깜빡임 점수 계산 (EAR 기반, 더 관대한 기준)
let blinkingScore = Math.min(100, avgEAR * 400); // 더 관대한 스케일링

// 적절한 깜빡임 빈도 보너스 (분당 15-25회가 이상적)
if (blinkRatePerMinute >= 15 && blinkRatePerMinute <= 25) {
    blinkingScore = Math.min(100, blinkingScore + 10); // 보너스 10점
} else if (blinkRatePerMinute >= 10 && blinkRatePerMinute <= 30) {
    blinkingScore = Math.min(100, blinkingScore + 5);  // 보너스 5점
}

// 최소 점수 보장 (너무 낮지 않게)
blinkingScore = Math.max(40, blinkingScore);
```

**점수 해석:**
- **높은 EAR (0.2 이상)**: 눈을 크게 뜨고 있음 → 높은 점수
- **낮은 EAR (0.15 이하)**: 눈을 자주 감거나 졸림 → 낮은 점수
- **빈도 보너스**: 이상적인 깜빡임 빈도에 추가 점수
- **최소 보장**: 40점 이상 보장으로 너무 엄격하지 않게

---

## 👀 2. 시선 분석 (Gaze Analysis)

### 📍 사용되는 랜드마크

**눈동자 중심 계산용** (각 눈당 6개):
- **왼쪽 눈**: `[33, 7, 163, 144, 145, 153]`
- **오른쪽 눈**: `[362, 382, 381, 380, 374, 373]`

**총 사용 랜드마크**: 12개 (깜빡임과 동일)

### 🎯 시선 방향 계산

#### 화면 중앙 기준점:
```javascript
const screenCenter = { x: 0.5, y: 0.53 };  // 실제 화면 중앙
```

#### 거리 계산:
```javascript
const leftDistance = Math.sqrt(
    Math.pow(leftEyeCenter.x - screenCenter.x, 2) + 
    Math.pow(leftEyeCenter.y - screenCenter.y, 2)
);
const rightDistance = Math.sqrt(
    Math.pow(rightEyeCenter.x - screenCenter.x, 2) + 
    Math.pow(rightEyeCenter.y - screenCenter.y, 2)
);
const avgDistance = (leftDistance + rightDistance) / 2;
```

### 📊 시선 영역 분류

| 영역 | 거리 범위 | 점수 | 상태 | 변경사항 |
|---|---|---|---|---|
| 중앙 | 0 - 0.04 | 100점 | 완벽한 시선 | 유지 |
| 중앙 근처 | 0.04 - 0.08 | 90점 | 좋은 시선 | 유지 |
| 중간 | 0.08 - 0.18 | 75점 | 보통 시선 | 70점 → 75점 상향 |
| 외곽 | 0.18 이상 | 50점 | 시선 분산 | 30점 → 50점 상향 |

**개선 사항:**
- **안정성 보너스**: 시선 움직임이 적으면 +5점
- **최소 점수 상향**: 외곽에서도 50점 보장

### 🎯 시선 안정성 점수

```javascript
let stabilityScore = 100;
if (avgDistance > bandMidHalf) {        // > 0.18
    stabilityScore = 30;
} else if (avgDistance > bandCenterHalf) { // > 0.08
    stabilityScore = 70;
} else if (avgDistance > bandCenterHalf * 0.5) { // > 0.04
    stabilityScore = 90;
} else {                                // <= 0.04
    stabilityScore = 100;
}
```

---

## 🧠 3. 집중도 분석 (Concentration Analysis)

### 📍 사용되는 랜드마크

1. **시선 관련**: 12개 (위와 동일)
2. **머리 자세**: 2개
   - `landmarks[1]` - 코끝
   - `landmarks[10]` - 이마

**총 사용 랜드마크**: 14개

### 🧮 집중도 계산 공식

```javascript
const concentrationScore = Math.round(
    (gazeScore * 0.5 + blinkScore * 0.3 + headScore * 0.2)
);
```

**구성 요소:**
- **시선 안정성** (50%): 화면 중앙 응시 정도
- **깜빡임 역점수** (30%): `100 - blinkScore` (너무 많이 깜빡이면 집중도 낮음)
- **머리 자세** (20%): 머리가 곧게 세워져 있는 정도

### 📊 머리 자세 점수

```javascript
const headTilt = Math.abs(nose.x - forehead.x) * 200;
const headScore = Math.max(0, 100 - headTilt);
```

**평가 기준:**
- 코와 이마가 수직 정렬: 100점
- 머리가 좌우로 기울어짐: 감점

---

## 📊 종합 점수 체계

### 점수 범위: 0-100점

| 분석 유형 | 최고점 조건 | 감점 요인 |
|---|---|---|
| **깜빡임** | EAR > 0.2, 적절한 깜빡임 빈도 | 졸린 눈, 과도한 깜빡임 |
| **시선** | 화면 중앙 응시 (거리 < 0.04) | 시선 분산, 딴 곳 보기 |
| **집중도** | 안정적 시선 + 적절한 깜빡임 + 곧은 머리 | 불안정한 시선, 머리 기울임 |

## 🔍 상세 분석 데이터

### 깜빡임 분석 출력:
```javascript
{
    score: 85,                    // 깜빡임 점수
    ear: 0.23,                   // Eye Aspect Ratio
    blinkStatus: 'open',         // 현재 눈 상태
    blinkRatePerMinute: 18,      // 분당 깜빡임 횟수
    avgBlinkDuration: 150,       // 평균 깜빡임 지속시간
    totalBlinkCount: 45          // 총 깜빡임 횟수
}
```

### 시선 분석 출력:
```javascript
{
    score: 90,                           // 시선 점수
    gazeDirection: {
        x: 0.5,                         // 시선 X 좌표
        y: 0.53,                        // 시선 Y 좌표  
        distance: 0.06,                 // 중앙으로부터 거리
        status: '중앙'                   // 시선 상태
    },
    eyeCenter: {
        left: { x: 0.42, y: 0.51 },     // 왼쪽 눈동자 중심
        right: { x: 0.58, y: 0.51 }     // 오른쪽 눈동자 중심
    }
}
```

## 🎯 데이팅 최적화

### 좋은 눈 상태 (70점 이상):

1. **자연스러운 깜빡임**:
   - 분당 15-20회 (정상 범위)
   - 지속시간 100-200ms
   - EAR > 0.2

2. **안정적인 시선**:
   - 화면 중앙 응시
   - 거리 < 0.08
   - 상태: '중앙' 또는 '중간'

3. **높은 집중도**:
   - 시선 고정
   - 적절한 깜빡임
   - 머리 곧게 세우기

### 개선이 필요한 상태 (50점 미만):

1. **문제있는 깜빡임**:
   - 너무 자주 깜빡임 (분당 30회 이상)
   - 눈을 자주 감고 있음 (EAR < 0.15)
   - 졸린 상태

2. **불안정한 시선**:
   - 딴 곳을 자주 봄
   - 거리 > 0.18
   - 상태: '외곽'

3. **낮은 집중도**:
   - 시선 분산
   - 과도한 깜빡임
   - 머리 자주 기울임

## 🔬 기술적 세부사항

### EAR (Eye Aspect Ratio) 원리:

**정상 상태 (눈 뜸)**:
- 세로 거리 (A, B) 작음
- 가로 거리 (C) 큼
- **EAR ≈ 0.2-0.3**

**깜빡임 상태 (눈 감김)**:
- 세로 거리 (A, B) 매우 작음
- 가로 거리 (C) 유지
- **EAR ≈ 0.1-0.19**

### 시선 추적 원리:

**눈동자 중심 계산**:
```javascript
// 6개 랜드마크의 평균 좌표
let x = 0, y = 0;
for (const idx of eyeLandmarks) {
    x += landmarks[idx].x;
    y += landmarks[idx].y;
}
return { x: x / eyeLandmarks.length, y: y / eyeLandmarks.length };
```

**거리 기반 점수**:
- 유클리드 거리 계산
- 중앙에서 멀어질수록 감점
- 최소 30점 보장 (완전 실패 방지)

## 📈 실시간 분석 특성

### 깜빡임 통계:
- **1분 슬라이딩 윈도우**: 최근 60초 데이터만 유지
- **유효성 검증**: 50-500ms 지속시간만 인정
- **노이즈 필터링**: 너무 짧거나 긴 깜빡임 제외

### 시선 안정성:
- **실시간 추적**: 매 프레임 계산
- **평활화**: 이동 평균으로 떨림 제거
- **구역 기반**: 거리별 점수 구간

### 집중도 종합:
- **다중 요소**: 시선 + 깜빡임 + 머리자세
- **가중 평균**: 각 요소별 중요도 반영
- **안정성 우선**: 일관성 있는 상태 선호

## 🎨 UI 표시 예시

### 메인 화면:
```
깜빡임: 85점 (좋음)
시선: 90점 (매우 좋음)  
집중도: 82점 (좋음)
```

### 상세 팝업:

#### 깜빡임 상세:
```
👁️ 깜빡임 분석 상세

현재 상태: 좋음
깜빡임 점수: 85%

EAR 값: 0.23456
분당 깜빡임: 18회
평균 지속시간: 150ms
총 깜빡임: 45회

분석 결과:
✅ 자연스러운 깜빡임 빈도
✅ 적절한 눈 개방도
⚠️ 약간 빠른 깜빡임
```

#### 시선 상세:
```
👀 시선 안정성 분석 상세

현재 상태: 중앙
시선 점수: 90%

시선 위치: (0.50, 0.53)
중앙 거리: 0.06234
상태: 중앙

눈동자 위치:
왼쪽: (0.42134, 0.51234)
오른쪽: (0.58234, 0.51456)

분석 결과:
✅ 화면 중앙 응시
✅ 안정적인 시선
✅ 좋은 집중 상태
```

#### 집중도 상세:
```
🧠 집중도 분석 상세

현재 상태: 높음
집중도 점수: 82%

구성 요소:
시선 안정성: 90점 (50%)
깜빡임 역점수: 75점 (30%)
머리 자세: 88점 (20%)

분석 결과:
✅ 화면에 집중하고 있음
✅ 적절한 깜빡임 패턴
✅ 안정적인 머리 자세
```

## 📊 로그 출력 예시

```
📊 [MediaPipe] 깜빡임 점수: 85.0 (EAR: 0.2345, 분당: 18회, 평균지속: 150ms)
📊 [MediaPipe] 시선 데이터: 점수=90.0, 거리=0.062, 상태=중앙
📊 [MediaPipe] 집중도 점수: 82 (시선: 90, 깜빡임: 75, 머리: 88)
```

## 🔧 성능 최적화

### 계산 효율성:
- **경량 계산**: 기본 수학 연산만 사용
- **메모리 효율**: 1분 슬라이딩 윈도우
- **빠른 처리**: ~1ms 이내 완료

### 정확도 향상:
- **다중 포인트**: 각 눈당 6개 랜드마크 사용
- **양안 평균**: 좌우 눈 결과 평균
- **노이즈 제거**: 유효성 검증 적용

## 🎯 데이팅 최적화 가이드

### 완벽한 눈 상태 (90-100점):
1. **자연스러운 깜빡임**: 분당 15-20회
2. **안정적인 시선**: 화면 중앙 응시
3. **높은 집중도**: 상대방에게 집중

### 좋은 눈 상태 (70-89점):
1. **적절한 깜빡임**: 약간 빠르거나 느려도 OK
2. **중앙 근처 시선**: 완전 중앙이 아니어도 OK
3. **양호한 집중도**: 가끔 시선이 움직여도 OK

### 개선 필요 (50점 미만):
1. **문제있는 깜빡임**: 너무 자주 또는 거의 안 함
2. **분산된 시선**: 딴 곳을 자주 봄
3. **낮은 집중도**: 산만하거나 졸린 상태

---

*이 문서는 MediaPipe Face Landmarker 기반 눈 분석 시스템의 완전한 기술 명세서입니다.*
