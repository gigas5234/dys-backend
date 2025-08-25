# 페르소나 관리 시스템

이서아.py 파일을 분석해서 JSON 기반의 페르소나 관리 시스템을 구축했습니다.

## 📁 파일 구조

```
personas/
├── persona_manager.py      # 페르소나 관리자 클래스
├── personas_config.json    # 페르소나 설정 파일
├── 이서아.json            # 이서아 페르소나 데이터
├── 김연진.json            # 김연진 페르소나 데이터
├── 박민수.json            # 박민수 페르소나 템플릿
└── README.md              # 이 파일
```

## 🎭 사용 가능한 페르소나

### 1. 이서아 (이서아.json)
- **설명**: 밝고 친근한 스타트업 마케팅 담당자
- **성격**: ENFP (외향적, 직관적, 감정적, 인식적)
- **직업**: 스타트업 마케팅 담당
- **나이**: 28세 (1997년생)
- **특징**: 활발하고 호기심 많으며 따뜻하고 배려심이 깊음

### 2. 김연진 (김연진.json)
- **설명**: 차분하고 지적인 대학원생
- **성격**: INTJ (내향적, 직관적, 사고적, 판단적)
- **직업**: 대학원생 (심리학 전공)
- **나이**: 30세 (1995년생)
- **특징**: 차분하고 분석적이며 독립적

### 3. 박민수 (박민수.json)
- **설명**: 활발하고 운동을 좋아하는 직장인
- **성격**: 템플릿 (수정 필요)
- **직업**: 템플릿 (수정 필요)
- **나이**: 30세 (1995년생)
- **특징**: 템플릿 (수정 필요)

## 🛠️ 사용법

### 1. 페르소나 관리자 초기화
```python
from personas.persona_manager import PersonaManager

manager = PersonaManager()
```

### 2. 사용 가능한 페르소나 목록 확인
```python
personas = manager.list_personas()
for persona in personas:
    print(f"- {persona['name']} ({persona['id']}): {persona['description']}")
```

### 3. 활성 페르소나 설정
```python
# 이서아로 설정
manager.set_active_persona("이서아")

# 김연진으로 설정
manager.set_active_persona("김연진")
```

### 4. 현재 활성 페르소나 정보 가져오기
```python
active_persona = manager.get_active_persona()
if active_persona:
    print(f"이름: {active_persona['name']}")
    print(f"직업: {active_persona['basic_info']['job']}")
    print(f"성격: {active_persona['basic_info']['personality']}")
```

### 5. 새 페르소나 템플릿 생성
```python
manager.create_persona_template(
    persona_id="새페르소나",
    name="새페르소나",
    description="새로운 페르소나 설명"
)
```

## 📋 페르소나 JSON 구조

각 페르소나 JSON 파일은 다음과 같은 구조를 가집니다:

```json
{
  "id": "페르소나ID",
  "name": "페르소나이름",
  "description": "페르소나설명",
  "version": "1.0",
  "created_at": "생성일시",
  
  "basic_info": {
    "birth_year": 1997,
    "birth_month": 9,
    "birth_day": 15,
    "location": "거주지",
    "job": "직업",
    "personality": "MBTI",
    "age": 28
  },
  
  "personality_traits": ["성격특성1", "성격특성2"],
  "hobbies": ["취미1", "취미2"],
  "favorite_places": ["좋아하는곳1", "좋아하는곳2"],
  
  "cultural_preferences": {
    "music": ["음악취향"],
    "movies": ["영화취향"],
    "netflix": ["넷플릭스취향"]
  },
  
  "food_preferences": "음식선호도",
  "health_notes": "건강관련메모",
  "relationship_values": ["관계가치관"],
  "dislikes": ["싫어하는것"],
  
  "conversation_rules": {
    "hard_rules": ["하드룰"],
    "tone_rules": {
      "0": {"style": "경계", "speech": "존댓말", "emotion": "긴장"},
      "1": {"style": "조금 부드러움", "speech": "존댓말", "emotion": "호기심"},
      "2": {"style": "편안함", "speech": "존댓말/반말 혼용", "emotion": "편안함"},
      "3": {"style": "친밀함", "speech": "반말", "emotion": "따뜻함"}
    },
    "dialogue_principles": ["대화원칙"],
    "prohibitions": ["금지사항"],
    "meta_question_avoidance": {
      "trigger_questions": ["트리거질문"],
      "response": "회피응답"
    }
  },
  
  "emotion_keywords": {
    "positive": ["긍정키워드"],
    "negative": ["부정키워드"]
  },
  
  "intimacy_settings": {
    "score_thresholds": {
      "level_0": -1,
      "level_1": 1,
      "level_2": 3,
      "level_3": 999
    },
    "positive_score_increment": 0.6,
    "negative_score_increment": -0.8,
    "turn_bonus": 0.3,
    "turn_bonus_interval": 3,
    "formal_turns": 2
  },
  
  "conversation_context": {
    "location": "대화장소",
    "time": "대화시간",
    "situation": "대화상황",
    "max_history_turns": 5
  },
  
  "tts_settings": {
    "default_voice": "ko-KR-SunHiNeural",
    "voice_description": "목소리설명",
    "speaking_indicator": "🎤 {name}가 말하고 있어요..."
  }
}
```

## 🔄 서버 연동 방법

서버에서 페르소나를 사용하려면:

1. `server.py`의 `load_persona_context` 함수를 수정하여 JSON 파일을 로드하도록 변경
2. `PersonaManager`를 사용하여 활성 페르소나 정보를 가져오기
3. 페르소나별 프롬프트 템플릿 적용

## ✨ 장점

1. **관리 편의성**: JSON 파일로 페르소나 정보를 쉽게 수정 가능
2. **확장성**: 새로운 페르소나를 템플릿으로 빠르게 생성 가능
3. **일관성**: 모든 페르소나가 동일한 구조를 가져 관리 용이
4. **유연성**: 페르소나별로 다른 대화 규칙과 설정 적용 가능

## 🚀 다음 단계

1. 서버에 페르소나 관리자 연동
2. 프론트엔드에서 페르소나 선택 UI 구현
3. 페르소나별 TTS 목소리 설정
4. 페르소나별 대화 스타일 커스터마이징
