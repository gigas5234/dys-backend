import os
import motor.motor_asyncio
from pymongo import MongoClient
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import hashlib

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB 설정 (로컬 또는 Atlas)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "dys-chatbot")

print(f"🔗 [DATABASE] MongoDB URI: {MONGODB_URI}")
print(f"📊 [DATABASE] Database Name: {DATABASE_NAME}")

# 비동기 MongoDB 클라이언트
async_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
database = async_client[DATABASE_NAME]

# 동기 MongoDB 클라이언트 (인덱스 생성용)
sync_client = MongoClient(MONGODB_URI)
sync_database = sync_client[DATABASE_NAME]

# 컬렉션 참조 (chat 컬렉션 사용)
users_collection = database.users
chat_sessions_collection = database.chat_sessions
chat_messages_collection = database.chat  # dys-chatbot.chat 컬렉션 사용

print(f"📁 [DATABASE] Collections: users, chat_sessions, chat")

def supabase_uuid_to_objectid(uuid_string: str) -> str:
    """Supabase UUID를 MongoDB ObjectId로 변환"""
    try:
        # UUID를 해시하여 일관된 ObjectId 생성
        hash_object = hashlib.md5(uuid_string.encode())
        hash_hex = hash_object.hexdigest()
        # 24자리 ObjectId 형식으로 변환
        object_id = hash_hex[:24]
        print(f"🔄 [UUID_CONVERT] {uuid_string} -> {object_id}")
        return object_id
    except Exception as e:
        print(f"❌ [UUID_CONVERT] 변환 실패: {e}")
        # 폴백: 기본 ObjectId 생성
        from bson import ObjectId
        return str(ObjectId())

# 인덱스 생성
def create_indexes():
    """MongoDB 인덱스 생성"""
    try:
        # 사용자 컬렉션 인덱스
        sync_database.users.create_index([("email", 1)], unique=True)
        sync_database.users.create_index([("created_at", -1)])
        
        # 채팅 세션 인덱스
        sync_database.chat_sessions.create_index([("user_id", 1), ("created_at", -1)])
        sync_database.chat_sessions.create_index([("is_active", 1)])
        
        # 채팅 메시지 인덱스 (chat 컬렉션)
        sync_database.chat.create_index([("user_id", 1), ("session_id", 1), ("timestamp", -1)])
        sync_database.chat.create_index([("session_id", 1), ("timestamp", 1)])
        
        logger.info("✅ MongoDB 인덱스 생성 완료")
    except Exception as e:
        logger.error(f"❌ MongoDB 인덱스 생성 실패: {e}")

# 데이터베이스 연결 테스트
async def test_connection():
    """MongoDB 연결 테스트"""
    try:
        await async_client.admin.command('ping')
        logger.info("✅ MongoDB 연결 성공")
        return True
    except Exception as e:
        logger.error(f"❌ MongoDB 연결 실패: {e}")
        return False

async def diagnose_database():
    """MongoDB 데이터베이스 상태 진단"""
    try:
        print("🔍 [DIAGNOSE] MongoDB 데이터베이스 상태 진단 시작...")
        
        # 1. 연결 테스트
        connection_ok = await test_connection()
        print(f"📊 [DIAGNOSE] 연결 상태: {'✅ 성공' if connection_ok else '❌ 실패'}")
        
        if not connection_ok:
            return {"status": "connection_failed", "error": "MongoDB 연결 실패"}
        
        # 2. 데이터베이스 목록 확인
        try:
            db_list = await async_client.list_database_names()
            print(f"📊 [DIAGNOSE] 사용 가능한 데이터베이스: {db_list}")
        except Exception as e:
            print(f"❌ [DIAGNOSE] 데이터베이스 목록 조회 실패: {e}")
        
        # 3. 현재 데이터베이스 컬렉션 확인
        try:
            collections = await database.list_collection_names()
            print(f"📊 [DIAGNOSE] 현재 DB 컬렉션: {collections}")
        except Exception as e:
            print(f"❌ [DIAGNOSE] 컬렉션 목록 조회 실패: {e}")
        
        # 4. 사용자 컬렉션 상태 확인
        try:
            user_count = await users_collection.count_documents({})
            print(f"📊 [DIAGNOSE] 사용자 수: {user_count}")
            
            if user_count > 0:
                # 최근 사용자 3명 조회
                recent_users = await users_collection.find().sort("created_at", -1).limit(3).to_list(3)
                print(f"📊 [DIAGNOSE] 최근 사용자:")
                for user in recent_users:
                    print(f"  - ID: {user.get('_id')}, Email: {user.get('email')}, Created: {user.get('created_at')}")
        except Exception as e:
            print(f"❌ [DIAGNOSE] 사용자 컬렉션 조회 실패: {e}")
        
        # 5. 채팅 세션 컬렉션 상태 확인
        try:
            session_count = await chat_sessions_collection.count_documents({})
            print(f"📊 [DIAGNOSE] 채팅 세션 수: {session_count}")
        except Exception as e:
            print(f"❌ [DIAGNOSE] 채팅 세션 컬렉션 조회 실패: {e}")
        
        # 6. 채팅 메시지 컬렉션 상태 확인
        try:
            message_count = await chat_messages_collection.count_documents({})
            print(f"📊 [DIAGNOSE] 채팅 메시지 수: {message_count}")
        except Exception as e:
            print(f"❌ [DIAGNOSE] 채팅 메시지 컬렉션 조회 실패: {e}")
        
        print("✅ [DIAGNOSE] MongoDB 진단 완료")
        return {"status": "success", "connection": connection_ok}
        
    except Exception as e:
        print(f"❌ [DIAGNOSE] 진단 중 오류 발생: {e}")
        return {"status": "error", "error": str(e)}

# 사용자 관련 함수
async def create_user(user_data: Dict[str, Any]) -> Optional[str]:
    """새 사용자 생성"""
    try:
        user_data["created_at"] = datetime.utcnow()
        user_data["updated_at"] = datetime.utcnow()
        
        result = await users_collection.insert_one(user_data)
        logger.info(f"✅ 사용자 생성 완료: {result.inserted_id}")
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"❌ 사용자 생성 실패: {e}")
        return None

async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """이메일로 사용자 조회"""
    try:
        user = await users_collection.find_one({"email": email})
        return user
    except Exception as e:
        logger.error(f"❌ 사용자 조회 실패: {e}")
        return None

async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """ID로 사용자 조회"""
    try:
        from bson import ObjectId
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        return user
    except Exception as e:
        logger.error(f"❌ 사용자 조회 실패: {e}")
        return None

# 채팅 세션 관련 함수
async def create_chat_session(user_id: str, session_name: str = "새로운 대화") -> Optional[str]:
    """새 채팅 세션 생성"""
    print(f"🔍 [CREATE_SESSION] 세션 생성 시작 - user_id: {user_id}, session_name: {session_name}")
    
    try:
        from bson import ObjectId
        
        # Supabase UUID를 MongoDB ObjectId로 변환
        if len(user_id) == 36 and '-' in user_id:  # UUID 형식인지 확인
            print(f"🔄 [CREATE_SESSION] Supabase UUID 감지: {user_id}")
            mongo_user_id = supabase_uuid_to_objectid(user_id)
            print(f"✅ [CREATE_SESSION] MongoDB ObjectId로 변환: {mongo_user_id}")
        else:
            mongo_user_id = user_id
            print(f"ℹ️ [CREATE_SESSION] 기존 user_id 사용: {mongo_user_id}")
        
        session_data = {
            "user_id": ObjectId(mongo_user_id),
            "session_name": session_name,
            "created_at": datetime.utcnow(),
            "last_message_at": datetime.utcnow(),
            "message_count": 0,
            "is_active": True
        }
        
        print(f"🔄 [CREATE_SESSION] MongoDB Atlas에 세션 저장 중...")
        result = await chat_sessions_collection.insert_one(session_data)
        print(f"✅ [CREATE_SESSION] 세션 생성 성공: {result.inserted_id}")
        
        logger.info(f"✅ 채팅 세션 생성 완료: {result.inserted_id}")
        return str(result.inserted_id)
    except Exception as e:
        print(f"❌ [CREATE_SESSION] 오류 발생: {e}")
        logger.error(f"❌ 채팅 세션 생성 실패: {e}")
        return None

async def create_chat_session_with_persona(user_id: str, session_name: str, persona_info: Dict[str, Any]) -> Optional[str]:
    """페르소나 정보를 포함한 새 채팅 세션 생성"""
    print(f"🔍 [CREATE_SESSION_PERSONA] 세션 생성 시작 - user_id: {user_id}, session_name: {session_name}")
    print(f"👤 [CREATE_SESSION_PERSONA] 페르소나: {persona_info.get('persona_name', 'N/A')}")
    
    try:
        from bson import ObjectId
        
        # Supabase UUID를 MongoDB ObjectId로 변환
        if len(user_id) == 36 and '-' in user_id:  # UUID 형식인지 확인
            print(f"🔄 [CREATE_SESSION_PERSONA] Supabase UUID 감지: {user_id}")
            mongo_user_id = supabase_uuid_to_objectid(user_id)
            print(f"✅ [CREATE_SESSION_PERSONA] MongoDB ObjectId로 변환: {mongo_user_id}")
        else:
            mongo_user_id = user_id
            print(f"ℹ️ [CREATE_SESSION_PERSONA] 기존 user_id 사용: {mongo_user_id}")
        
        session_data = {
            "user_id": ObjectId(mongo_user_id),
            "session_name": session_name,
            "created_at": datetime.utcnow(),
            "last_message_at": datetime.utcnow(),
            "message_count": 0,
            "is_active": True,
            # 페르소나 정보 추가
            "persona_name": persona_info.get('persona_name'),
            "persona_age": persona_info.get('persona_age'),
            "persona_mbti": persona_info.get('persona_mbti'),
            "persona_job": persona_info.get('persona_job'),
            "persona_personality": persona_info.get('persona_personality'),
            "persona_image": persona_info.get('persona_image')
        }
        
        print(f"🔄 [CREATE_SESSION_PERSONA] MongoDB Atlas에 세션 저장 중...")
        result = await chat_sessions_collection.insert_one(session_data)
        print(f"✅ [CREATE_SESSION_PERSONA] 세션 생성 성공: {result.inserted_id}")
        
        logger.info(f"✅ 페르소나 포함 채팅 세션 생성 완료: {result.inserted_id}")
        return str(result.inserted_id)
    except Exception as e:
        print(f"❌ [CREATE_SESSION_PERSONA] 오류 발생: {e}")
        logger.error(f"❌ 페르소나 포함 채팅 세션 생성 실패: {e}")
        return None

async def get_user_sessions(user_id: str) -> List[Dict[str, Any]]:
    """사용자의 채팅 세션 목록 조회"""
    try:
        from bson import ObjectId
        
        # Supabase UUID를 MongoDB ObjectId로 변환
        if len(user_id) == 36 and '-' in user_id:  # UUID 형식인지 확인
            print(f"🔄 [GET_SESSIONS] Supabase UUID 감지: {user_id}")
            mongo_user_id = supabase_uuid_to_objectid(user_id)
            print(f"✅ [GET_SESSIONS] MongoDB ObjectId로 변환: {mongo_user_id}")
        else:
            mongo_user_id = user_id
            print(f"ℹ️ [GET_SESSIONS] 기존 user_id 사용: {mongo_user_id}")
        
        cursor = chat_sessions_collection.find(
            {"user_id": ObjectId(mongo_user_id)},
            {"_id": 1, "session_name": 1, "created_at": 1, "last_message_at": 1, "message_count": 1}
        ).sort("last_message_at", -1)
        
        sessions = await cursor.to_list(length=100)
        
        # ObjectId를 문자열로 변환
        for session in sessions:
            session["_id"] = str(session["_id"])
            session["user_id"] = str(session["user_id"])
        
        return sessions
    except Exception as e:
        logger.error(f"❌ 채팅 세션 조회 실패: {e}")
        return []

# 채팅 메시지 관련 함수
async def save_message(user_id: str, session_id: str, role: str, content: str) -> Optional[str]:
    """채팅 메시지 저장 (dys-chatbot.chat 컬렉션)"""
    print(f"🔍 [SAVE_MESSAGE] 저장 시작 - user_id: {user_id}, session_id: {session_id}, role: {role}")
    print(f"📝 [SAVE_MESSAGE] 메시지 내용: {content[:50]}...")
    
    try:
        from bson import ObjectId
        
        # session_id 유효성 검사
        if not session_id or session_id == "null":
            print(f"❌ [SAVE_MESSAGE] 유효하지 않은 session_id: {session_id}")
            return None
        
        # user_id 유효성 검사 및 기본값 생성
        if not user_id or user_id == "null" or len(user_id) < 12:
            print(f"⚠️ [SAVE_MESSAGE] 유효하지 않은 user_id: {user_id}")
            import hashlib
            import time
            # 타임스탬프 기반 고유 ID 생성
            unique_string = f"default_user_{int(time.time())}"
            user_id = hashlib.md5(unique_string.encode()).hexdigest()[:24]
            print(f"✅ [SAVE_MESSAGE] 기본 사용자 ID 생성: {user_id}")
        
        # Supabase UUID를 MongoDB ObjectId로 변환
        if len(user_id) == 36 and '-' in user_id:  # UUID 형식인지 확인
            print(f"🔄 [SAVE_MESSAGE] Supabase UUID 감지: {user_id}")
            mongo_user_id = supabase_uuid_to_objectid(user_id)
            print(f"✅ [SAVE_MESSAGE] MongoDB ObjectId로 변환: {mongo_user_id}")
        else:
            mongo_user_id = user_id
            print(f"ℹ️ [SAVE_MESSAGE] 기존 user_id 사용: {mongo_user_id}")
        
        message_data = {
            "user_id": ObjectId(mongo_user_id),
            "session_id": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow()
        }
        
        print(f"🔄 [SAVE_MESSAGE] MongoDB Atlas chat 컬렉션에 저장 중...")
        result = await chat_messages_collection.insert_one(message_data)
        print(f"✅ [SAVE_MESSAGE] 메시지 저장 성공: {result.inserted_id}")
        
        # 세션의 마지막 메시지 시간 및 메시지 수 업데이트
        print(f"🔄 [SAVE_MESSAGE] 세션 정보 업데이트 중...")
        try:
            await chat_sessions_collection.update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$set": {"last_message_at": datetime.utcnow()},
                    "$inc": {"message_count": 1}
                }
            )
            print(f"✅ [SAVE_MESSAGE] 세션 정보 업데이트 완료")
        except Exception as session_error:
            print(f"⚠️ [SAVE_MESSAGE] 세션 정보 업데이트 실패: {session_error}")
            # 세션 업데이트 실패해도 메시지 저장은 성공으로 처리
        
        logger.info(f"✅ 메시지 저장 완료: {result.inserted_id}")
        return str(result.inserted_id)
    except Exception as e:
        print(f"❌ [SAVE_MESSAGE] 오류 발생: {e}")
        logger.error(f"❌ 메시지 저장 실패: {e}")
        return None

async def get_session_messages(session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """세션의 메시지 목록 조회 (dys-chatbot.chat 컬렉션)"""
    try:
        from bson import ObjectId
        
        cursor = chat_messages_collection.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).limit(limit)
        
        messages = await cursor.to_list(length=limit)
        
        # ObjectId를 문자열로 변환
        for message in messages:
            message["_id"] = str(message["_id"])
            message["user_id"] = str(message["user_id"])
        
        return messages
    except Exception as e:
        logger.error(f"❌ 메시지 조회 실패: {e}")
        return []

async def get_session_info(session_id: str) -> Optional[Dict[str, Any]]:
    """세션 정보 조회 (페르소나 정보 포함)"""
    try:
        from bson import ObjectId
        
        session = await chat_sessions_collection.find_one({"_id": ObjectId(session_id)})
        
        if session:
            # ObjectId를 문자열로 변환
            session["_id"] = str(session["_id"])
            session["user_id"] = str(session["user_id"])
            logger.info(f"✅ 세션 정보 조회 성공: {session_id}")
            return session
        else:
            logger.warning(f"⚠️ 세션을 찾을 수 없음: {session_id}")
            return None
            
    except Exception as e:
        logger.error(f"❌ 세션 정보 조회 실패: {e}")
        return None

async def update_session_end_time(session_id: str, end_time: datetime = None) -> bool:
    """세션 종료 시간 업데이트"""
    try:
        from bson import ObjectId
        
        if end_time is None:
            end_time = datetime.utcnow()
        
        result = await chat_sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "end_time": end_time,
                    "is_active": False,
                    "updated_at": end_time
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ 세션 종료 시간 업데이트 완료: {session_id}")
            return True
        else:
            logger.warning(f"⚠️ 세션을 찾을 수 없음: {session_id}")
            return False
            
    except Exception as e:
        logger.error(f"❌ 세션 종료 시간 업데이트 실패: {e}")
        return False

# 초기화 함수
async def init_database():
    """데이터베이스 초기화"""
    logger.info("🔄 MongoDB Atlas 초기화 시작...")
    
    # 연결 테스트
    if not await test_connection():
        return False
    
    # 인덱스 생성
    create_indexes()
    
    logger.info("✅ MongoDB Atlas 초기화 완료")
    return True

# ====== 외부 사용을 위한 헬퍼 ======
async def get_database():
    """비동기 MongoDB 데이터베이스 핸들 반환"""
    return database

def get_sync_database():
    """동기 MongoDB 데이터베이스 핸들 반환 (인덱스/관리용)"""
    return sync_database

__all__ = [
    "database",
    "async_client",
    "sync_database",
    "get_database",
    "get_sync_database",
    "create_indexes",
    "init_database",
]
