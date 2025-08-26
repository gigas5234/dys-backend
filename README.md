# 데연소 Backend

<div align="center">

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-yellow.svg)
![PyTorch](https://img.shields.io/badge/PyTorch-2.1.1-orange.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**데연소 AI 기반 실시간 대화, 음성 분석, 표정 인식**

[설치 가이드](#-설치-및-실행) • [API 문서](#-api-문서) • [페르소나 시스템](#-페르소나-시스템) • [AI 기능](#-ai-기능)

</div>

---

## 📋 목차

- [🎯 프로젝트 개요](#-프로젝트-개요)
- [✨ 주요 기능](#-주요-기능)
- [📁 프로젝트 구조](#-프로젝트-구조)
- [🚀 설치 및 실행](#-설치-및-실행)
- [🔧 환경 설정](#-환경-설정)
- [📖 API 문서](#-api-문서)
- [🎭 페르소나 시스템](#-페르소나-시스템)
- [🤖 AI 기능](#-ai-기능)
- [💾 데이터베이스](#-데이터베이스)
- [🔐 인증 시스템](#-인증-시스템)
- [📊 피드백 시스템](#-피드백-시스템)
- [🛠️ 개발 가이드](#️-개발-가이드)

---

## 프로젝트 개요

데연소 Backend는 AI 기반의 실시간 대화형 페르소나 시스템입니다. 사용자는 다양한 페르소나와 자연스러운 대화를 나누며, 음성 분석, 표정 인식, 감정 분석 등 다양한 AI 기능을 통해 더욱 몰입감 있는 대화 경험을 제공합니다.

### 핵심 특징
- **AI 기반 대화**: OpenAI GPT 모델을 활용한 자연스러운 대화
- **다양한 페르소나**: 개성 있는 캐릭터들과의 맞춤형 대화
- **음성 분석**: 실시간 음성 톤, 감정, 공감도 분석
- **표정 인식**: MediaPipe와 PyTorch ViT 모델을 통한 실시간 표정 분석
- **TTS (Text-to-Speech)**: Edge-TTS를 활용한 자연스러운 음성 합성
- **실시간 통신**: WebSocket을 통한 실시간 데이터 전송
- **피드백 시스템**: 대화 품질 및 사용자 만족도 분석

---

## ✨ 주요 기능

### 페르소나 시스템
- **다양한 캐릭터**: 이서아 등 개성 있는 페르소나
- **동적 대화 스타일**: 친밀도에 따른 말투 변화 (존댓말 → 반말)
- **맞춤형 응답**: 페르소나별 성격, 취미, 선호도 반영
- **JSON 기반 관리**: 쉬운 페르소나 생성 및 수정

### 음성 분석
- **실시간 음성 처리**: Faster-Whisper를 통한 정확한 음성 인식
- **감정 분석**: 음성 톤과 내용을 통한 종합적인 감정 분석
- **공감도 측정**: 대화 품질 및 상호작용 점수 계산
- **다국어 지원**: 한국어 특화 음성 분석

### 표정 인식
- **실시간 분석**: MediaPipe와 PyTorch ViT 모델 통합
- **8가지 감정**: 기쁨, 슬픔, 분노, 놀람, 두려움, 혐오, 중립, 경멸
- **GPU 가속**: CUDA 지원으로 빠른 처리 속도
- **웹 기반 인터페이스**: 브라우저에서 실시간 표정 분석

### 실시간 통신
- **WebSocket 서버**: 랜드마크 데이터 및 실시간 메시지 전송
- **양방향 통신**: 클라이언트-서버 간 실시간 데이터 교환
- **연결 관리**: 자동 재연결 및 연결 상태 모니터링

### 데이터 관리
- **MongoDB 연동**: 비동기 데이터베이스 처리
- **세션 관리**: 대화 세션 및 메시지 히스토리 저장
- **사용자 인증**: Supabase 기반 JWT 토큰 인증
- **피드백 저장**: 사용자 만족도 및 분석 결과 저장

---

### 기술 스택
- **Backend**: FastAPI, Uvicorn, Starlette
- **Database**: MongoDB (Motor 비동기 드라이버)
- **AI/ML**: PyTorch, Transformers, Faster-Whisper, Edge-TTS
- **Authentication**: Supabase, JWT
- **Real-time**: WebSocket, asyncio
- **Audio Processing**: Librosa, NumPy
- **Computer Vision**: MediaPipe, OpenCV, PIL

---

## 프로젝트 구조

```
vision-backend/
├── 📄 main.py                 # 애플리케이션 진입점
├── 📄 server.py               # 메인 FastAPI 서버
├── 📄 websocket_server.py     # WebSocket 서버
├── 📄 database.py             # MongoDB 데이터베이스 관리
├── 📄 auth.py                 # 인증 및 권한 관리
├── 📄 start_server.py         # 서버 자동 시작 스크립트
├── 📄 start.sh                # 배시 스크립트
├── 📄 requirements.txt        # Python 의존성
├── 📄 INSTALL.md              # 설치 가이드
├── 📄 README.md               # 이 파일
│
├── 📁 personas/               # 페르소나 관리 시스템
│   ├── 📄 persona_manager.py  # 페르소나 관리자
│   ├── 📄 personas_config.json# 페르소나 설정
│   ├── 📄 이서아.json          # 이서아 페르소나
│   └── 📄 README.md           # 페르소나 시스템 문서
│
├── 📁 dys_studio/             # AI 분석 모듈
│   ├── 📄 voice_input.py      # 음성 분석 및 처리
│   ├── 📄 expression_analyzer.py # 표정 분석

│   ├── 📄 studio_calibration.html # 웹 인터페이스
│   ├── 📁 models/             # AI 모델 파일
│   ├── 📁 js/                 # JavaScript 파일
│   ├── 📁 styles/             # CSS 스타일
│   ├── 📁 video/              # 비디오 파일
│   └── 📁 img/                # 이미지 파일
│
├── 📁 feedback/               # 피드백 데이터
│   └── 📄 session_*.json      # 세션별 피드백 파일

```

---

## 🚀 설치 및 실행

### 시스템 요구사항
- **Python**: 3.8 이상
- **MongoDB**: 4.4 이상
- **RAM**: 최소 8GB (AI 모델 로딩용)
- **GPU**: 권장 (CUDA 지원, 음성/표정 분석 성능 향상)
- **OS**: Linux, macOS, Windows


## 🔧 환경 설정

### 필수 환경변수

`.env` 파일에 다음 변수들을 설정하세요:

```env
# 애플리케이션 설정
APP_NAME=vision-backend
PORT=8000
ALLOWED_ORIGINS=*

# OpenAI API (필수)
OPENAI_API_KEY=your_openai_api_key_here

# MongoDB 설정
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=dys-chatbot

# Supabase 인증 (선택사항)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET_KEY=your_jwt_secret_key

# 네트워크 설정
WEBSOCKET_HOST=your_websocket_server_ip  # WebSocket 서버 IP (기본값: 자동 감지)
WEBSOCKET_PORT=8001                      # WebSocket 서버 포트
CORS_ORIGINS=*,https://yourdomain.com    # CORS 허용 도메인 (쉼표로 구분)

# 파일 업로드 설정
MAX_UPLOAD_BYTES=33554432

# RunPod 설정 (선택사항)
RUNPOD_URL=https://runpod.io
```

### AI 모델 다운로드

음성 및 표정 분석 기능을 사용하려면 AI 모델을 미리 다운로드해야 합니다:

```bash
# 음성 분석 모델 다운로드
python -c "
from dys_studio.voice_input import preload_models
preload_models()
"

# 표정 분석 모델 확인 (expression_analyzer.py에서 자동 처리됨)
```

---

## 📖 API 문서

### 주요 엔드포인트

#### 채팅 관련
- `POST /chat` - 새로운 채팅 메시지 전송
- `GET /chat/sessions` - 사용자 채팅 세션 목록
- `GET /chat/sessions/{session_id}` - 특정 세션 정보
- `GET /chat/sessions/{session_id}/messages` - 세션 메시지 히스토리
- `POST /chat/sessions` - 새 채팅 세션 생성

#### 페르소나 관련
- `GET /personas` - 사용 가능한 페르소나 목록
- `GET /personas/{persona_id}` - 특정 페르소나 정보
- `POST /personas/{persona_id}/activate` - 페르소나 활성화

#### 음성 관련
- `POST /voice/analyze` - 음성 파일 분석
- `POST /voice/tts` - 텍스트를 음성으로 변환
- `GET /voice/voices` - 사용 가능한 TTS 목소리 목록

#### 파일 업로드
- `POST /upload/audio` - 오디오 파일 업로드
- `POST /upload/image` - 이미지 파일 업로드

#### WebSocket
- `WS /ws/landmarks` - 실시간 랜드마크 데이터 전송

### API 사용 예시

```python
import requests

# 채팅 메시지 전송
response = requests.post("http://localhost:8000/chat", json={
    "content": "안녕하세요!",
    "role": "user",
    "user_id": "user123"
})

# 페르소나 목록 조회
personas = requests.get("http://localhost:8000/personas").json()

# 음성 분석
with open("audio.wav", "rb") as f:
    response = requests.post("http://localhost:8000/voice/analyze", files={"file": f})
```

---

## 페르소나 시스템

### 사용 가능한 페르소나

#### 1. 이서아 (이서아.json)
- **MBTI**: ENFP
- **나이**: 28세 (1997년생)
- **직업**: 스타트업 마케팅 담당
- **성격**: 활발하고 호기심 많으며 따뜻하고 배려심이 깊음
- **특징**: 밝고 친근한 성격, 창의적이고 열정적


### 페르소나 관리

```python
from personas.persona_manager import PersonaManager

# 페르소나 관리자 초기화
manager = PersonaManager()

# 사용 가능한 페르소나 목록
personas = manager.list_personas()

# 활성 페르소나 설정
manager.set_active_persona("이서아")

# 현재 활성 페르소나 정보
active_persona = manager.get_active_persona()

# 새 페르소나 생성
manager.create_persona_template(
    persona_id="새페르소나",
    name="새페르소나",
    description="새로운 페르소나 설명"
)
```

### 대화 시스템

- **친밀도 기반 말투**: 대화 횟수에 따라 존댓말 → 반말로 변화
- **감정 반영**: 페르소나별 성격에 맞는 감정 표현
- **맥락 유지**: 이전 대화 내용을 기억하여 연속성 있는 대화
- **메타 질문 회피**: AI 관련 질문에 대한 자연스러운 회피

---

## AI 기능

### 음성 분석 (Voice Analysis)

#### 주요 기능
- **음성 인식**: Faster-Whisper를 통한 정확한 한국어 음성 인식
- **감정 분석**: 음성 톤과 내용을 통한 종합적인 감정 분석
- **공감도 측정**: 대화 품질 및 상호작용 점수 계산
- **실시간 처리**: WebSocket을 통한 실시간 음성 분석

#### 분석 항목
- **음성 톤**: 피치 변화, 말하기 속도, 볼륨 일관성
- **감정 상태**: 기쁨, 슬픔, 분노, 중립 등 8가지 감정
- **공감 지수**: 따뜻함, 열정, 정중함, 자신감 수준
- **단어 선택**: 긍정/부정 단어, 공감 표현, 정중한 표현

#### 사용 예시
```python
from dys_studio.voice_input import analyze_voice_file

# 음성 파일 분석
result = analyze_voice_file("audio.wav")
print(f"총점: {result.total_score}")
print(f"음성 톤 점수: {result.voice_tone_score}")
print(f"단어 선택 점수: {result.word_choice_score}")
```

### 표정 분석 (Expression Analysis)

#### 주요 기능
- **실시간 분석**: MediaPipe와 PyTorch ViT 모델 통합
- **8가지 감정**: 기쁨, 슬픔, 분노, 놀람, 두려움, 혐오, 중립, 경멸
- **GPU 가속**: CUDA 지원으로 빠른 처리 속도
- **웹 인터페이스**: 브라우저에서 실시간 표정 분석

#### 사용 예시
```python
from dys_studio.expression_analyzer import ExpressionAnalyzer

# 표정 분석기 초기화
analyzer = ExpressionAnalyzer()
analyzer.initialize()

# 이미지 분석
result = analyzer.analyze_expression(image_data)
print(f"감정: {result['emotion']}")
print(f"신뢰도: {result['confidence']}")
```

### TTS (Text-to-Speech)

#### 주요 기능
- **Edge-TTS**: Microsoft Edge의 고품질 TTS 엔진
- **다양한 목소리**: 한국어 특화 음성 (ko-KR-SunHiNeural 등)
- **실시간 변환**: 텍스트를 즉시 음성으로 변환
- **감정 표현**: 페르소나별 특성에 맞는 목소리 설정

#### 사용 예시
```python
import edge_tts

# TTS 변환
voice = "ko-KR-SunHiNeural"
text = "안녕하세요! 반갑습니다."
tts = edge_tts.Communicate(text, voice)
await tts.save("output.wav")
```

---

## 데이터베이스

### MongoDB 스키마

#### Users Collection
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "name": "사용자명",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Chat Sessions Collection
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "session_name": "새로운 대화",
  "persona_name": "이서아",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Chat Messages Collection
```json
{
  "_id": "ObjectId",
  "session_id": "ObjectId",
  "user_id": "ObjectId",
  "content": "메시지 내용",
  "role": "user|assistant",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 데이터베이스 관리

```python
from database import init_database, create_chat_session, save_message

# 데이터베이스 초기화
await init_database()

# 채팅 세션 생성
session_id = await create_chat_session(user_id, persona_name)

# 메시지 저장
await save_message(session_id, user_id, content, role)
```

---

## 인증 시스템

### Supabase JWT 인증

#### 주요 기능
- **JWT 토큰 검증**: Supabase에서 발급된 JWT 토큰 검증
- **사용자 정보 추출**: 토큰에서 사용자 ID, 이메일 등 정보 추출
- **권한 관리**: 인증된 사용자만 API 접근 허용
- **자동 토큰 갱신**: 토큰 만료 시 자동 갱신

#### 사용 예시
```python
from auth import get_current_user, get_current_user_id

# 인증된 사용자 정보 가져오기
@app.get("/profile")
async def get_profile(current_user = Depends(get_current_user)):
    return {"user": current_user}

# 사용자 ID만 가져오기
@app.get("/sessions")
async def get_sessions(user_id = Depends(get_current_user_id)):
    return await get_user_sessions(user_id)
```

### 환경변수 설정
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET_KEY=your_jwt_secret_key
```

---

## 피드백 시스템

### 피드백 데이터 구조

```json
{
  "session_id": "68a4822dbe902a94027d203e",
  "user_id": "9ee98cf1-3377-4575-bd73-f1b8447681c2",
  "feedback": {
    "likability": 0,
    "initiative": 50,
    "tone": 0,
    "concentration": 72,
    "gaze_stability": 70,
    "blinking": 64,
    "posture": 33,
    "expression": "긍정적",
    "total_score": 0,
    "summary": "실시간 꿀팁! AI와 대화를 2회 이상 나누면 자동으로 분석이 시작됩니다."
  },
  "created_at": 1755611717.3383076
}
```

### 분석 항목
- **호감도 (likability)**: 페르소나에 대한 호감도
- **주도성 (initiative)**: 대화 주도 정도
- **톤 (tone)**: 음성 톤의 적절성
- **집중도 (concentration)**: 대화 집중 정도
- **시선 안정성 (gaze_stability)**: 시선 고정 정도
- **깜빡임 (blinking)**: 자연스러운 깜빡임
- **자세 (posture)**: 바른 자세 유지
- **표정 (expression)**: 긍정적/부정적 표정

---

## 개발 가이드

### 개발 환경 설정

1. **의존성 설치**
   ```bash
   pip install -r requirements.txt
   ```

2. **개발 도구 설치**
   ```bash
   pip install pytest pytest-asyncio black flake8
   ```

3. **코드 포맷팅**
   ```bash
   black .
   flake8 .
   ```

4. **테스트 실행**
   ```bash
   pytest
   ```

### 새로운 페르소나 추가

1. **JSON 파일 생성**
   ```bash
   python -c "
   from personas.persona_manager import PersonaManager
   manager = PersonaManager()
   manager.create_persona_template('새페르소나', '새페르소나', '설명')
   "
   ```

2. **페르소나 정보 수정**
   - `personas/새페르소나.json` 파일 편집
   - 기본 정보, 성격, 취미 등 설정

3. **서버에 연동**
   - `server.py`의 `load_persona_context` 함수 수정
   - 새로운 페르소나 로직 추가

### 새로운 AI 기능 추가

1. **모듈 생성**
   ```python
   # dys_studio/new_feature.py
   class NewFeature:
       def __init__(self):
           pass
       
       def process(self, data):
           # 처리 로직
           return result
   ```

2. **서버에 연동**
   ```python
   # server.py
   from dys_studio.new_feature import NewFeature
   
   @app.post("/new-feature")
   async def new_feature_endpoint(data: dict):
       feature = NewFeature()
       result = feature.process(data)
       return result
   ```

### API 확장

1. **새 엔드포인트 추가**
   ```python
   @app.post("/new-endpoint")
   async def new_endpoint(data: NewModel):
       # 처리 로직
       return {"result": "success"}
   ```

2. **Pydantic 모델 정의**
   ```python
   class NewModel(BaseModel):
       field1: str
       field2: int
       field3: Optional[str] = None
   ```

---

## 문제 해결

### 일반적인 문제

#### 1. MongoDB 연결 오류
```bash
# MongoDB 상태 확인
sudo systemctl status mongodb

# MongoDB 로그 확인
sudo tail -f /var/log/mongodb/mongodb.log

# MongoDB 재시작
sudo systemctl restart mongodb
```

#### 2. 포트 충돌
```bash
# 포트 사용 확인
sudo netstat -tulpn | grep :8000

# 프로세스 종료
sudo kill -9 <process_id>
```

#### 3. 메모리 부족
- AI 모델 로딩 시 충분한 RAM 확보 필요 (최소 8GB)
- GPU 메모리 부족 시 CPU 모드로 전환
- 불필요한 프로세스 종료

#### 4. 권한 문제
```bash
# MongoDB 데이터 디렉토리 권한 설정
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chmod 755 /var/lib/mongodb
```

### AI 모델 관련 문제

#### 1. 모델 다운로드 실패
```bash
# 수동 모델 다운로드
python -c "
from transformers import AutoTokenizer, AutoModel
tokenizer = AutoTokenizer.from_pretrained('cardiffnlp/twitter-roberta-base-emotion-multilingual-latest')
model = AutoModel.from_pretrained('cardiffnlp/twitter-roberta-base-emotion-multilingual-latest')
"
```

#### 2. GPU 메모리 부족
```python
# CPU 모드로 강제 전환
import torch
torch.cuda.is_available = lambda: False
```

#### 3. 음성 분석 오류
```bash
# 오디오 라이브러리 재설치
pip uninstall librosa
pip install librosa==0.10.1
```

### 로그 확인

```bash
# 애플리케이션 로그 확인
tail -f core_analysis.log

# 서버 로그 확인
python server.py 2>&1 | tee server.log
```

---

</div>
