"""
Voice Processor - 음성 처리 통합 모듈
STT와 연동되는 메인 인터페이스
"""

import time
import logging
from typing import Dict, List, Tuple, Optional, Any
import numpy as np

from .voice_analyzer import VoiceAnalyzer, VoiceToneAnalysis, WordChoiceAnalysis, VoiceAnalysisResult
from .voice_scorer import VoiceScorer, ScoringWeights

logger = logging.getLogger(__name__)

class VoiceProcessor:
    """음성 처리 통합 클래스 - STT와 연동"""
    
    def __init__(self, gpu_config: Optional[Dict] = None, weights: Optional[ScoringWeights] = None):
        self.analyzer = VoiceAnalyzer(gpu_config)
        self.scorer = VoiceScorer(weights)
        self.models_loaded = False
        
        logger.info("VoiceProcessor 초기화 완료")
    
    def load_models(self):
        """모든 모델 로드"""
        if not self.models_loaded:
            self.analyzer.load_models()
            self.models_loaded = True
            logger.info("모든 모델 로드 완료")
    
    def process_audio(
        self,
        audio_array: np.ndarray,
        sr: int = 16000,
        elapsed_sec: float = 0.0
    ) -> Dict[str, Any]:
        """
        오디오 배열을 입력받아 모든 분석을 수행하고 결과를 딕셔너리로 반환
        STT와 연동되는 메인 함수 (감정 단어 선택까지 완전 연결)
        
        Args:
            audio_array: 오디오 데이터 (numpy array)
            sr: 샘플링 레이트 (기본값: 16000)
            elapsed_sec: 경과 시간 (초) - 대화 맥락 분석용
            
        Returns:
            분석 결과 딕셔너리
        """
        start_time = time.time()
        
        try:
            # 모델 로드 확인
            if not self.models_loaded:
                self.load_models()
            
            # 오디오 품질 검사 (완화된 기준)
            quality = self.analyzer.check_audio_quality(audio_array, sr)
            logger.info(f"오디오 품질: RMS={quality['rms_level']:.6f}, "
                       f"Peak={quality['peak_level']:.6f}, "
                       f"Silence={quality['silence_ratio']:.1%}, "
                       f"Duration={quality['duration']:.2f}s")
            
            # 오디오 품질이 매우 나쁜 경우에만 거부 (기준 완화)
            if not quality['is_valid'] and quality['duration'] < 0.5:  # 0.5초 미만만 거부
                logger.warning(f"오디오 품질 문제: {quality['error_message']}")
                return self._create_fallback_result(quality['error_message'])
            
            # 1. 음성 인식 (STT) - 첫 번째 성공 모델 사용
            transcript = self.analyzer.transcribe_korean(audio_array)
            if not transcript:
                logger.warning("전사 결과가 없습니다. 기본값 사용")
                transcript = "음성 인식 실패"
            
            logger.info(f"✅ STT 전사 완료: '{transcript}'")
            
            # 2. 감정 분석 (키워드 기반)
            emotion_scores = self._analyze_emotion(audio_array, transcript)
            top_emotion, top_score = emotion_scores[0] if emotion_scores else ("중립", 1.0)
            
            logger.info(f"✅ 감정 분석 완료: {top_emotion} ({top_score:.2f})")
            
            # 3. 음성 톤 분석
            voice_tone = self.analyzer.analyze_voice_tone(audio_array, sr)
            
            logger.info(f"✅ 음성 톤 분석 완료: 따뜻함={voice_tone.warmth_score:.2f}, "
                       f"열정={voice_tone.enthusiasm_level:.2f}, "
                       f"자신감={voice_tone.confidence_level:.2f}")
            
            # 4. 단어 선택 분석 (전사 결과 기반) - 감정 단어 선택 포함
            word_choice = self.analyzer.analyze_word_choice(
                transcript, 
                elapsed_sec=elapsed_sec, 
                voice=voice_tone
            )
            
            logger.info(f"✅ 단어 선택 분석 완료: 긍정단어={len(word_choice.positive_words)}, "
                       f"부정단어={len(word_choice.negative_words)}, "
                       f"공손함={word_choice.politeness_score:.2f}, "
                       f"공감={word_choice.empathy_score:.2f}")
            
            # 5. 점수 계산
            detailed_scores = self.scorer.calculate_detailed_scores(
                voice_tone, word_choice, emotion_scores
            )
            
            logger.info(f"✅ 점수 계산 완료: 총점={detailed_scores['total_score']:.1f}, "
                       f"음성톤={detailed_scores['voice_tone_score']:.1f}, "
                       f"단어선택={detailed_scores['word_choice_score']:.1f}")
            
            # 6. 전체 분위기 판단
            overall_mood = self.scorer.determine_overall_mood(detailed_scores['total_score'])
            
            # 7. 근거 및 제안 생성
            evidence = self.scorer.generate_evidence(voice_tone, word_choice, emotion_scores)
            recommendations = self.scorer.generate_recommendations(voice_tone, word_choice, emotion_scores)
            
            # 8. 처리 시간 계산
            processing_time = time.time() - start_time
            
            # 9. 최종 결과 구성
            result = {
                # 기본 정보
                'transcript': transcript,
                'emotion': top_emotion,
                'emotion_score': top_score,
                'total_score': detailed_scores['total_score'],
                'overall_mood': overall_mood,
                
                # 상세 점수
                'voice_tone_score': detailed_scores['voice_tone_score'],
                'word_choice_score': detailed_scores['word_choice_score'],
                'emotion_score': detailed_scores['emotion_score'],
                
                # 상세 정보
                'voice_details': detailed_scores['voice_details'],
                'word_details': detailed_scores['word_details'],
                'weights': detailed_scores['weights'],
                
                # 단어 분석 결과
                'positive_words': detailed_scores['positive_words'],
                'negative_words': detailed_scores['negative_words'],
                
                # 분석 근거 및 제안
                'evidence': evidence,
                'recommendations': recommendations,
                
                # 메타 정보
                'processing_time': processing_time,
                'audio_quality': quality,
                'elapsed_sec': elapsed_sec
            }
            
            logger.info(f"음성 분석 완료: 총점={result['total_score']:.1f}, "
                       f"감정={result['emotion']}, "
                       f"처리시간={processing_time:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"음성 처리 중 오류 발생: {e}", exc_info=True)
            return self._create_fallback_result(f"처리 중 오류 발생: {str(e)}")
    
    def _analyze_emotion(self, audio_array: np.ndarray, transcript: str) -> List[Tuple[str, float]]:
        """감정 분석 (음성 + 텍스트 결합)"""
        try:
            # 텍스트가 있으면 키워드 기반 감정 분석 우선
            if transcript and transcript != "음성 인식 실패":
                emotion_scores = self.analyzer.classify_emotion_by_keywords(transcript)
                logger.info(f"키워드 기반 감정 분석: {emotion_scores}")
                return emotion_scores
            
            # 음성 감정 분석 (백업)
            audio_scores = self.analyzer.classify_emotion_audio(audio_array)
            logger.info(f"음성 기반 감정 분석: {audio_scores}")
            return audio_scores
            
        except Exception as e:
            logger.error(f"감정 분석 실패: {e}")
            return [("중립", 1.0)]
    
    def _create_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """오류 시 기본 결과 생성 (개선된 버전)"""
        # 오류 메시지에 따라 적절한 전사 텍스트 설정
        if "너무 조용함" in error_message or "너무 짧음" in error_message:
            transcript = "음성이 너무 작거나 짧습니다. 조금 더 크고 명확하게 말씀해주세요."
        elif "무음이 너무 많음" in error_message:
            transcript = "음성이 인식되지 않았습니다. 마이크에 더 가깝게 말씀해주세요."
        else:
            transcript = "음성 인식에 문제가 있었습니다. 다시 시도해주세요."
        
        return {
            'transcript': transcript,
            'emotion': '중립',
            'emotion_score': 1.0,
            'total_score': 55.0,  # 기본 점수 상향 조정
            'overall_mood': '보통',
            'voice_tone_score': 55.0,
            'word_choice_score': 55.0,
            'emotion_score': 55.0,
            'voice_details': {
                'warmth': 0.5, 'politeness': 0.5, 'consistency': 0.5,
                'enthusiasm': 0.5, 'confidence': 0.5, 'volume_strength': 0.5
            },
            'word_details': {
                'politeness': 0.5, 'empathy': 0.5, 'enthusiasm': 0.5, 'valence': 0.5
            },
            'weights': {'voice': 0.4, 'word': 0.4, 'emotion': 0.2},
            'positive_words': [],
            'negative_words': [],
            'evidence': {'오류': error_message},
            'recommendations': ['음성을 더 크고 명확하게 말씀해주세요', '마이크에 더 가깝게 말씀해주세요'],
            'processing_time': 0.0,
            'audio_quality': {
                'rms_level': 0.0, 'peak_level': 0.0, 'silence_ratio': 1.0,
                'duration': 0.0, 'sample_count': 0, 'is_valid': False,
                'error_message': error_message
            },
            'elapsed_sec': 0.0
        }
    
    def get_analysis_summary(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """분석 결과 요약 (UI 표시용)"""
        try:
            return {
                'transcript': result.get('transcript', ''),
                'emotion': result.get('emotion', '중립'),
                'total_score': result.get('total_score', 50.0),
                'overall_mood': result.get('overall_mood', '보통'),
                'voice_tone_score': result.get('voice_tone_score', 50.0),
                'word_choice_score': result.get('word_choice_score', 50.0),
                'processing_time': result.get('processing_time', 0.0),
                'audio_duration': result.get('audio_quality', {}).get('duration', 0.0)
            }
        except Exception as e:
            logger.error(f"요약 생성 실패: {e}")
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
    
    def get_detailed_analysis(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """상세 분석 결과 (팝업 표시용)"""
        try:
            return {
                'summary': self.get_analysis_summary(result),
                'voice_details': result.get('voice_details', {}),
                'word_details': result.get('word_details', {}),
                'evidence': result.get('evidence', {}),
                'recommendations': result.get('recommendations', []),
                'positive_words': result.get('positive_words', []),
                'negative_words': result.get('negative_words', []),
                'weights': result.get('weights', {}),
                'audio_quality': result.get('audio_quality', {})
            }
        except Exception as e:
            logger.error(f"상세 분석 생성 실패: {e}")
            return {
                'summary': self.get_analysis_summary(result),
                'voice_details': {},
                'word_details': {},
                'evidence': {'오류': '상세 분석 생성 실패'},
                'recommendations': ['분석을 다시 시도해보세요'],
                'positive_words': [],
                'negative_words': [],
                'weights': {'voice': 0.4, 'word': 0.4, 'emotion': 0.2},
                'audio_quality': {}
            }
    
    def is_ready(self) -> bool:
        """모델 로드 상태 확인"""
        return self.models_loaded and self.analyzer._models_loaded
    
    def get_model_status(self) -> Dict[str, Any]:
        """모델 상태 상세 확인"""
        return {
            'models_loaded': self.models_loaded,
            'analyzer_ready': self.analyzer._models_loaded,
            'stt_available': self.analyzer._stt_method != "none",
            'stt_method': self.analyzer._stt_method,
            'asr_model': self.analyzer._asr_model is not None,
            'audio_classifier': self.analyzer._audio_clf is not None
        }
