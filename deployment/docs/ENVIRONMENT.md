# 환경변수 설정 가이드

## 개요

DYS Backend는 `.env` 파일 대신 **Kubernetes Secret** 과 **환경변수**를 통해 설정을 관리합니다. 이는 보안상 민감한 정보를 Git 저장소에 포함하지 않기 위함입니다.

## 환경변수 구조

### 1. Kubernetes Secret으로 관리되는 민감한 정보

```yaml
# kubectl create secret generic dys-secrets \
#   --from-literal=mongodb-uri="mongodb+srv://..." \
#   --from-literal=openai-api-key="sk-..." \
#   --from-literal=supabase-url="https://..." \
#   --from-literal=supabase-anon-key="eyJ..." \
#   --from-literal=pinecone-api-key="..."
```

**포함되는 정보:**
- `mongodb-uri`: MongoDB 연결 문자열
- `openai-api-key`: OpenAI API 키
- `supabase-url`: Supabase 프로젝트 URL
- `supabase-anon-key`: Supabase 익명 키
- `pinecone-api-key`: Pinecone Vector DB API 키

### 2. 환경변수로 직접 설정되는 일반 설정

**애플리케이션 설정:**
- `PORT=8000`: 메인 서버 포트
- `DATABASE_NAME=dys-chatbot`: MongoDB 데이터베이스 이름
- `ALLOWED_ORIGINS=*`: CORS 허용 도메인
- `LOG_LEVEL=INFO`: 로깅 레벨

**네트워크 설정:**
- `WEBSOCKET_HOST=34.64.136.237`: WebSocket 서버 호스트 (GKE 외부 IP)
- `WEBSOCKET_PORT=8001`: WebSocket 서버 포트
- `CORS_ORIGINS=*,https://dys-phi.vercel.app`: CORS 허용 오리진 목록

**Pinecone 설정:**
- `PINECONE_ENVIRONMENT=gcp-starter`: Pinecone 환경
- `PINECONE_HOST=https://...`: Pinecone 호스트 URL

**시스템 설정 (권한 문제 해결):**
- `MPLCONFIGDIR=/tmp/matplotlib_cache`: matplotlib 설정 디렉토리
- `XDG_CACHE_HOME=/tmp/app_cache`: XDG 캐시 홈
- `HOME=/tmp/app_cache`: 홈 디렉토리
- `TRANSFORMERS_CACHE=/tmp/huggingface_cache`: Transformers 캐시

## Secret 생성 방법

### 1. Google Cloud에서 Secret 생성

```bash
# GCloud CLI로 Secret 생성
kubectl create secret generic dys-secrets \
  --from-literal=mongodb-uri="YOUR_MONGODB_URI" \
  --from-literal=openai-api-key="YOUR_OPENAI_API_KEY" \
  --from-literal=supabase-url="YOUR_SUPABASE_URL" \
  --from-literal=supabase-anon-key="YOUR_SUPABASE_ANON_KEY" \
  --from-literal=pinecone-api-key="YOUR_PINECONE_API_KEY"
```

### 2. Secret 값 업데이트

```bash
# 특정 키의 값만 업데이트
kubectl patch secret dys-secrets \
  -p='{"data":{"openai-api-key":"'$(echo -n "NEW_API_KEY" | base64)'"}}'

# 또는 전체 Secret 재생성
kubectl delete secret dys-secrets
kubectl create secret generic dys-secrets --from-literal=...
```

### 3. Secret 확인

```bash
# Secret 목록 확인
kubectl get secrets

# Secret 내용 확인 (base64 디코딩)
kubectl get secret dys-secrets -o jsonpath='{.data}' | jq -r 'to_entries[] | "\(.key): \(.value | @base64d)"'
```

## 로컬 개발환경 설정

로컬 개발 시에는 `.env` 파일을 사용할 수 있습니다:

```bash
# env.example을 복사하여 .env 파일 생성
cp env.example .env

# .env 파일 편집
nano .env
```

**주의:** `.env` 파일은 절대 Git에 커밋하지 마세요!

## 환경변수 검증

애플리케이션 시작 시 다음과 같이 환경변수가 올바르게 설정되었는지 확인합니다:

```python
# 필수 환경변수 확인
required_vars = [
    'MONGODB_URI',
    'OPENAI_API_KEY', 
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'PINECONE_API_KEY'
]

for var in required_vars:
    if not os.getenv(var):
        logger.error(f"❌ 필수 환경변수 누락: {var}")
```

## 문제해결

### Q: "⚠️ .env 파일이 없습니다" 경고가 나타납니다

**A:** 정상입니다. Kubernetes 환경에서는 환경변수와 Secret을 통해 설정을 관리하므로 .env 파일이 필요하지 않습니다.

### Q: matplotlib 권한 오류가 발생합니다

**A:** `MPLCONFIGDIR` 환경변수가 `/tmp/matplotlib_cache`로 설정되어 있는지 확인하세요. 이 디렉토리는 Docker 컨테이너 시작 시 자동으로 생성됩니다.

### Q: Pinecone/OpenAI API 연결 오류가 발생합니다

**A:** Secret의 API 키가 올바르게 설정되어 있는지 확인하고, 프록시 설정(`HTTP_PROXY`, `HTTPS_PROXY`)이 빈 문자열로 설정되어 있는지 확인하세요.

## 보안 모범 사례

1. **민감한 정보는 반드시 Secret 사용**
2. **API 키를 로그에 출력하지 않기**
3. **권한이 없는 사용자는 Secret에 접근할 수 없도록 RBAC 설정**
4. **주기적으로 API 키 로테이션**
5. **개발/운영 환경별로 별도의 Secret 관리**

## 관련 파일

- `deployment/k8s/deployment.yaml`: Kubernetes 배포 설정 및 환경변수 정의
- `Dockerfile`: Docker 컨테이너 환경변수 설정
- `env.example`: 로컬 개발용 환경변수 템플릿
- `src/backend/core/main_server.py`: 환경변수 검증 로직
