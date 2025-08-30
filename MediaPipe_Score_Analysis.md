# MediaPipe 분석기 점수 계산 로직 분석

## 개요

MediaPipe 분석기는 실시간 얼굴 랜드마크 데이터를 기반으로 6가지 주요 지표의 점수를 계산합니다:
- **표정 (Expression)**: 미소와 눈썹 위치 기반
- **시선 (Gaze)**: 눈동자 중심점과 화면 중앙 거리 기반
- **집중도 (Concentration)**: 시선, 깜빡임, 머리 기울기 조합
- **자세 (Posture)**: 얼굴 기울기와 수직성 기반
- **깜빡임 (Blinking)**: 눈 개방도 기반
- **주도권 (Initiative)**: 표정, 시선, 자세의 가중 평균

---

## 1. 표정 점수 (Expression Score)

### 계산 방법
```javascript
calculateExpressionScore(landmarks)
```

### 랜드마크 포인트
- **입술**: `landmarks[61]` (왼쪽), `landmarks[291]` (오른쪽), `landmarks[13]` (위), `landmarks[14]` (아래)
- **눈썹**: `landmarks[70]` (왼쪽), `landmarks[300]` (오른쪽)
- **눈**: `landmarks[159]` (왼쪽), `landmarks[386]` (오른쪽)

### 계산 공식
1. **미소 정도 계산**:
   ```javascript
   mouthWidth = Math.abs(mouthRight.x - mouthLeft.x)
   mouthHeight = Math.abs(mouthTop.y - mouthBottom.y)
   smileRatio = mouthWidth / (mouthHeight + 0.001)
   ```

2. **눈썹 거리 계산**:
   ```javascript
   eyebrowDistance = (
       Math.abs(leftEyebrow.y - leftEye.y) + 
       Math.abs(rightEyebrow.y - rightEye.y)
   ) / 2
   ```

3. **정규화**:
   ```javascript
   normalizedSmileRatio = Math.min(1, Math.max(0, (smileRatio - 1) * 2))
   normalizedEyebrowDistance = Math.min(1, Math.max(0, eyebrowDistance * 10))
   ```

4. **최종 점수**:
   ```javascript
   expressionScore = Math.round(
       (normalizedSmileRatio * 60 + normalizedEyebrowDistance * 40)
   )
   ```

### 가중치
- **미소 비율**: 60%
- **눈썹 거리**: 40%

### 점수 범위
- **0-100**: 0이 가장 부정적, 100이 가장 긍정적

---

## 2. 시선 점수 (Gaze Score)

### 계산 방법
```javascript
calculateGazeScore(landmarks)
```

### 랜드마크 포인트
- **왼쪽 눈**: `[33, 7, 163, 144, 145, 153]`
- **오른쪽 눈**: `[362, 382, 381, 380, 374, 373]`

### 계산 공식
1. **눈동자 중심점 계산**:
   ```javascript
   leftEyeCenter = getEyeCenter(landmarks, 'left')
   rightEyeCenter = getEyeCenter(landmarks, 'right')
   ```

2. **화면 중앙 거리 계산**:
   ```javascript
   targetX = 0.5, targetY = 0.5  // 화면 중앙
   leftDistance = Math.sqrt(
       Math.pow(leftEyeCenter.x - targetX, 2) + 
       Math.pow(leftEyeCenter.y - targetY, 2)
   )
   rightDistance = Math.sqrt(
       Math.pow(rightEyeCenter.x - targetX, 2) + 
       Math.pow(rightEyeCenter.y - targetY, 2)
   )
   avgDistance = (leftDistance + rightDistance) / 2
   ```

3. **최종 점수**:
   ```javascript
   gazeScore = Math.max(0, 100 - (avgDistance * 200))
   ```

### 점수 해석
- **거리가 0에 가까울수록** (화면 중앙을 바라볼수록) **높은 점수**
- **거리가 멀수록** (화면 가장자리를 바라볼수록) **낮은 점수**

---

## 3. 집중도 점수 (Concentration Score)

### 계산 방법
```javascript
calculateConcentrationScore(landmarks)
```

### 구성 요소
1. **시선 안정성** (50%)
2. **깜빡임 점수** (30%) - 역산: `100 - blinkingScore`
3. **머리 기울기** (20%)

### 계산 공식
1. **시선 점수**: `gazeScore = calculateGazeScore(landmarks)`

2. **깜빡임 점수**: `blinkScore = 100 - calculateBlinkingScore(landmarks)`

3. **머리 기울기**:
   ```javascript
   nose = landmarks[1]        // 코끝
   forehead = landmarks[10]   // 이마
   headTilt = Math.abs(nose.x - forehead.x) * 200
   headScore = Math.max(0, 100 - headTilt)
   ```

4. **최종 점수**:
   ```javascript
   concentrationScore = Math.round(
       (gazeScore * 0.5 + blinkScore * 0.3 + headScore * 0.2)
   )
   ```

### 가중치
- **시선 안정성**: 50%
- **깜빡임 안정성**: 30%
- **머리 기울기**: 20%

---

## 4. 깜빡임 점수 (Blinking Score)

### 계산 방법
```javascript
calculateBlinkingScore(landmarks)
```

### 랜드마크 포인트
- **왼쪽 눈**: `landmarks[159]` (위), `landmarks[145]` (아래)
- **오른쪽 눈**: `landmarks[386]` (위), `landmarks[374]` (아래)

### 계산 공식
1. **눈 개방도 계산**:
   ```javascript
   leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y)
   rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y)
   avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2
   ```

2. **최종 점수**:
   ```javascript
   blinkingScore = Math.min(100, avgEyeOpen * 2000)
   ```

### 점수 해석
- **눈이 많이 열려있을수록** (개방도가 클수록) **높은 점수**
- **눈이 감겨있을수록** (개방도가 작을수록) **낮은 점수**

---

## 5. 자세 점수 (Posture Score)

### 계산 방법
```javascript
calculatePostureScore(landmarks)
```

### 랜드마크 포인트
- **귀**: `landmarks[234]` (왼쪽), `landmarks[454]` (오른쪽)
- **코와 이마**: `landmarks[1]` (코끝), `landmarks[10]` (이마)

### 계산 공식
1. **얼굴 기울기**:
   ```javascript
   faceTilt = Math.abs(leftEar.y - rightEar.y)
   ```

2. **수직성**:
   ```javascript
   faceVertical = Math.abs(nose.x - forehead.x)
   ```

3. **최종 점수**:
   ```javascript
   postureScore = Math.max(0, 100 - (faceTilt + faceVertical) * 200)
   ```

### 점수 해석
- **기울기가 적을수록** (얼굴이 수직에 가까울수록) **높은 점수**
- **기울기가 클수록** (얼굴이 기울어질수록) **낮은 점수**

---

## 6. 주도권 점수 (Initiative Score)

### 계산 방법
```javascript
calculateInitiativeScore(landmarks)
```

### 구성 요소
1. **표정 점수** (40%)
2. **시선 점수** (40%)
3. **자세 점수** (20%)

### 계산 공식
```javascript
initiativeScore = Math.round(
    expressionScore * 0.4 + gazeScore * 0.4 + postureScore * 0.2
)
```

### 가중치
- **표정**: 40%
- **시선**: 40%
- **자세**: 20%

---

## 7. 음성 톤 점수 (Tone Score)

### 참고사항
음성 톤 점수는 MediaPipe가 아닌 **백엔드 음성 분석 시스템**에서 계산됩니다.

### 계산 위치
- **파일**: `src/backend/services/voice/voice_analyzer.py`
- **클래스**: `VoiceAnalyzer.analyze_voice_tone()`

### 분석 요소
1. **따뜻함 (Warmth)**: 음성의 따뜻한 톤
2. **열정 (Enthusiasm)**: 음성의 활기찬 정도
3. **공손함 (Politeness)**: 예의 바른 톤
4. **일관성 (Consistency)**: 음량의 일정성
5. **자신감 (Confidence)**: 확신에 찬 톤
6. **음량 강도 (Volume Strength)**: 적절한 음량

### 점수 계산
```python
voice_tone_score = (
    warmth_score * 0.2 +
    enthusiasm_level * 0.2 +
    politeness_level * 0.2 +
    volume_consistency * 0.15 +
    confidence_level * 0.15 +
    volume_strength * 0.1
) * 100
```

---

## 8. 점수 업데이트 주기

### 분석 주기
- **기본 주기**: 200ms (`setTimeout(..., 200)`)
- **점수별 차등 업데이트**: 각 지표마다 다른 주기로 업데이트

### 업데이트 타이머
```javascript
this.updateTimers = {
    expression: 0,
    concentration: 0,
    gaze: 0,
    blinking: 0,
    posture: 0,
    initiative: 0
};
```

---

## 9. 점수 정규화 및 스케일링

### 정규화 방법
1. **Min-Max 정규화**: `Math.min(1, Math.max(0, value))`
2. **스케일링**: `value * multiplier`
3. **반전**: `100 - value` (낮을수록 좋은 경우)

### 스케일링 팩터
- **깜빡임**: `* 2000`
- **시선 거리**: `* 200`
- **자세 기울기**: `* 200`

---

## 10. 오류 처리

### 기본값
- **랜드마크 부족**: `landmarks.length < 468` → `return 0`
- **계산 실패**: `try-catch` → `return 0`
- **눈동자 계산 실패**: `return { x: 0.5, y: 0.5 }`

### 로깅
- **성공**: `📊 [MediaPipe] 점수 계산 결과`
- **실패**: `❌ 점수 계산 실패`

---

## 11. 성능 최적화

### 최적화 기법
1. **차등 업데이트**: 모든 점수를 매번 계산하지 않음
2. **캐싱**: 이전 계산 결과 재사용
3. **조건부 계산**: 필요한 경우에만 계산

### 메모리 관리
- **랜드마크 배열**: 468개 포인트
- **점수 저장**: `currentMediaPipeScores` 객체
- **타이머 관리**: `updateTimers` 객체

---

## 12. 점수 해석 가이드

### 점수 범위별 의미
- **90-100**: 매우 우수
- **80-89**: 우수
- **70-79**: 양호
- **60-69**: 보통
- **50-59**: 개선 필요
- **0-49**: 매우 개선 필요

### 실시간 피드백
- **긍정적 피드백**: 높은 점수 시 녹색 표시
- **중립적 피드백**: 중간 점수 시 노란색 표시
- **부정적 피드백**: 낮은 점수 시 빨간색 표시

---

## 결론

MediaPipe 분석기는 468개의 얼굴 랜드마크를 기반으로 6가지 주요 지표의 점수를 실시간으로 계산합니다. 각 지표는 서로 다른 랜드마크 조합과 계산 공식을 사용하며, 가중치를 통해 종합적인 대화 품질을 평가합니다. 음성 톤은 별도의 백엔드 시스템에서 분석되어 전체 점수에 반영됩니다.
