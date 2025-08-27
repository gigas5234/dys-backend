# 파이썬 3.10 버전을 기반 (GKE 환경 최적화)
FROM python:3.10-slim-bullseye

# 환경 변수 설정 (GKE 최적화)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 시스템 패키지 설치 (GKE 환경 최적화)
RUN apt-get update && apt-get install -y \
    supervisor \
    openssl \
    curl \
    ffmpeg \
    libsndfile1 \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# pip 업그레이드 및 캐시 정리
RUN pip install --upgrade pip setuptools wheel

# requirements.txt 파일을 먼저 복사하여 의존성 설치
COPY requirements.txt ./

# 의존성 설치 최적화 (GKE 환경)
RUN pip install --no-cache-dir --timeout=600 --retries=5 -r requirements.txt

# libctranslate2 관련 패치 제거 (오류 방지)
# ctranslate2는 requirements.txt에서 비활성화되어 있음

# 나머지 프로젝트 파일들을 복사
COPY . .

# GKE 환경 최적화
RUN mkdir -p /usr/src/app/logs && \
    mkdir -p /usr/src/app/src/backend/models/ml_models/data

# 실행 권한 부여
RUN chmod +x ./start.py && \
    chmod +x ./start.sh && \
    chmod +x ./deployment/scripts/start_integrated.py

# 컨테이너가 8000번 포트와 8001번 포트를 외부에 노출
EXPOSE 8000 8001

# 컨테이너가 시작될 때 통합 서버 실행
CMD ["python", "start.py"]