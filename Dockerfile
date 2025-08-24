# =================================================================
# STAGE 1: 빌드(Build) 단계 - 의존성 설치를 위한 스테이지
# =================================================================
FROM node:20-slim AS builder

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# package.json과 package-lock.json을 먼저 복사
COPY package*.json ./

# 프로덕션 환경에 필요한 모든 의존성 설치
RUN npm install --omit=dev

# =================================================================
# STAGE 2: 프로덕션(Production) 단계 - 실제 실행을 위한 스테이지
# =================================================================
FROM node:20-slim

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 빌드 스테이지에서 설치했던 node_modules를 복사
COPY --from=builder /usr/src/app/node_modules ./node_modules

# 나머지 소스 코드를 복사
COPY . .

# 애플리케이션이 실행될 포트 번호 설정
EXPOSE 8080

# 컨테이너가 시작될 때 실행할 명령어 (package.json의 main과 일치)
CMD [ "node", "src/index.js" ]