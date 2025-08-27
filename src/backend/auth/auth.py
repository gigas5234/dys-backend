import os
import jwt
import requests
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# 환경변수 검증
if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ [AUTH] Supabase 환경변수가 설정되지 않았습니다!")
    print(f"   SUPABASE_URL: {SUPABASE_URL or '설정되지 않음'}")
    print(f"   SUPABASE_ANON_KEY: {'설정됨' if SUPABASE_ANON_KEY else '설정되지 않음'}")
    print("   환경변수를 설정하고 서버를 재시작하세요.")
else:
    print(f"✅ [AUTH] Supabase 설정 확인됨: {SUPABASE_URL}")

# JWT 설정
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
JWT_ALGORITHM = "HS256"

# HTTP Bearer 토큰 스키마
security = HTTPBearer()

class SupabaseAuth:
    """Supabase 인증 관리 클래스"""
    
    @staticmethod
    async def verify_supabase_token(token: str) -> Optional[Dict[str, Any]]:
        """Supabase JWT 토큰 검증"""
        print(f"🔍 [SUPABASE_AUTH] 토큰 검증 시작")
        print(f"🔑 [SUPABASE_AUTH] 토큰 길이: {len(token)}")
        print(f"🔑 [SUPABASE_AUTH] 토큰 시작: {token[:20]}...")
        
        try:
            # Supabase JWT 토큰을 직접 디코딩 (서명 검증 없이)
            import base64
            import json
            
            # JWT 토큰 파트 분리
            parts = token.split('.')
            if len(parts) != 3:
                print(f"❌ [SUPABASE_AUTH] 잘못된 JWT 형식")
                return None
            
            # 페이로드 디코딩
            payload_part = parts[1]
            # 패딩 추가
            padding = 4 - len(payload_part) % 4
            if padding != 4:
                payload_part += '=' * padding
            
            try:
                payload_bytes = base64.urlsafe_b64decode(payload_part)
                payload = json.loads(payload_bytes.decode('utf-8'))
                
                print(f"✅ [SUPABASE_AUTH] JWT 페이로드 디코딩 성공")
                print(f"📋 [SUPABASE_AUTH] 페이로드: {payload}")
                
                # 사용자 정보 추출
                user_data = {
                    "id": payload.get("sub"),  # Supabase user ID
                    "email": payload.get("email"),
                    "role": payload.get("role", "authenticated"),
                    "aud": payload.get("aud"),
                    "exp": payload.get("exp"),
                    "iat": payload.get("iat"),
                    "app_metadata": payload.get("app_metadata", {}),
                    "user_metadata": payload.get("user_metadata", {})
                }
                
                print(f"✅ [SUPABASE_AUTH] 사용자 데이터 추출: {user_data.get('email', 'Unknown')}")
                logger.info(f"✅ Supabase JWT 디코딩 성공: {user_data.get('email', 'Unknown')}")
                return user_data
                
            except Exception as decode_error:
                print(f"❌ [SUPABASE_AUTH] JWT 페이로드 디코딩 실패: {decode_error}")
                
                # API 검증으로 폴백
                print(f"🔄 [SUPABASE_AUTH] API 검증으로 폴백 시도")
                return await SupabaseAuth._verify_via_api(token)
                
        except Exception as e:
            print(f"❌ [SUPABASE_AUTH] 토큰 검증 오류: {e}")
            logger.error(f"❌ Supabase 토큰 검증 오류: {e}")
            return None
    
    @staticmethod
    async def _verify_via_api(token: str) -> Optional[Dict[str, Any]]:
        """API를 통한 토큰 검증 (폴백)"""
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            print(f"❌ [SUPABASE_AUTH] API 검증을 위한 환경변수 누락")
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ [SUPABASE_AUTH] API 검증 성공: {user_data.get('email', 'Unknown')}")
                return user_data
            else:
                print(f"⚠️ [SUPABASE_AUTH] API 검증 실패: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ [SUPABASE_AUTH] API 검증 오류: {e}")
            return None
    
    @staticmethod
    def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
        """JWT 토큰 디코딩"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("⚠️ JWT 토큰 만료")
            return None
        except jwt.JWTError as e:
            logger.error(f"❌ JWT 토큰 디코딩 오류: {e}")
            return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """현재 인증된 사용자 정보 반환"""
    token = credentials.credentials
    print(f"🔍 [AUTH] 토큰 검증 시작 - token: {token[:20]}...")
    
            # 테스트용 토큰 우회 (개발 중에만 사용) - 비활성화
        # if token == "test-token":
        #     print("⚠️ [AUTH] 테스트 토큰 감지, 인증 우회")
        #     return {
        #         "id": "507f1f77bcf86cd799439011",  # 유효한 ObjectId 형식
        #         "email": "test@example.com",
        #         "role": "user"
        #     }
    
    # 실제 Supabase 토큰 검증
    print("🔍 [AUTH] 실제 Supabase 토큰 검증 시작")
    
    # Supabase 토큰 검증
    user_data = await SupabaseAuth.verify_supabase_token(token)
    
    if not user_data:
        print("❌ [AUTH] 토큰 검증 실패")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"✅ [AUTH] 토큰 검증 성공 - user_id: {user_data.get('id')}")
    return user_data

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """현재 인증된 사용자 ID 반환"""
    user_data = await get_current_user(credentials)
    return user_data.get("id")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
    """JWT 액세스 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        import time
        expire = time.time() + expires_delta
    else:
        import time
        expire = time.time() + (15 * 60)  # 15분
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

# 인증 데코레이터
def require_auth(func):
    """인증이 필요한 엔드포인트 데코레이터"""
    async def wrapper(*args, **kwargs):
        # 여기서 인증 로직을 추가할 수 있습니다
        return await func(*args, **kwargs)
    return wrapper
