# Voice Analysis Module

3개 파일(`voice_input.py`, `simple_mic_test.py`, `infer_emotion.py`)의 로직을 종합하여 STT와 연동되는 통합 음성 분석 시스템입니다.

## 📁 구조

```
voice/
├── __init__.py              # 모듈 초기화
├── voice_analyzer.py        # 음성 분석 핵심 클래스
├── voice_scorer.py          # 점수 계산 클래스
├── voice_processor.py       # 통합 처리 클래스
├── voice_api.py            # STT 연동 API 인터페이스
├── test_voice_system.py    # 테스트 애플리케이션
└── README.md               # 이 파일
```

## 🎯 주요 기능

### 1. 음성 인식 (STT)
- **Whisper 모델** 기반 한국어 음성 인식
- GPU/CPU 자동 감지 및 최적화
- 오디오 품질 검사 및 전처리

### 2. 음성 톤 분석
- **피치 변화량**: 표현력 풍부함 측정
- **볼륨 일관성**: 안정적인 목소리 측정
- **따뜻함 점수**: 저주파 에너지 기반
- **열정 수준**: 에너지 변화량 기반
- **공손함 수준**: 볼륨 일관성과 피치 변화량 기반
- **자신감 수준**: 여러 요소 종합

### 3. 단어 선택 분석
- **긍정/부정 단어** 사전 기반 분석
- **공손한 표현** 감지
- **공감 표현** 감지
- **열정 표현** 감지
- **맥락/시간/음성톤** 반영한 정서 점수

### 4. 감정 분석
- **키워드 기반** 감정 분석 (우선)
- **음성 기반** 감정 분석 (백업)
- 한국어 감정 레이블 지원

### 5. 종합 점수 계산
- **음성 톤**: 40% 가중치
- **단어 선택**: 40% 가중치
- **감정**: 20% 가중치
- 맥락을 고려한 동적 점수 조정

## 🚀 사용법

### 기본 사용법

```python
from voice.voice_api import process_audio_simple
import numpy as np

# 오디오 데이터 준비 (numpy array)
audio_array = np.array([...])  # 16kHz 샘플링 레이트

# 음성 분석 실행
result = process_audio_simple(audio_array, sr=16000, elapsed_sec=30.0)

# 결과 확인
print(f"전사: {result['transcript']}")
print(f"감정: {result['emotion']}")
print(f"총점: {result['total_score']:.1f}/100")
print(f"음성 톤 점수: {result['voice_tone_score']:.1f}/100")
print(f"단어 선택 점수: {result['word_choice_score']:.1f}/100")
```

### 고급 사용법

```python
from voice.voice_processor import VoiceProcessor
from voice.voice_scorer import ScoringWeights

# 커스텀 가중치 설정
weights = ScoringWeights(
    voice_tone=0.5,    # 음성 톤 50%
    word_choice=0.3,   # 단어 선택 30%
    emotion=0.2        # 감정 20%
)

# VoiceProcessor 초기화
processor = VoiceProcessor(weights=weights)
processor.load_models()

# 음성 분석 실행
result = processor.process_audio(audio_array, sr=16000, elapsed_sec=60.0)

# 상세 분석 결과
detailed = processor.get_detailed_analysis(result)
print(f"분석 근거: {detailed['evidence']}")
print(f"개선 제안: {detailed['recommendations']}")
```

### 테스트 실행

```bash
cd src/dys_studio/voice
python test_voice_system.py
```

## 🔧 설정

### GPU 설정 자동 감지
- **RTX 4080 20GB**: `large-v3` 모델, `float16` 연산
- **1660 Super 6GB**: `small` 모델, `int8` 연산
- **CPU**: `small` 모델, `int8` 연산

### 모델 상태 확인

```python
from voice.voice_api import get_voice_model_status

status = get_voice_model_status()
print(f"ASR 모델: {status['asr_model']}")
print(f"음성 감정 분석: {status['audio_classifier']}")
print(f"전체 로드: {status['models_loaded']}")
```

## 📊 분석 결과

### 기본 결과
```python
{
    'transcript': '안녕하세요, 반갑습니다',
    'emotion': '기쁨',
    'emotion_score': 0.85,
    'total_score': 78.5,
    'voice_tone_score': 82.3,
    'word_choice_score': 75.2,
    'voice_details': {
        'warmth': 0.75,
        'politeness': 0.82,
        'consistency': 0.68,
        'enthusiasm': 0.71,
        'confidence': 0.79,
        'volume_strength': 0.73
    },
    'word_details': {
        'politeness': 0.85,
        'empathy': 0.72,
        'enthusiasm': 0.68,
        'valence': 0.78
    },
    'positive_words': ['안녕', '반갑'],
    'negative_words': [],
    'weights': {'voice': 0.4, 'word': 0.4, 'emotion': 0.2}
}
```

### 상세 분석 결과
```python
{
    'summary': {...},  # 기본 요약
    'voice_details': {...},  # 음성 톤 상세
    'word_details': {...},  # 단어 선택 상세
    'evidence': {  # 분석 근거
        '음성 톤': '따뜻함(0.75), 공손함(0.82), 일관성(0.68), 자신감(0.79)',
        '단어 선택': '공손함(0.85), 공감(0.72), 열정(0.68)',
        '긍정적 단어': '안녕, 반갑',
        '부정적 단어': '없음'
    },
    'recommendations': [  # 개선 제안
        '목소리를 더 따뜻하게 내보세요',
        '더 공손한 표현을 사용해보세요'
    ]
}
```

## 🔄 기존 코드와의 호환성

### voice_input.py 대체
```python
# 기존
from voice_input import process_audio_simple

# 새로운 방식
from voice.voice_api import process_audio_simple
```

### simple_mic_test.py 대체
```python
# 기존
python simple_mic_test.py

# 새로운 방식
python voice/test_voice_system.py
```

## 🛠️ 의존성

### 필수 패키지
- `numpy`
- `torch`
- `torchaudio`
- `faster-whisper`
- `sounddevice` (테스트용)

### 선택적 패키지
- `transformers` (음성 감정 분석용)
- `scipy` (오디오 전처리용)

## 📝 로그

모든 분석 과정은 `voice_analysis.log` 파일에 기록됩니다:
- 모델 로딩 상태
- 오디오 품질 검사 결과
- 분석 과정 및 오류
- 처리 시간 및 성능 정보

## 🎯 특징

1. **모듈화**: 각 기능이 독립적인 클래스로 분리
2. **확장성**: 새로운 분석 요소 쉽게 추가 가능
3. **안정성**: 오류 처리 및 폴백 메커니즘
4. **성능**: GPU 자동 감지 및 최적화
5. **호환성**: 기존 코드와 완전 호환
6. **맥락 인식**: 대화 경과 시간 반영
7. **실시간**: STT와 연동하여 실시간 분석 가능
