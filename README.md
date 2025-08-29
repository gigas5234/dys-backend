# DYS Backend

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-20.10+-blue.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.25+-blue.svg)](https://kubernetes.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AI 기반 소통 능력 향상 플랫폼의 백엔드 서버**

실시간 표정 분석, 음성 인식, 대화 분석을 통한 개인 맞춤형 소통 코칭을 제공하는 백엔드 API 서버입니다.

## 주요 기능

### AI 분석 엔진
- **실시간 표정 분석**: MediaPipe 기반 얼굴 표정 인식
- **음성 분석**: OpenAI Whisper 기반 음성 인식 및 톤 분석
- **대화 분석**: GPT 기반 대화 품질 평가
- **자세 분석**: MediaPipe Pose 기반 자세 안정성 측정

### 인증 및 보안
- **JWT 토큰 인증**: 안전한 사용자 세션 관리
- **OAuth 2.0**: Google 로그인 연동
- **CORS 설정**: 프론트엔드와의 안전한 통신

### 데이터 관리
- **MongoDB**: 사용자 데이터 및 대화 기록 저장
- **Pinecone**: 벡터 데이터베이스로 대화 임베딩 저장
- **Redis**: 세션 캐싱 및 실시간 데이터 처리

### 실시간 통신
- **WebSocket**: 실시간 분석 결과 전송
- **HTTP/2**: 고성능 API 통신
- **Load Balancer**: GKE 기반 자동 스케일링

## 프로젝트 구조

```
dys-backend/
├── src/                          # 소스 코드
│   ├── backend/                  # 백엔드 핵심 모듈
│   │   ├── api/                  # API 엔드포인트
│   │   ├── auth/                 # 인증 시스템
│   │   ├── core/                 # 핵심 서버 로직
│   │   │   ├── main_server.py       # FastAPI 메인 서버
│   │   │   ├── websocket_server.py  # WebSocket 서버
│   │   │   └── server_manager.py    # 통합 서버 관리
│   │   ├── database/             # 데이터베이스 연결
│   │   ├── models/               # 데이터 모델
│   │   ├── services/             # 비즈니스 로직
│   │   │   ├── analysis/         # AI 분석 서비스
│   │   │   ├── voice/            # 음성 처리 서비스
│   │   │   └── personas/         # AI 페르소나 관리
│   │   ├── monitoring/           # 모니터링 시스템
│   │   └── docs/                 # API 문서
│   └── frontend/                 # 프론트엔드 정적 파일
│       ├── pages/                # HTML 페이지
│       ├── assets/               # 정적 리소스
│       │   ├── js/               # JavaScript 파일
│       │   ├── styles/           # CSS 스타일
│       │   ├── images/           # 이미지 파일
│       │   └── popups/           # 팝업 HTML
│       └── video/                # 비디오 파일
├── deployment/                   # 배포 설정
│   ├── k8s/                      # Kubernetes 설정
│   ├── monitoring/               # Prometheus/Grafana 설정
│   └── scripts/                  # 배포 스크립트
├── .github/                      # GitHub Actions
├── Dockerfile                    # Docker 이미지 설정
├── requirements.txt              # Python 의존성
├── main.py                       # 애플리케이션 진입점
└── README.md                     # 프로젝트 문서
```

## 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/gigas5234/dys-backend.git
cd dys-backend

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp env.example .env

# 필수 환경 변수 설정
OPENAI_API_KEY=your_openai_api_key
MONGODB_URI=your_mongodb_connection_string
PINECONE_API_KEY=your_pinecone_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 로컬 개발 서버 실행

```bash
# 통합 서버 실행 (메인 + WebSocket)
python start.py

# 또는 개별 서버 실행
python -m uvicorn src.backend.core.main_server:app --host 0.0.0.0 --port 8000
python -m uvicorn src.backend.core.websocket_server:app --host 0.0.0.0 --port 8001
```

### 4. Docker 실행

```bash
# 이미지 빌드
docker build -t dys-backend .

# 컨테이너 실행
docker run -p 8000:8000 -p 8001:8001 --env-file .env dys-backend
```

## API 문서

### 기본 엔드포인트

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | 서버 상태 확인 |
| `GET` | `/health` | 헬스체크 |
| `GET` | `/docs` | Swagger API 문서 |
| `GET` | `/redoc` | ReDoc API 문서 |

### 인증 API

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/refresh
```

### 분석 API

```http
POST /api/analysis/expression    # 표정 분석
POST /api/analysis/voice         # 음성 분석
POST /api/analysis/conversation  # 대화 분석
POST /api/analysis/posture       # 자세 분석
```

### WebSocket 엔드포인트

```javascript
// 실시간 랜드마크 데이터
ws://localhost:8001/ws/landmarks

// 실시간 분석 결과
ws://localhost:8001/ws/analysis
```

### 사용 예시

```python
import requests

# 표정 분석 요청
response = requests.post('http://localhost:8000/api/analysis/expression', 
    json={'image': 'base64_encoded_image'})
result = response.json()

# WebSocket 연결
import websockets
async with websockets.connect('ws://localhost:8001/ws/landmarks') as websocket:
    await websocket.send('{"type": "start_analysis"}')
    result = await websocket.recv()
```

## Docker 배포

### 1. 이미지 빌드

```bash
# 로컬 빌드
docker build -t dys-backend:latest .

# GCP Artifact Registry 푸시
docker tag dys-backend:latest asia-northeast3-docker.pkg.dev/PROJECT_ID/dys-backend/dys-backend:latest
docker push asia-northeast3-docker.pkg.dev/PROJECT_ID/dys-backend/dys-backend:latest
```

### 2. Kubernetes 배포

```bash
# 네임스페이스 생성
kubectl create namespace dys-backend

# 시크릿 생성
kubectl create secret generic dys-secrets \
  --from-literal=openai-api-key=YOUR_KEY \
  --from-literal=mongodb-uri=YOUR_URI \
  --from-literal=pinecone-api-key=YOUR_KEY

# 배포 적용
kubectl apply -f deployment/k8s/
```

## GKE 배포

### 1. 클러스터 설정

```bash
# GKE 클러스터 생성
gcloud container clusters create dys-cluster \
  --zone=asia-northeast3-a \
  --num-nodes=3 \
  --machine-type=e2-medium \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=10
```

### 2. 모니터링 설정

```bash
# Prometheus + Grafana 설치
cd deployment/monitoring
./monitoring-setup.sh
```

### 3. 배포 확인

```bash
# Pod 상태 확인
kubectl get pods

# 서비스 확인
kubectl get svc

# 로그 확인
kubectl logs -f deployment/dys-deployment-xxxxx
```

## 모니터링

### Prometheus 메트릭

```promql
# HTTP 요청률
rate(http_requests_total[5m])

# 응답 시간
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 에러율
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### Grafana 대시보드

- **URL**: `http://GRAFANA_IP:3000`
- **Username**: `admin`
- **Password**: `dys-monitoring-2024`

### 주요 대시보드

1. **Kubernetes Cluster** (ID: 7249)
2. **Node Exporter** (ID: 1860)
3. **Kubernetes Pods** (ID: 6417)

## 개발 가이드

### 코드 스타일

```python
# 함수형 프로그래밍 스타일
async def analyze_expression(image_data: str) -> Dict[str, Any]:
    """표정 분석 함수"""
    try:
        result = await expression_analyzer.analyze(image_data)
        return {"ok": True, "result": result}
    except Exception as e:
        logger.error(f"표정 분석 실패: {e}")
        return {"ok": False, "error": str(e)}
```

### 로깅

```python
import logging

logger = logging.getLogger(__name__)
logger.info("서버 시작됨")
logger.warning("경고 메시지")
logger.error("오류 발생")
```

### 테스트

```bash
# 단위 테스트 실행
python -m pytest tests/

# 통합 테스트 실행
python -m pytest tests/integration/

# 커버리지 확인
python -m pytest --cov=src tests/
```

## 기술 스택

### 백엔드
- **Python 3.11+**: 메인 프로그래밍 언어
- **FastAPI**: 고성능 웹 프레임워크
- **Uvicorn**: ASGI 서버
- **Pydantic**: 데이터 검증

### AI/ML
- **MediaPipe**: 실시간 얼굴/자세 인식
- **OpenAI GPT**: 대화 분석 및 생성
- **OpenAI Whisper**: 음성 인식
- **PyTorch**: 딥러닝 모델

### 데이터베이스
- **MongoDB**: 메인 데이터베이스
- **Pinecone**: 벡터 데이터베이스
- **Redis**: 캐싱 및 세션 저장

### 인프라
- **Docker**: 컨테이너화
- **Kubernetes**: 오케스트레이션
- **Google Cloud**: 클라우드 플랫폼
- **Prometheus**: 모니터링
- **Grafana**: 시각화

## 기여하기

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/dys-backend.git
cd dys-backend
git remote add upstream https://github.com/gigas5234/dys-backend.git
```

### 2. 브랜치 생성

```bash
git checkout -b feature/your-feature-name
```

### 3. 개발 및 테스트

```bash
# 코드 작성
# 테스트 실행
python -m pytest

# 코드 포맷팅
black src/
isort src/
```

### 4. Pull Request

```bash
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin feature/your-feature-name
```

---

**DYS Backend로 더 나은 소통을 시작하세요!**
