# 기본 캘리브레이션 모듈 사용법

## 📁 파일 위치
`src/frontend/assets/js/default-calibration.js`

## 🎯 목적
대부분의 사람이 사용하는 기본 캘리브레이션 값들을 중앙에서 관리하여, 필요시 이 파일만 수정하면 전체 시스템에 적용되도록 합니다.

## 🔧 주요 기능

### 1. 기본 캘리브레이션 데이터
```javascript
const DEFAULT_CALIBRATION = {
    // 시선 관련
    center_h: 0.5,                    // 화면 중앙 수평 위치
    center_v: 0.53,                   // 화면 중앙 수직 위치
    center_ear: 0.22,                 // EAR 기준값
    
    // 시선 안정성
    band_center_half: 0.08,           // 중앙 밴드 반값
    band_mid_half: 0.18,              // 중간 밴드 반값
    
    // 깜빡임 임계값
    blink_ear_threshold: 0.19,        // 깜빡임 EAR 임계값
    blink_closed_threshold: 0.22,     // 눈 감음 임계값
    
    // 시선 이동
    saccade_threshold: 0.045,         // 사카드 임계값
    focus_drift_seconds: 2.0,         // 집중 이탈 시간
    
    // 자세 관련
    neck_length_baseline: 0.18,       // 목 길이 기준
    neck_angle_baseline: 12.0,        // 목 각도 기준
    chin_forward_baseline: 0.02,      // 턱 앞으로 내밀기
    neck_tilt_baseline: 0.005,        // 목 기울기
    
    // 어깨 및 몸통
    shoulder_width_baseline: 0.28,    // 어깨 너비 기준
    torso_height_baseline: 0.38,      // 몸통 높이 기준
    back_curve_baseline: 8.0,         // 등 굽힘 기준
    shoulder_blade_position: 4.0,     // 어깨뼈 위치 기준
};
```

### 2. 사용 가능한 함수들

#### `getDefaultCalibration()`
전체 기본 캘리브레이션 데이터를 가져옵니다.
```javascript
const defaultCalibration = window.DefaultCalibration.getDefaultCalibration();
```

#### `getDefaultValue(field, fallback)`
특정 필드의 기본값을 가져옵니다.
```javascript
const centerH = window.DefaultCalibration.getDefaultValue('center_h', 0.5);
const blinkThreshold = window.DefaultCalibration.getDefaultValue('blink_ear_threshold', 0.19);
```

#### `logDefaultCalibration()`
기본 캘리브레이션 정보를 콘솔에 출력합니다.
```javascript
window.DefaultCalibration.logDefaultCalibration();
```

## 📝 수정 방법

### 1. 시선 관련 값 수정
```javascript
// 시선 중앙 위치 조정
center_h: 0.5,    // 수평 위치 (0.0 ~ 1.0)
center_v: 0.53,   // 수직 위치 (0.0 ~ 1.0)

// 시선 안정성 밴드 조정
band_center_half: 0.08,  // 중앙 밴드 (더 작으면 더 엄격)
band_mid_half: 0.18,     // 중간 밴드 (더 작으면 더 엄격)
```

### 2. 깜빡임 임계값 수정
```javascript
// 깜빡임 감지 민감도 조정
blink_ear_threshold: 0.19,     // 깜빡임 감지 (더 작으면 더 민감)
blink_closed_threshold: 0.22,  // 눈 감음 감지 (더 작으면 더 민감)
```

### 3. 자세 기준값 수정
```javascript
// 목 자세 기준
neck_angle_baseline: 12.0,        // 목 각도 기준 (도)
chin_forward_baseline: 0.02,      // 턱 앞으로 내밀기 허용치

// 어깨 자세 기준
shoulder_width_baseline: 0.28,    // 어깨 너비 기준
back_curve_baseline: 8.0,         // 등 굽힘 허용치 (도)
```

### 4. 메타데이터 수정
```javascript
// 품질 점수
quality_score: 0.85,

// 설명 업데이트
description: "수정된 기본 캘리브레이션 설정",

// 버전 관리
version: 3,
last_updated: "2024-12-23"
```

## 🔄 적용 방법

1. **파일 수정**: `default-calibration.js`에서 원하는 값들을 수정
2. **브라우저 새로고침**: 변경사항이 즉시 적용됨
3. **콘솔 확인**: `window.DefaultCalibration.logDefaultCalibration()` 실행하여 변경사항 확인

## ⚠️ 주의사항

- **값 범위**: 모든 값은 적절한 범위 내에서 설정해야 합니다
- **테스트**: 수정 후 실제 사용자에게 테스트하여 적절성 확인
- **버전 관리**: 수정 시 `version`과 `last_updated` 필드를 업데이트
- **백업**: 중요한 수정 전에 기존 설정을 백업

## 📊 권장 사용자 그룹

현재 설정은 다음 사용자 그룹에 최적화되어 있습니다:
- 일반적인 성인
- 평균 키 160-180cm
- 정상 시력
- 일반적인 자세 패턴

다른 사용자 그룹을 위해 수정이 필요한 경우, `statistics.recommended_for` 배열을 업데이트하세요.
