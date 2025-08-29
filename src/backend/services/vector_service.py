#!/usr/bin/env python3
"""
벡터 데이터 관리 서비스
- MongoDB와 Pinecone 연동
- 텍스트 임베딩 생성 및 저장
- 벡터 검색 및 메타데이터 관리
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from openai import OpenAI

# 로컬 모듈 import
from ..database.pinecone_client import pinecone_client
from ..database.database import get_database

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VectorService:
    """벡터 데이터 관리 서비스"""
    
    def __init__(self):
        self.openai_client = None
        self.db = None
        self.is_initialized = False
        
        # OpenAI 설정
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.embedding_model = "text-embedding-3-small"  # 1536 차원
        
        logger.info("🔗 벡터 서비스 초기화됨")
    
    async def initialize(self) -> bool:
        """서비스 초기화"""
        try:
            # OpenAI 클라이언트 초기화
            if not self.openai_api_key:
                logger.warning("⚠️ OPENAI_API_KEY가 설정되지 않았습니다. 벡터 서비스가 제한적으로 동작합니다.")
                return False
            
            # 프록시 완전 차단 - OpenAI 환경변수도 정리
            logger.info("🔗 OpenAI 클라이언트 안전 초기화")
            
            # OpenAI 클라이언트 생성 전 모든 proxy 환경변수 임시 제거
            original_env = {}
            proxy_vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']
            
            for var in proxy_vars:
                if var in os.environ:
                    original_env[var] = os.environ.pop(var)
                    logger.info(f"   - {var} 임시 제거됨")
            
            try:
                self.openai_client = OpenAI(
                    api_key=self.openai_api_key,
                    timeout=60.0
                )
                logger.info("✅ OpenAI 클라이언트 안전 연결 완료")
                
            finally:
                # 환경변수 복원 (다른 시스템에 영향 방지)
                for var, value in original_env.items():
                    os.environ[var] = value
            
            # Pinecone 클라이언트 초기화
            if not pinecone_client.initialize():
                logger.error("❌ Pinecone 클라이언트 초기화 실패")
                return False
            
            # MongoDB 연결
            self.db = await get_database()
            
            self.is_initialized = True
            logger.info("✅ 벡터 서비스 초기화 완료")
            return True
            
        except Exception as e:
            logger.error(f"❌ 벡터 서비스 초기화 실패: {e}")
            return False
    
    async def create_embedding(self, text: str) -> Optional[List[float]]:
        """텍스트 임베딩 생성"""
        try:
            if not self.is_initialized:
                logger.error("❌ 벡터 서비스가 초기화되지 않았습니다")
                return None
            
            if not text or not text.strip():
                logger.warning("⚠️ 빈 텍스트입니다")
                return None
            
            # OpenAI 임베딩 생성
            response = self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=text.strip()
            )
            
            embedding = response.data[0].embedding
            logger.info(f"✅ 임베딩 생성 완료 (차원: {len(embedding)})")
            return embedding
            
        except Exception as e:
            logger.error(f"❌ 임베딩 생성 실패: {e}")
            return None
    
    async def store_text_with_embedding(self, 
                                      text: str, 
                                      content_type: str, 
                                      content_id: str,
                                      metadata: Optional[Dict[str, Any]] = None) -> bool:
        """텍스트와 임베딩을 저장"""
        try:
            if not self.is_initialized:
                logger.error("❌ 벡터 서비스가 초기화되지 않았습니다")
                return False
            
            # 임베딩 생성
            logger.info(f"🔄 [VECTOR_STORE] 임베딩 생성 시작 - 텍스트: '{text[:50]}...'")
            embedding = await self.create_embedding(text)
            if not embedding:
                logger.error("❌ [VECTOR_STORE] 임베딩 생성 실패")
                return False
            logger.info(f"✅ [VECTOR_STORE] 임베딩 생성 완료 - 차원: {len(embedding)}")
            
            # 메타데이터 준비
            if not metadata:
                metadata = {}
            
            metadata.update({
                "text": text,
                "content_type": content_type,
                "content_id": content_id,
                "created_at": datetime.now().isoformat(),
                "embedding_model": self.embedding_model
            })
            
            # 벡터 ID 생성
            vector_id = pinecone_client.create_embedding_id(content_type, content_id)
            
            # Pinecone에 벡터 저장
            vector_data = {
                "id": vector_id,
                "values": embedding,
                "metadata": metadata
            }
            
            logger.info(f"💾 [VECTOR_STORE] Pinecone 저장 시작 - ID: {vector_id}")
            if not pinecone_client.upsert_vectors([vector_data]):
                logger.error("❌ [VECTOR_STORE] Pinecone 벡터 저장 실패")
                return False
            logger.info(f"✅ [VECTOR_STORE] Pinecone 저장 완료 - ID: {vector_id}")
            
            # MongoDB에 메타데이터 저장
            collection = self.db.vector_embeddings
            document = {
                "vector_id": vector_id,
                "text": text,
                "content_type": content_type,
                "content_id": content_id,
                "metadata": metadata,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            await collection.update_one(
                {"vector_id": vector_id},
                {"$set": document},
                upsert=True
            )
            
            logger.info(f"✅ 텍스트 및 임베딩 저장 완료: {vector_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 텍스트 및 임베딩 저장 실패: {e}")
            return False
    
    async def search_similar_texts(self, 
                                 query_text: str, 
                                 content_type: Optional[str] = None,
                                 top_k: int = 10) -> List[Dict[str, Any]]:
        """유사한 텍스트 검색"""
        try:
            if not self.is_initialized:
                logger.error("❌ 벡터 서비스가 초기화되지 않았습니다")
                return []
            
            # 쿼리 임베딩 생성
            query_embedding = await self.create_embedding(query_text)
            if not query_embedding:
                return []
            
            # 필터 설정
            filter_dict = None
            if content_type:
                filter_dict = {"content_type": content_type}
            
            # Pinecone에서 유사한 벡터 검색
            search_results = pinecone_client.query_vectors(
                query_vector=query_embedding,
                top_k=top_k,
                filter_dict=filter_dict,
                include_metadata=True
            )
            
            # 결과 포맷팅
            formatted_results = []
            for result in search_results:
                formatted_result = {
                    "vector_id": result["id"],
                    "similarity_score": result["score"],
                    "text": result["metadata"].get("text", ""),
                    "content_type": result["metadata"].get("content_type", ""),
                    "content_id": result["metadata"].get("content_id", ""),
                    "metadata": result["metadata"]
                }
                formatted_results.append(formatted_result)
            
            logger.info(f"🔍 {len(formatted_results)}개 유사 텍스트 검색 완료")
            return formatted_results
            
        except Exception as e:
            logger.error(f"❌ 유사 텍스트 검색 실패: {e}")
            return []
    
    async def get_embedding_by_id(self, vector_id: str) -> Optional[Dict[str, Any]]:
        """벡터 ID로 임베딩 정보 조회"""
        try:
            if not self.is_initialized:
                logger.error("❌ 벡터 서비스가 초기화되지 않았습니다")
                return None
            
            # MongoDB에서 메타데이터 조회
            collection = self.db.vector_embeddings
            document = await collection.find_one({"vector_id": vector_id})
            
            if not document:
                logger.warning(f"⚠️ 벡터 ID를 찾을 수 없습니다: {vector_id}")
                return None
            
            return {
                "vector_id": document["vector_id"],
                "text": document["text"],
                "content_type": document["content_type"],
                "content_id": document["content_id"],
                "metadata": document["metadata"],
                "created_at": document["created_at"],
                "updated_at": document["updated_at"]
            }
            
        except Exception as e:
            logger.error(f"❌ 임베딩 조회 실패: {e}")
            return None
    
    async def delete_embedding(self, vector_id: str) -> bool:
        """임베딩 삭제"""
        try:
            if not self.is_initialized:
                logger.error("❌ 벡터 서비스가 초기화되지 않았습니다")
                return False
            
            # Pinecone에서 벡터 삭제
            if not pinecone_client.delete_vectors([vector_id]):
                logger.error("❌ Pinecone 벡터 삭제 실패")
                return False
            
            # MongoDB에서 메타데이터 삭제
            collection = self.db.vector_embeddings
            result = await collection.delete_one({"vector_id": vector_id})
            
            if result.deleted_count > 0:
                logger.info(f"✅ 임베딩 삭제 완료: {vector_id}")
                return True
            else:
                logger.warning(f"⚠️ 삭제할 임베딩을 찾을 수 없습니다: {vector_id}")
                return False
            
        except Exception as e:
            logger.error(f"❌ 임베딩 삭제 실패: {e}")
            return False
    
    async def get_embeddings_by_content_type(self, content_type: str, limit: int = 100) -> List[Dict[str, Any]]:
        """콘텐츠 타입별 임베딩 목록 조회"""
        try:
            if not self.is_initialized:
                logger.error("❌ 벡터 서비스가 초기화되지 않았습니다")
                return []
            
            collection = self.db.vector_embeddings
            cursor = collection.find(
                {"content_type": content_type},
                {"_id": 0}
            ).limit(limit).sort("created_at", -1)
            
            embeddings = await cursor.to_list(length=limit)
            
            logger.info(f"📋 {len(embeddings)}개 {content_type} 임베딩 조회 완료")
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ 임베딩 목록 조회 실패: {e}")
            return []
    
    async def get_statistics(self) -> Dict[str, Any]:
        """벡터 서비스 통계 조회"""
        try:
            if not self.is_initialized:
                return {"error": "서비스가 초기화되지 않았습니다"}
            
            # Pinecone 통계
            pinecone_stats = pinecone_client.get_index_stats()
            
            # MongoDB 통계
            collection = self.db.vector_embeddings
            total_count = await collection.count_documents({})
            
            # 콘텐츠 타입별 통계
            pipeline = [
                {"$group": {"_id": "$content_type", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            type_stats = await collection.aggregate(pipeline).to_list(length=None)
            
            return {
                "pinecone_stats": pinecone_stats,
                "mongodb_stats": {
                    "total_embeddings": total_count,
                    "content_type_distribution": type_stats
                },
                "embedding_model": self.embedding_model,
                "index_name": pinecone_client.index_name
            }
            
        except Exception as e:
            logger.error(f"❌ 통계 조회 실패: {e}")
            return {"error": str(e)}
    
    async def health_check(self) -> Dict[str, Any]:
        """헬스 체크"""
        try:
            if not self.is_initialized:
                return {
                    "status": "not_initialized",
                    "message": "벡터 서비스가 초기화되지 않았습니다"
                }
            
            # Pinecone 헬스 체크
            pinecone_health = pinecone_client.health_check()
            
            # MongoDB 연결 체크
            try:
                await self.db.command("ping")
                mongodb_status = "healthy"
            except Exception as e:
                mongodb_status = f"error: {str(e)}"
            
            return {
                "status": "healthy" if pinecone_health["status"] == "healthy" and mongodb_status == "healthy" else "error",
                "pinecone": pinecone_health,
                "mongodb": mongodb_status,
                "embedding_model": self.embedding_model
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
    
    async def cleanup(self):
        """리소스 정리"""
        try:
            pinecone_client.cleanup()
            self.is_initialized = False
            logger.info("🧹 벡터 서비스 정리 완료")
        except Exception as e:
            logger.error(f"❌ 벡터 서비스 정리 실패: {e}")

# 전역 인스턴스
vector_service = VectorService()

# 서비스 가용성 플래그
VECTOR_SERVICE_AVAILABLE = True
