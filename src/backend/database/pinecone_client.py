#!/usr/bin/env python3
"""
Pinecone Vector Database 클라이언트
- 벡터 데이터 저장 및 검색
- MongoDB와 연동하여 메타데이터 관리
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import pinecone
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PineconeClient:
    """Pinecone Vector Database 클라이언트"""
    
    def __init__(self):
        self.index = None
        self.index_name = "deyeonso"
        self.dimension = 1024  # llama-text-embed-v2 모델의 차원
        self.metric = "cosine"
        self.is_initialized = False
        
        # Pinecone 설정
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.environment = os.getenv("PINECONE_ENVIRONMENT", "gcp-starter")
        self.host = os.getenv("PINECONE_HOST", "https://deyeonso-if637zn.svc.aped-4627-b74a.pinecone.io")
        
        logger.info("🎯 Pinecone 클라이언트 초기화됨")
    
    def initialize(self) -> bool:
        """Pinecone 클라이언트 초기화"""
        try:
            if not self.api_key:
                logger.warning("⚠️ PINECONE_API_KEY가 설정되지 않았습니다. Pinecone 기능이 비활성화됩니다.")
                return False
            
            # Pinecone 초기화
            pinecone.init(
                api_key=self.api_key,
                environment=self.environment
            )
            
            # 인덱스 확인 및 생성
            if self.index_name not in pinecone.list_indexes():
                logger.info(f"🔄 인덱스 '{self.index_name}' 생성 중...")
                pinecone.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric=self.metric,
                    spec=pinecone.ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
                logger.info(f"✅ 인덱스 '{self.index_name}' 생성 완료")
            else:
                logger.info(f"✅ 인덱스 '{self.index_name}' 이미 존재함")
            
            # 인덱스 연결
            self.index = pinecone.Index(self.index_name)
            self.is_initialized = True
            
            # 인덱스 통계 확인
            stats = self.index.describe_index_stats()
            logger.info(f"📊 인덱스 통계: {stats}")
            
            logger.info("✅ Pinecone 클라이언트 초기화 완료")
            return True
            
        except Exception as e:
            logger.error(f"❌ Pinecone 초기화 실패: {e}")
            return False
    
    def upsert_vectors(self, vectors: List[Dict[str, Any]]) -> bool:
        """벡터 데이터 업서트 (삽입 또는 업데이트)"""
        try:
            if not self.is_initialized:
                logger.error("❌ Pinecone 클라이언트가 초기화되지 않았습니다")
                return False
            
            if not vectors:
                logger.warning("⚠️ 업서트할 벡터가 없습니다")
                return True
            
            # 벡터 데이터 형식 변환
            upsert_data = []
            for vector_data in vectors:
                vector_id = vector_data.get("id")
                vector_values = vector_data.get("values")
                metadata = vector_data.get("metadata", {})
                
                if not vector_id or not vector_values:
                    logger.warning(f"⚠️ 잘못된 벡터 데이터: {vector_data}")
                    continue
                
                upsert_data.append({
                    "id": vector_id,
                    "values": vector_values,
                    "metadata": metadata
                })
            
            if upsert_data:
                self.index.upsert(vectors=upsert_data)
                logger.info(f"✅ {len(upsert_data)}개 벡터 업서트 완료")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 벡터 업서트 실패: {e}")
            return False
    
    def query_vectors(self, 
                     query_vector: List[float], 
                     top_k: int = 10, 
                     filter_dict: Optional[Dict[str, Any]] = None,
                     include_metadata: bool = True) -> List[Dict[str, Any]]:
        """벡터 검색"""
        try:
            if not self.is_initialized:
                logger.error("❌ Pinecone 클라이언트가 초기화되지 않았습니다")
                return []
            
            # 검색 쿼리 실행
            query_response = self.index.query(
                vector=query_vector,
                top_k=top_k,
                filter=filter_dict,
                include_metadata=include_metadata
            )
            
            # 결과 변환
            results = []
            for match in query_response.matches:
                result = {
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata
                }
                results.append(result)
            
            logger.info(f"🔍 {len(results)}개 검색 결과 반환")
            return results
            
        except Exception as e:
            logger.error(f"❌ 벡터 검색 실패: {e}")
            return []
    
    def delete_vectors(self, vector_ids: List[str]) -> bool:
        """벡터 삭제"""
        try:
            if not self.is_initialized:
                logger.error("❌ Pinecone 클라이언트가 초기화되지 않았습니다")
                return False
            
            if not vector_ids:
                logger.warning("⚠️ 삭제할 벡터 ID가 없습니다")
                return True
            
            self.index.delete(ids=vector_ids)
            logger.info(f"🗑️ {len(vector_ids)}개 벡터 삭제 완료")
            return True
            
        except Exception as e:
            logger.error(f"❌ 벡터 삭제 실패: {e}")
            return False
    
    def get_index_stats(self) -> Dict[str, Any]:
        """인덱스 통계 조회"""
        try:
            if not self.is_initialized:
                logger.error("❌ Pinecone 클라이언트가 초기화되지 않았습니다")
                return {}
            
            stats = self.index.describe_index_stats()
            return {
                "total_vector_count": stats.total_vector_count,
                "dimension": stats.dimension,
                "index_fullness": stats.index_fullness,
                "namespaces": stats.namespaces
            }
            
        except Exception as e:
            logger.error(f"❌ 인덱스 통계 조회 실패: {e}")
            return {}
    
    def create_embedding_id(self, content_type: str, content_id: str, timestamp: Optional[str] = None) -> str:
        """임베딩 ID 생성"""
        if not timestamp:
            timestamp = datetime.now().isoformat()
        
        return f"{content_type}:{content_id}:{timestamp}"
    
    def extract_metadata_from_id(self, embedding_id: str) -> Dict[str, str]:
        """임베딩 ID에서 메타데이터 추출"""
        try:
            parts = embedding_id.split(":")
            if len(parts) >= 3:
                return {
                    "content_type": parts[0],
                    "content_id": parts[1],
                    "timestamp": parts[2]
                }
            return {}
        except Exception as e:
            logger.error(f"❌ 메타데이터 추출 실패: {e}")
            return {}
    
    def health_check(self) -> Dict[str, Any]:
        """헬스 체크"""
        try:
            if not self.is_initialized:
                return {
                    "status": "not_initialized",
                    "message": "Pinecone 클라이언트가 초기화되지 않았습니다"
                }
            
            stats = self.get_index_stats()
            return {
                "status": "healthy",
                "index_name": self.index_name,
                "dimension": self.dimension,
                "metric": self.metric,
                "stats": stats,
                "host": self.host
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
    
    def cleanup(self):
        """리소스 정리"""
        try:
            if self.index:
                self.index = None
            self.is_initialized = False
            logger.info("🧹 Pinecone 클라이언트 정리 완료")
        except Exception as e:
            logger.error(f"❌ Pinecone 클라이언트 정리 실패: {e}")

# 전역 인스턴스
pinecone_client = PineconeClient()
