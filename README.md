# DYS Backend - 프로젝트 구조

## 📁 전체 프로젝트 구조

```
dys_backend/
├── src/                       # 소스 코드
│   ├── backend/              # 백엔드 서버 관련
│   │   ├── api/             # API 엔드포인트
│   │   ├── core/            # 핵심 서버 파일
│   │   ├── services/        # 비즈니스 로직 서비스
│   │   ├── models/          # 데이터 모델
│   │   ├── database/        # 데이터베이스 관련
│   │   ├── auth/            # 인증 관련
│   │   ├── monitoring/      # 모니터링
│   │   └── docs/            # 문서
│   └── frontend/            # 프론트엔드 관련
│       ├── pages/           # 웹 페이지
│       ├── components/      # UI 컴포넌트
│       ├── assets/          # 정적 자산
│       └── utils/           # 유틸리티
│
├── deployment/               # 배포 관련
│   ├── k8s/                # Kubernetes 매니페스트
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── gke-deployment-fix.yaml
│   │   └── dys-servicemonitor.yaml
│   ├── docker/             # Docker 관련
│   │   ├── Dockerfile
│   │   └── supervisord.conf
│   ├── monitoring/         # 모니터링 설정
│   │   ├── prometheus-values.yaml
│   │   ├── monitoring-setup.sh
│   │   ├── monitoring-setup-fixed.sh
│   │   └── monitoring-setup.ps1
│   └── scripts/            # 배포 스크립트
│       ├── start_integrated.py
│       ├── start.sh
│       └── get_helm.sh
│
├── logs/                    # 로그 파일
│   └── core_analysis.log
│
├── .github/                 # GitHub Actions
├── .git/                    # Git 저장소
├── requirements.txt         # Python 의존성
├── .gitignore              # Git 무시 파일
└── README.md               # 프로젝트 문서
```

## 🚀 실행 방법

### 빠른 시작
```bash
# Windows
start.bat

# Linux/Mac
./start.sh

# 또는 직접 실행
python start.py
```

### 개발 환경에서 실행
```bash
# 통합 서버 실행
python deployment/scripts/start_integrated.py

# 또는 개별 서버 실행
python -m src.backend.core.main_server
python -m src.backend.core.websocket_server
```

### GKE 배포 전 체크
```bash
# GKE 환경 호환성 체크
python check_gke.py

# Docker 빌드
docker build -f deployment/docker/Dockerfile -t dys-backend .

# GKE 배포
kubectl apply -f deployment/k8s/
```

### Docker로 실행
```bash
# 이미지 빌드
docker build -f deployment/docker/Dockerfile -t dys-backend .

# 컨테이너 실행
docker run -p 8000:8000 -p 8001:8001 dys-backend
```

### Kubernetes로 배포
```bash
# 배포
kubectl apply -f deployment/k8s/

# 모니터링 설정
kubectl apply -f deployment/monitoring/
```

## 📋 주요 기능

### 백엔드 서비스
- **캘리브레이션 서비스**: 사용자 자세 측정 및 개인화
- **음성 분석 서비스**: 실시간 음성 분석 및 평가
- **표정 분석 서비스**: MLflow 기반 표정 분석
- **페르소나 서비스**: 대화 상대 페르소나 관리

### 프론트엔드
- **스튜디오 페이지**: 실시간 분석 및 피드백
- **캘리브레이션 UI**: 자세 측정 인터페이스
- **팝업 시스템**: 상세 정보 표시

### 모니터링
- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드
- **ServiceMonitor**: Kubernetes 서비스 모니터링

## 🔧 개발 환경 설정

### 필수 요구사항
- Python 3.8+
- Node.js 16+
- Docker
- Kubernetes (선택사항)

### 설치
```bash
# Python 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 설정 추가
```

## 📝 API 문서

### 캘리브레이션 API
- `GET /api/calibration/status/{user_id}` - 캘리브레이션 상태 확인
- `GET /api/calibration/data/{user_id}` - 캘리브레이션 데이터 조회
- `POST /api/calibration/start` - 캘리브레이션 세션 시작
- `POST /api/calibration/process` - 캘리브레이션 데이터 처리

### 사용자 API
- `POST /api/user/check` - 사용자 상태 확인
- `POST /api/user/update-calibration` - 캘리브레이션 상태 업데이트

### 채팅 API
- `POST /api/chat/sessions` - 채팅 세션 생성
- `GET /api/chat/sessions/{user_id}` - 사용자 세션 조회
- `POST /api/chat/messages` - 메시지 저장

## 🔄 프로젝트 구조 변경 내역

### 완료된 정리 작업
- ✅ 백엔드/프론트엔드 분리
- ✅ 서비스별 폴더 구조화
- ✅ 배포 관련 파일 정리
- ✅ 로그 파일 정리
- ✅ 스크립트 파일 정리

### 파일 이동 내역
- **소스 코드**: `src/backend/`, `src/frontend/`
- **배포 파일**: 루트 → `deployment/` (k8s, docker, monitoring, scripts)
- **로그 파일**: 루트 → `logs/`
- **스크립트**: 루트 → `deployment/scripts/`

## 📞 지원

프로젝트 관련 문의사항이나 이슈는 GitHub Issues를 통해 제출해주세요.
