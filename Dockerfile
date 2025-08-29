# 파이썬 3.10 버전을 기반 (GKE 환경 최적화)
FROM python:3.10-slim-bullseye

# 환경 변수 설정 (GKE 최적화)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 시스템 패키지 설치 (GKE 환경 최적화 + MediaPipe 지원)
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
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-tools \
    gstreamer1.0-x \
    gstreamer1.0-alsa \
    gstreamer1.0-gl \
    gstreamer1.0-gtk3 \
    gstreamer1.0-qt5 \
    gstreamer1.0-pulseaudio \
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

# Autopilot 클러스터를 위한 사용자 생성
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 캐시 및 설정 디렉토리 생성 (권한 문제 해결)
RUN mkdir -p /tmp/huggingface_cache && \
    mkdir -p /tmp/matplotlib_cache && \
    mkdir -p /tmp/app_cache && \
    chmod 777 /tmp/matplotlib_cache && \
    chmod 777 /tmp/app_cache && \
    chown -R appuser:appuser /tmp/huggingface_cache && \
    chown -R appuser:appuser /tmp/matplotlib_cache && \
    chown -R appuser:appuser /tmp/app_cache && \
    chown -R appuser:appuser /usr/src/app

USER appuser

# matplotlib 및 기타 권한 문제 해결을 위한 환경변수 설정
ENV MPLCONFIGDIR=/tmp/matplotlib_cache
ENV XDG_CACHE_HOME=/tmp/app_cache
ENV HOME=/tmp/app_cache

# 컨테이너가 8000번 포트와 8001번 포트를 외부에 노출
EXPOSE 8000 8001

# 컨테이너가 시작될 때 통합 서버 실행 (메인 서버 + 웹소켓 서버)
CMD ["python", "deployment/scripts/start_integrated.py"]