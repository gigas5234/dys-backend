# 파이썬 3.10 버전을 기반
FROM python:3.10-slim

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 시스템 패키지 설치 (안정적인 저장소 사용)
RUN apt-get update -o Acquire::http::Pipeline-Depth=0 && apt-get install -y \
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

# 의존성 설치 최적화 (타임아웃 증가, 재시도 로직)
RUN pip install --no-cache-dir --timeout=300 --retries=3 -r requirements.txt

# ctranslate2 실행 스택 문제 우회 패치 (안정적인 저장소 사용)
RUN apt-get update -o Acquire::http::Pipeline-Depth=0 && apt-get install -y binutils && rm -rf /var/lib/apt/lists/* \
 && python - <<'PY'
import sys, pathlib, subprocess, shutil
try:
    import ctranslate2
except Exception as e:
    print("ctranslate2 import 실패:", e); sys.exit(0)
root = pathlib.Path(ctranslate2.__file__).parent
libs = list(root.rglob("libctranslate2*.so*"))
print("패치 대상:", libs)
execstack_path = shutil.which("execstack")
if not execstack_path:
    print("execstack 미존재 - 패치 스킵")
    sys.exit(0)
for p in libs:
    subprocess.run([execstack_path, "-q", str(p)], check=False)
    subprocess.run([execstack_path, "-c", str(p)], check=False)
PY

# 나머지 프로젝트 파일들을 복사
COPY . .

# Supervisor 설정 파일을 컨테이너의 설정 경로로 복사
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# SSL 인증서 생성 (자체 서명)
RUN mkdir -p /usr/src/app/ssl && \
    openssl req -x509 -newkey rsa:4096 -keyout /usr/src/app/ssl/key.pem -out /usr/src/app/ssl/cert.pem -days 365 -nodes -subj "/C=KR/ST=Seoul/L=Seoul/O=DYS/CN=localhost"

# start.sh 파일에 실행 권한 부여
RUN chmod +x ./start.sh

# 컨테이너가 8000번 포트와 8001번 포트를 외부에 노출
EXPOSE 8000 8001

# 컨테이너가 시작될 때 main.py로 모델 다운로드 후 start.sh 스크립트 실행
CMD ["sh", "-c", "python src/main.py && ./start.sh"]