"""
Voice API - STT와 연동되는 API 인터페이스
기존 voice_input.py의 process_audio_simple 함수를 대체
"""

import logging
from typing import Dict, Any, Optional
import numpy as np

from .voice_processor import VoiceProcessor
from .voice_scorer import ScoringWeights

logger = logging.getLogger(__name__)

# 전역 VoiceProcessor 인스턴스
_voice_processor: Optional[VoiceProcessor] = None

def initialize_voice_processor(gpu_config: Optional[Dict] = None, weights: Optional[ScoringWeights] = None):
    """VoiceProcessor 초기화"""
    global _voice_processor
    
    if _voice_processor is None:
        _voice_processor = VoiceProcessor(gpu_config, weights)
        logger.info("VoiceProcessor 초기화 완료")
    
    return _voice_processor

def get_voice_processor() -> VoiceProcessor:
    """VoiceProcessor 인스턴스 반환"""
    global _voice_processor
    
    if _voice_processor is None:
        logger.warning("VoiceProcessor가 초기화되지 않았습니다. 자동 초기화합니다.")
        initialize_voice_processor()
    
    return _voice_processor

def process_audio_simple(audio_array: np.ndarray, sr: int = 16000, elapsed_sec: float = 0.0) -> Dict[str, Any]:
    """
    기존 voice_input.py의 process_audio_simple 함수를 대체하는 새로운 함수
    STT와 연동되는 통합 음성 분석
    
    Args:
        audio_array: 오디오 데이터 (numpy array)
        sr: 샘플링 레이트 (기본값: 16000)
        elapsed_sec: 경과 시간 (초) - 대화 맥락 분석용
        
    Returns:
        분석 결과 딕셔너리 (기존 형식과 호환)
    """
    try:
        processor = get_voice_processor()
        
        # 음성 분석 실행
        result = processor.process_audio(audio_array, sr, elapsed_sec)
        
        # 기존 형식과 호환되도록 결과 변환
        return {
            'transcript': result.get('transcript', ''),
            'emotion': result.get('emotion', '중립'),
            'emotion_score': result.get('emotion_score', 1.0),
            'total_score': result.get('total_score', 50.0),
            'voice_tone_score': result.get('voice_tone_score', 50.0),
            'voice_details': result.get('voice_details', {}),
            'word_choice_score': result.get('word_choice_score', 50.0),
            'word_details': result.get('word_details', {}),
            'weights': result.get('weights', {}),
            'positive_words': result.get('positive_words', []),
            'negative_words': result.get('negative_words', [])
        }
        
    except Exception as e:
        logger.error(f"process_audio_simple 오류: {e}", exc_info=True)
        # 오류 시 기본값 반환
        return {
            'transcript': '처리 중 오류 발생',
            'emotion': '중립',
            'emotion_score': 1.0,
            'total_score': 50.0,
            'voice_tone_score': 50.0,
            'voice_details': {},
            'word_choice_score': 50.0,
            'word_details': {},
            'weights': {'voice': 0.4, 'word': 0.4, 'emotion': 0.2},
            'positive_words': [],
            'negative_words': []
        }

def analyze_voice_with_context(
    audio_array: np.ndarray, 
    sr: int = 16000, 
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    맥락 정보를 포함한 음성 분석
    
    Args:
        audio_array: 오디오 데이터
        sr: 샘플링 레이트
        context: 맥락 정보 (대화 시작 시간, 이전 분석 결과 등)
        
    Returns:
        맥락을 고려한 분석 결과
    """
    try:
        processor = get_voice_processor()
        
        # 맥락 정보 추출
        elapsed_sec = 0.0
        if context:
            elapsed_sec = context.get('elapsed_sec', 0.0)
        
        # 음성 분석 실행
        result = processor.process_audio(audio_array, sr, elapsed_sec)
        
        # 맥락 정보 추가
        if context:
            result['context'] = context
        
        return result
        
    except Exception as e:
        logger.error(f"analyze_voice_with_context 오류: {e}", exc_info=True)
        return process_audio_simple(audio_array, sr)

def get_voice_analysis_summary(audio_array: np.ndarray, sr: int = 16000) -> Dict[str, Any]:
    """음성 분석 결과 요약 (UI 표시용)"""
    try:
        processor = get_voice_processor()
        result = processor.process_audio(audio_array, sr)
        return processor.get_analysis_summary(result)
        
    except Exception as e:
        logger.error(f"get_voice_analysis_summary 오류: {e}", exc_info=True)
        return {
            'transcript': '분석 실패',
            'emotion': '중립',
            'total_score': 50.0,
            'overall_mood': '보통',
            'voice_tone_score': 50.0,
            'word_choice_score': 50.0,
            'processing_time': 0.0,
            'audio_duration': 0.0
        }

def get_voice_detailed_analysis(audio_array: np.ndarray, sr: int = 16000) -> Dict[str, Any]:
    """상세 음성 분석 결과 (팝업 표시용)"""
    try:
        processor = get_voice_processor()
        result = processor.process_audio(audio_array, sr)
        return processor.get_detailed_analysis(result)
        
    except Exception as e:
        logger.error(f"get_voice_detailed_analysis 오류: {e}", exc_info=True)
        return {
            'summary': get_voice_analysis_summary(audio_array, sr),
            'voice_details': {},
            'word_details': {},
            'evidence': {'오류': '상세 분석 실패'},
            'recommendations': ['분석을 다시 시도해보세요'],
            'positive_words': [],
            'negative_words': [],
            'weights': {'voice': 0.4, 'word': 0.4, 'emotion': 0.2},
            'audio_quality': {}
        }

def is_voice_processor_ready() -> bool:
    """VoiceProcessor 준비 상태 확인"""
    try:
        processor = get_voice_processor()
        return processor.is_ready()
    except Exception as e:
        logger.error(f"VoiceProcessor 상태 확인 오류: {e}")
        return False

def get_voice_model_status() -> Dict[str, bool]:
    """모델 상태 확인"""
    try:
        processor = get_voice_processor()
        return processor.get_model_status()
    except Exception as e:
        logger.error(f"모델 상태 확인 오류: {e}")
        return {
            'asr_model': False,
            'audio_classifier': False,
            'models_loaded': False
        }

def preload_voice_models():
    """모델 사전 로드"""
    try:
        processor = get_voice_processor()
        processor.load_models()
        logger.info("음성 분석 모델 사전 로드 완료")
        return True
    except Exception as e:
        logger.error(f"모델 사전 로드 오류: {e}")
        return False

# 기존 voice_input.py와의 호환성을 위한 별칭
def preload_models():
    """기존 preload_models 함수와 호환"""
    return preload_voice_models()

# 모듈 초기화 시 자동으로 VoiceProcessor 생성
initialize_voice_processor()
