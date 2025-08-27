"""
Voice Scorer - 음성 점수 계산 모듈
음성 톤, 단어 선택, 감정을 종합하여 최종 점수 계산
"""

import logging
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass

from .voice_analyzer import VoiceToneAnalysis, WordChoiceAnalysis, VoiceAnalysisResult

logger = logging.getLogger(__name__)

@dataclass
class ScoringWeights:
    """점수 계산 가중치"""
    voice_tone: float = 0.4      # 음성 톤 40%
    word_choice: float = 0.4     # 단어 선택 40%
    emotion: float = 0.2         # 감정 20%

class VoiceScorer:
    """음성 점수 계산 클래스"""
    
    def __init__(self, weights: ScoringWeights = None):
        self.weights = weights or ScoringWeights()
        logger.info(f"VoiceScorer 초기화 - 가중치: 음성톤({self.weights.voice_tone}), 단어선택({self.weights.word_choice}), 감정({self.weights.emotion})")
    
    def calculate_voice_tone_score(self, voice_analysis: VoiceToneAnalysis) -> float:
        """음성 톤 점수 계산 (0-100)"""
        try:
            # 각 요소별 가중치
            warmth_weight = 0.25
            politeness_weight = 0.25
            consistency_weight = 0.15
            enthusiasm_weight = 0.15
            confidence_weight = 0.20
            
            # 점수 계산
            score = (
                voice_analysis.warmth_score * warmth_weight +
                voice_analysis.politeness_level * politeness_weight +
                voice_analysis.volume_consistency * consistency_weight +
                voice_analysis.enthusiasm_level * enthusiasm_weight +
                voice_analysis.confidence_level * confidence_weight
            ) * 100
            
            return max(0.0, min(100.0, score))
            
        except Exception as e:
            logger.error(f"음성 톤 점수 계산 실패: {e}")
            return 50.0
    
    def calculate_word_choice_score(self, word_analysis: WordChoiceAnalysis) -> float:
        """단어 선택 점수 계산 (0-100)"""
        try:
            # 각 요소별 가중치
            politeness_weight = 0.30
            empathy_weight = 0.30
            enthusiasm_weight = 0.15
            valence_weight = 0.25
            
            # 점수 계산
            score = (
                word_analysis.politeness_score * politeness_weight +
                word_analysis.empathy_score * empathy_weight +
                word_analysis.enthusiasm_score * enthusiasm_weight +
                word_analysis.valence_score * valence_weight
            ) * 100
            
            return max(0.0, min(100.0, score))
            
        except Exception as e:
            logger.error(f"단어 선택 점수 계산 실패: {e}")
            return 50.0
    
    def calculate_emotion_score(self, emotion_scores: List[Tuple[str, float]]) -> float:
        """감정 점수 계산 (0-100)"""
        try:
            emotion_dict = {emotion: score for emotion, score in emotion_scores}
            
            # 긍정적 감정
            positive_emotions = ["기쁨", "중립", "놀람"]
            negative_emotions = ["분노", "슬픔", "두려움", "혐오", "짜증", "귀찮음", "서운함", "억울함", "불안", "무심함"]
            
            positive_score = sum(emotion_dict.get(emotion, 0) for emotion in positive_emotions)
            negative_score = sum(emotion_dict.get(emotion, 0) for emotion in negative_emotions)
            
            # 감정 점수 계산 (긍정 - 부정*0.5)
            emotion_score = (positive_score - negative_score * 0.5) * 100
            return max(0.0, min(100.0, emotion_score))
            
        except Exception as e:
            logger.error(f"감정 점수 계산 실패: {e}")
            return 50.0
    
    def calculate_total_score(
        self,
        voice_tone: VoiceToneAnalysis,
        word_choice: WordChoiceAnalysis,
        emotion_scores: List[Tuple[str, float]]
    ) -> float:
        """종합 점수 계산 (0-100)"""
        try:
            # 각 영역별 점수 계산
            voice_tone_score = self.calculate_voice_tone_score(voice_tone)
            word_choice_score = self.calculate_word_choice_score(word_choice)
            emotion_score = self.calculate_emotion_score(emotion_scores)
            
            # 가중 평균으로 종합 점수 계산
            total_score = (
                voice_tone_score * self.weights.voice_tone +
                word_choice_score * self.weights.word_choice +
                emotion_score * self.weights.emotion
            )
            
            return max(0.0, min(100.0, total_score))
            
        except Exception as e:
            logger.error(f"종합 점수 계산 실패: {e}")
            return 50.0
    
    def determine_overall_mood(self, total_score: float) -> str:
        """전체 점수에 따른 분위기 판단"""
        if total_score >= 85:
            return "매우 좋음"
        elif total_score >= 70:
            return "좋음"
        elif total_score >= 50:
            return "보통"
        elif total_score >= 30:
            return "나쁨"
        else:
            return "매우 나쁨"
    
    def generate_evidence(
        self,
        voice_tone: VoiceToneAnalysis,
        word_choice: WordChoiceAnalysis,
        emotion_scores: List[Tuple[str, float]]
    ) -> Dict[str, str]:
        """점수 계산 근거 생성"""
        try:
            evidence = {}
            
            # 음성 톤 근거
            evidence["음성 톤"] = (
                f"따뜻함({voice_tone.warmth_score:.2f}), "
                f"공손함({voice_tone.politeness_level:.2f}), "
                f"일관성({voice_tone.volume_consistency:.2f}), "
                f"자신감({voice_tone.confidence_level:.2f})"
            )
            
            # 단어 선택 근거
            evidence["단어 선택"] = (
                f"공손함({word_choice.politeness_score:.2f}), "
                f"공감({word_choice.empathy_score:.2f}), "
                f"열정({word_choice.enthusiasm_score:.2f})"
            )
            
            # 감정 상태 근거
            emotion_dict = {emotion: score for emotion, score in emotion_scores}
            positive_emotions = ["기쁨", "중립", "놀람"]
            negative_emotions = ["분노", "슬픔", "두려움", "혐오", "짜증", "귀찮음", "서운함", "억울함", "불안", "무심함"]
            
            positive_score = sum(emotion_dict.get(emotion, 0) for emotion in positive_emotions)
            negative_score = sum(emotion_dict.get(emotion, 0) for emotion in negative_emotions)
            
            evidence["감정 상태"] = f"긍정적 감정({positive_score:.2f}), 부정적 감정({negative_score:.2f})"
            evidence["단어 정서 밸런스"] = f"valence={word_choice.valence_score:.2f}"
            
            # 구체적인 단어들
            evidence["긍정적 단어"] = ", ".join(word_choice.positive_words) if word_choice.positive_words else "없음"
            evidence["부정적 단어"] = ", ".join(word_choice.negative_words) if word_choice.negative_words else "없음"
            evidence["공손한 표현"] = ", ".join(word_choice.polite_phrases) if word_choice.polite_phrases else "없음"
            evidence["공감 표현"] = ", ".join(word_choice.empathy_indicators) if word_choice.empathy_indicators else "없음"
            evidence["열정 표현"] = ", ".join(word_choice.enthusiasm_indicators) if word_choice.enthusiasm_indicators else "없음"
            
            return evidence
            
        except Exception as e:
            logger.error(f"근거 생성 실패: {e}")
            return {"오류": "근거 생성 중 오류 발생"}
    
    def generate_recommendations(
        self,
        voice_tone: VoiceToneAnalysis,
        word_choice: WordChoiceAnalysis,
        emotion_scores: List[Tuple[str, float]]
    ) -> List[str]:
        """개선 제안 생성"""
        recommendations = []
        
        try:
            # 단어 선택 관련 제안
            if word_choice.valence_score < 0.5:
                recommendations.append("초반엔 부정 표현을 줄이고 중립/공감형 표현을 조금 더 사용해보세요")
            
            # 음성 톤 관련 제안
            if voice_tone.warmth_score < 0.6:
                recommendations.append("목소리를 더 따뜻하게 내보세요")
            
            if voice_tone.politeness_level < 0.6:
                recommendations.append("더 공손한 톤으로 말해보세요")
            
            if voice_tone.confidence_level < 0.6:
                recommendations.append("목소리에 자신감을 넣어보세요")
            
            if voice_tone.volume_strength < 0.4:
                recommendations.append("목소리를 더 크고 힘있게 내보세요")
            
            # 단어 선택 관련 제안
            if word_choice.politeness_score < 0.5:
                recommendations.append("더 공손한 표현을 사용해보세요")
            
            if word_choice.empathy_score < 0.5:
                recommendations.append("상대방의 감정에 공감하는 표현을 더 사용해보세요")
            
            # 감정 관련 제안
            emotion_dict = {emotion: score for emotion, score in emotion_scores}
            negative_emotions = ["분노", "슬픔", "두려움", "혐오", "짜증", "귀찮음", "서운함", "억울함", "불안", "무심함"]
            negative_score = sum(emotion_dict.get(emotion, 0) for emotion in negative_emotions)
            
            if negative_score > 0.3:
                recommendations.append("부정적인 감정을 줄이고 긍정적인 감정을 표현해보세요")
            
            # 긍정적인 피드백
            if not recommendations:
                recommendations.append("현재 상태가 매우 좋습니다! 계속 유지해보세요")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"제안 생성 실패: {e}")
            return ["분석 중 오류가 발생했습니다. 다시 시도해보세요."]
    
    def calculate_detailed_scores(
        self,
        voice_tone: VoiceToneAnalysis,
        word_choice: WordChoiceAnalysis,
        emotion_scores: List[Tuple[str, float]]
    ) -> Dict[str, Any]:
        """상세 점수 계산 (UI용)"""
        try:
            # 각 영역별 점수
            voice_tone_score = self.calculate_voice_tone_score(voice_tone)
            word_choice_score = self.calculate_word_choice_score(word_choice)
            emotion_score = self.calculate_emotion_score(emotion_scores)
            total_score = self.calculate_total_score(voice_tone, word_choice, emotion_scores)
            
            # 음성 톤 상세 정보
            voice_details = {
                "warmth": voice_tone.warmth_score,
                "politeness": voice_tone.politeness_level,
                "consistency": voice_tone.volume_consistency,
                "enthusiasm": voice_tone.enthusiasm_level,
                "confidence": voice_tone.confidence_level,
                "volume_strength": voice_tone.volume_strength
            }
            
            # 단어 선택 상세 정보
            word_details = {
                "politeness": word_choice.politeness_score,
                "empathy": word_choice.empathy_score,
                "enthusiasm": word_choice.enthusiasm_score,
                "valence": word_choice.valence_score
            }
            
            # 가중치 정보
            weights = {
                "voice": self.weights.voice_tone,
                "word": self.weights.word_choice,
                "emotion": self.weights.emotion
            }
            
            return {
                "total_score": total_score,
                "voice_tone_score": voice_tone_score,
                "word_choice_score": word_choice_score,
                "emotion_score": emotion_score,
                "voice_details": voice_details,
                "word_details": word_details,
                "weights": weights,
                "positive_words": word_choice.positive_words,
                "negative_words": word_choice.negative_words
            }
            
        except Exception as e:
            logger.error(f"상세 점수 계산 실패: {e}")
            return {
                "total_score": 50.0,
                "voice_tone_score": 50.0,
                "word_choice_score": 50.0,
                "emotion_score": 50.0,
                "voice_details": {},
                "word_details": {},
                "weights": {"voice": 0.4, "word": 0.4, "emotion": 0.2},
                "positive_words": [],
                "negative_words": []
            }
