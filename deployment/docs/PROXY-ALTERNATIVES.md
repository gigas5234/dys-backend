# 프록시 대안 및 해결 방안

## 문제 상황

DYS Backend에서 외부 API 호출 시 httpx 'proxies' 파라미터 호환성 문제로 인해 다음 서비스들이 실패:

- ❌ OpenAI API (벡터 서비스, 채팅, 음성 인식/합성)
- ❌ Pinecone Vector DB
- ❌ 외부 모델 API 호출

## 선택된 해결책: 프록시 완전 제거

### 이유
1. **안정성 최우선**: httpx 버전 호환성 문제 완전 회피
2. **단순성**: 복잡한 프록시 설정 없이 직접 연결
3. **성능**: 프록시 없이 더 빠른 응답
4. **보안**: GKE 환경에서 직접 연결이 더 안전

### 구현된 변경사항

#### 1. 모든 서비스에서 프록시 제거

**Vector Service (`vector_service.py`)**:
```python
# 변경 전: httpx + proxy 설정
proxy_url = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
if proxy_url:
    http_client = make_httpx_client(proxy_url, timeout=60.0)
    self.openai_client = OpenAI(api_key=api_key, http_client=http_client)

# 변경 후: 직접 연결
self.openai_client = OpenAI(api_key=self.openai_api_key, timeout=60.0)
```

**Voice Services (`voice_api.py`, `voice_analyzer.py`)**:
```python
# 프록시 설정 제거, 직접 연결로 안정성 확보
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'), timeout=60.0)
```

**Chat Service (`main_server.py`)**:
```python
# httpx 복잡성 제거
client = OpenAI(api_key=OPENAI_API_KEY, timeout=60.0)
```

#### 2. Pinecone 환경변수 강화 정리

**Pinecone Client (`pinecone_client.py`)**:
```python
# 더 많은 프록시 환경변수 제거
proxy_vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'ALL_PROXY', 'all_proxy']
```

#### 3. Kubernetes 배포 설정 강화

**Deployment (`deployment.yaml`)**:
```yaml
# 모든 프록시 관련 환경변수 명시적 비활성화
- name: HTTP_PROXY
  value: ""
- name: HTTPS_PROXY  
  value: ""
- name: NO_PROXY
  value: "*"
- name: http_proxy
  value: ""
- name: https_proxy
  value: ""
- name: no_proxy
  value: "*"
- name: ALL_PROXY
  value: ""
- name: all_proxy
  value: ""
- name: REQUESTS_CA_BUNDLE
  value: ""
- name: CURL_CA_BUNDLE
  value: ""
```

## 대안 방법들 (참고용)

### 1. requests 라이브러리 사용
```python
import requests

# OpenAI API 대신 직접 HTTP 호출
response = requests.post(
    'https://api.openai.com/v1/chat/completions',
    headers={'Authorization': f'Bearer {api_key}'},
    json=payload,
    timeout=60
)
```

### 2. httpx 버전 다운그레이드
```txt
# requirements.txt
httpx==0.24.0  # 'proxies' 파라미터 지원 버전
```

### 3. 환경별 설정 분리
```python
# 개발환경: 프록시 사용
# 운영환경: 직접 연결
if os.getenv('ENVIRONMENT') == 'production':
    client = OpenAI(api_key=api_key)  # 직접 연결
else:
    # 프록시 설정...
```

## 모니터링 및 검증

### 성공 로그 확인
```python
✅ [AI_RESPONSE] OpenAI 클라이언트 직접 연결 완료
✅ OpenAI 음성 API 직접 연결 완료  
✅ OpenAI 음성 분석 직접 연결 완료
✅ Pinecone 클라이언트 초기화 완료
```

### 실패 로그 사라짐
```python
❌ 더이상 나타나지 않음:
- Client.__init__() got an unexpected keyword argument 'proxies'
- httpx 클라이언트 초기화 실패
- 벡터 서비스 초기화 실패
```

## 네트워크 요구사항

### 아웃바운드 연결 허용 필요:
- `api.openai.com:443` (OpenAI API)
- `*.pinecone.io:443` (Pinecone Vector DB)
- `storage.googleapis.com:443` (모델 다운로드)

### 방화벽 설정:
```bash
# GKE 환경에서는 기본적으로 아웃바운드 HTTPS 허용됨
# 추가 설정 불필요
```

## 트러블슈팅

### Q: API 호출이 여전히 실패한다면?
**A:** 네트워크 연결 및 API 키 유효성 확인:
```bash
# API 키 테스트
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Pinecone 연결 테스트  
curl -H "Api-Key: $PINECONE_API_KEY" https://controller.pinecone.io/actions/whoami
```

### Q: 성능이 걱정된다면?
**A:** 직접 연결이 프록시보다 더 빠름:
- 프록시 hop 제거
- DNS 조회 단순화
- SSL 핸드셰이크 최적화

## 혜택 요약

✅ **안정성**: httpx 호환성 문제 완전 해결  
✅ **성능**: 프록시 없이 더 빠른 응답  
✅ **단순성**: 복잡한 프록시 설정 제거  
✅ **보안**: GKE 환경에서 직접 연결이 더 안전  
✅ **유지보수**: 프록시 관련 디버깅 불필요  

## 관련 파일

- `src/backend/services/vector_service.py`: 벡터 서비스 프록시 제거
- `src/backend/services/voice/voice_api.py`: 음성 API 프록시 제거
- `src/backend/services/voice/voice_analyzer.py`: 음성 분석 프록시 제거
- `src/backend/core/main_server.py`: 채팅 API 프록시 제거
- `src/backend/database/pinecone_client.py`: Pinecone 프록시 제거
- `deployment/k8s/deployment.yaml`: K8s 환경변수 설정
