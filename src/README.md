# DYS Backend - 새로운 폴더 구조

## 📁 폴더 구조

```
src/
├── backend/                    # 백엔드 서버 관련
│   ├── api/                   # API 엔드포인트
│   ├── core/                  # 핵심 서버 파일
│   │   ├── main_server.py     # 메인 FastAPI 서버
│   │   ├── websocket_server.py # WebSocket 서버
│   │   ├── server_manager.py  # 서버 관리자
│   │   └── app.py            # 애플리케이션 진입점
│   ├── services/             # 비즈니스 로직 서비스
│   │   ├── calibration_service.py
│   │   ├── voice/            # 음성 분석 서비스
│   │   ├── analysis/         # 표정 분석 서비스
│   │   └── personas/         # 페르소나 관리 서비스
│   ├── models/               # 데이터 모델
│   │   ├── calibration.py
│   │   └── ml_models/        # ML 모델 파일들
│   ├── database/             # 데이터베이스 관련
│   │   └── database.py
│   ├── auth/                 # 인증 관련
│   │   └── auth.py
│   ├── monitoring/           # 모니터링
│   │   └── monitoring.py
│   └── docs/                 # 문서
│
├── frontend/                  # 프론트엔드 관련
│   ├── pages/                # 웹 페이지
│   │   └── studio_calibration.html
│   ├── components/           # UI 컴포넌트
│   │   ├── popups/          # 팝업 컴포넌트
│   │   ├── ui/              # UI 컴포넌트
│   │   └── analysis/        # 분석 컴포넌트
│   ├── assets/              # 정적 자산
│   │   ├── styles/          # CSS 스타일
│   │   ├── js/              # JavaScript 파일
│   │   ├── images/          # 이미지 파일
│   │   └── videos/          # 비디오 파일
│   └── utils/               # 유틸리티
│       ├── metrics/         # 메트릭 관련
│       ├── calibration/     # 캘리브레이션 관련
│       └── voice/           # 음성 관련
│
└── README.md                # 이 파일
```

## 🔧 주요 변경사항

### 백엔드 구조
- **core/**: 핵심 서버 파일들을 모아서 관리
- **services/**: 비즈니스 로직을 담당하는 서비스 레이어
  - **voice/**: 음성 분석 관련 서비스
  - **analysis/**: 표정 분석 관련 서비스
  - **personas/**: 페르소나 관리 서비스
- **models/**: 데이터 모델 정의
- **database/**: 데이터베이스 연결 및 쿼리
- **auth/**: 인증 및 권한 관리
- **monitoring/**: 시스템 모니터링
- **docs/**: 문서

### 프론트엔드 구조
- **pages/**: 웹 페이지 HTML 파일
- **components/**: 재사용 가능한 UI 컴포넌트
- **assets/**: 정적 자산 (CSS, JS, 이미지, 비디오)
- **utils/**: 유틸리티 함수들

## 🚀 실행 방법

### 백엔드 서버 실행
```bash
# 메인 서버
python -m src.backend.core.main_server

# WebSocket 서버
python -m src.backend.core.websocket_server

# 통합 서버
python -m src.backend.core.server_manager
```

### 프론트엔드 접속
```
http://localhost:8000/frontend/pages/studio_calibration.html
```

## 📝 Import 경로 변경

### 기존
```python
from models.calibration import CalibrationData
from services.calibration_service import calibration_service
```

### 새로운 구조
```python
from ..models.calibration import CalibrationData
from ..services.calibration_service import calibration_service
```

## 🔄 마이그레이션 완료

- ✅ 백엔드 파일 이동 완료
- ✅ 프론트엔드 파일 이동 완료
- ✅ Import 경로 수정 완료
- ✅ 패키지 초기화 파일 생성 완료
- ✅ 빈 폴더 정리 완료
- ✅ 음성 분석 서비스 이동 완료
- ✅ 표정 분석 서비스 이동 완료
- ✅ 페르소나 서비스 이동 완료
- ✅ ML 모델 파일 이동 완료
- ✅ 정적 자산 이동 완료

## 📋 파일 이동 완료 내역

### 백엔드로 이동된 파일들
- ✅ `src/dys_studio/voice/*` → `src/backend/services/voice/`
- ✅ `src/dys_studio/expression_analyzer.py` → `src/backend/services/analysis/`
- ✅ `src/dys_studio/models/*` → `src/backend/models/ml_models/`
- ✅ `src/personas/*` → `src/backend/services/personas/`
- ✅ `src/dys_studio/docs/*` → `src/backend/docs/`

### 프론트엔드로 이동된 파일들
- ✅ `src/dys_studio/js/*` → `src/frontend/assets/js/`
- ✅ `src/dys_studio/styles/*` → `src/frontend/assets/styles/`
- ✅ `src/dys_studio/popups/*` → `src/frontend/components/popups/`
- ✅ `src/dys_studio/video/*` → `src/frontend/assets/videos/`
- ✅ `src/dys_studio/img/*` → `src/frontend/assets/images/`

### 삭제된 폴더들
- ✅ `src/dys_studio/` (모든 파일 이동 후 삭제 완료)
- ✅ `src/models/` (빈 폴더)
- ✅ `src/services/` (빈 폴더)
- ✅ `src/personas/` (파일 이동 후 삭제)
- ✅ `src/feedback/` (빈 폴더)
