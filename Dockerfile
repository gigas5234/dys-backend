# 파이썬 3.10 버전을 기반
FROM python:3.10

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# CTranslate2 실행에 필요한 시스템 라이브러리 설치
RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Supervisor 설치
RUN apt-get update && apt-get install -y supervisor

# requirements.txt 파일을 먼저 복사하여 의존성 설치
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 나머지 프로젝트 파일들을 복사
COPY . .

# Supervisor 설정 파일을 컨테이너의 설정 경로로 복사
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# start.sh 파일에 실행 권한 부여
RUN chmod +x ./start.sh

# 컨테이너가 8000번 포트와 8001번 포트를 외부에 노출
EXPOSE 8000 8001

# 컨테이너가 시작될 때 main.py로 모델 다운로드 후 start.sh 스크립트 실행
CMD ["sh", "-c", "python src/main.py && ./start.sh"]