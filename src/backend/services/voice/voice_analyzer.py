"""
Voice Analyzer - 음성 분석 핵심 모듈
3개 파일(voice_input.py, simple_mic_test.py, infer_emotion.py)의 로직을 종합
"""

import os
import sys
import logging
import json
import time
import threading
import queue
from typing import Tuple, Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import torch
import torchaudio
from faster_whisper import WhisperModel

# Transformers는 선택적으로 import
try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("⚠️ Transformers 라이브러리 없음 - 키워드 기반 감정 분석 사용")

# OpenAI API 대안 추가
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# faster-whisper 시도 (libctranslate2 오류 방지)
FASTER_WHISPER_AVAILABLE = False
try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
    print("✅ faster-whisper 모듈 로드 성공")
except ImportError as e:
    print(f"⚠️ faster-whisper 로드 실패: {e}")
    FASTER_WHISPER_AVAILABLE = False
except Exception as e:
    if "libctranslate2" in str(e).lower():
        print("⚠️ libctranslate2 오류로 인해 faster-whisper 비활성화")
        FASTER_WHISPER_AVAILABLE = False
    else:
        print(f"⚠️ faster-whisper 로드 실패: {e}")
        FASTER_WHISPER_AVAILABLE = False

# transformers 라이브러리 확인
try:
    from transformers import pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/tmp/voice_analysis.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 상수 정의
TARGET_SR = 16000  # 오디오 샘플링 레이트 (16kHz)

# 감정 레이블 매핑 (영어 -> 한국어)
AUDIO_LABEL_MAP = {
    "angry": "분노", "calm": "중립", "disgust": "혐오", "fearful": "두려움",
    "happy": "기쁨", "neutral": "중립", "sad": "슬픔", "surprise": "놀람"
}

# 한국어 감정 레이블
KOREAN_EMOTION_LABELS = [
    "기쁨", "슬픔", "분노", "중립", "두려움", "혐오", "놀람",
    "짜증", "귀찮음", "서운함", "억울함", "불안", "무심함"
]

# 긍정적 단어 사전 (데이트/공감형성용)
POSITIVE_DATING_WORDS = {
    "좋아": 0.8, "좋은": 0.8, "좋다": 0.8, "좋네": 0.8, "좋아요": 0.9,
    "감사": 0.9, "고마워": 0.9, "고마워요": 0.9, "감사해": 0.9, "감사합니다": 1.0,
    "행복": 0.9, "즐거워": 0.8, "즐거운": 0.8, "재미있": 0.8, "재밌": 0.8,
    "사랑": 1.0, "사랑해": 1.0, "사랑해요": 1.0, "사랑스러워": 1.0,
    "예쁘": 0.9, "아름다운": 0.9, "멋있": 0.8, "멋진": 0.8, "훌륭": 0.8,
    "완벽": 0.9, "완벽해": 0.9, "완벽한": 0.9, "최고": 0.9, "최고야": 0.9,
    "특별": 0.8, "특별한": 0.8, "특별해": 0.8, "소중": 0.9, "소중한": 0.9,
    "기쁘": 0.8, "기뻐": 0.8, "기뻐요": 0.8, "신나": 0.7, "신나요": 0.7,
    "괜찮": 0.6, "괜찮아": 0.6, "괜찮아요": 0.6, "괜찮은": 0.6,
    "맞아": 0.7, "맞아요": 0.7, "그래": 0.6, "그래요": 0.6, "네": 0.5,
    "응": 0.4, "어": 0.3, "음": 0.2, "그렇": 0.6, "그렇네": 0.6,
    "정말": 0.7, "진짜": 0.7, "너무": 0.6, "매우": 0.7, "정말로": 0.8,
    "~네요": 0.3, "~어요": 0.3, "~아요": 0.3, "~입니다": 0.4, "~습니다": 0.4,
    "환영": 0.8, "환영해": 0.8, "환영합니다": 0.9,
    "반가워": 0.8, "반갑습니다": 0.9,
    "칭찬": 0.8, "대단해": 0.9, "멋져": 0.8, "놀라워": 0.9,
    "자랑스러워": 0.9, "믿음직": 0.8,
    "든든해": 0.8, "행운": 0.8, "축하": 0.9, "축하해": 0.9, "축하합니다": 1.0,
    "편안": 0.7, "안심": 0.7, "따뜻": 0.8, "든든": 0.8,
    "긍정적": 0.8, "활기찬": 0.8, "밝은": 0.8, "용기": 0.8, "희망": 0.9
}

# 부정적 단어 사전
NEGATIVE_DATING_WORDS = {
    "싫어": -0.8, "싫은": -0.8, "싫다": -0.8, "싫네": -0.8, "싫어요": -0.9,
    "화나": -0.9, "화나요": -0.9, "화가": -0.9, "짜증": -0.8, "짜증나": -0.8,
    "귀찮": -0.7, "귀찮아": -0.7, "귀찮은": -0.7, "지겨워": -0.7, "지겨운": -0.7,
    "답답": -0.6, "답답해": -0.6, "답답한": -0.6, "힘들": -0.6, "힘들어": -0.6,
    "어려워": -0.5, "어려운": -0.5, "복잡": -0.4, "복잡해": -0.4, "복잡한": -0.4,
    "아프": -0.6, "아파": -0.6, "아픈": -0.6, "피곤": -0.5, "피곤해": -0.5,
    "지치": -0.5, "지쳐": -0.5, "지친": -0.5, "스트레스": -0.6, "스트레스받": -0.6,
    "불안": -0.7, "불안해": -0.7, "불안한": -0.7, "걱정": -0.6, "걱정돼": -0.6,
    "슬퍼": -0.7, "슬픈": -0.7, "우울": -0.7, "우울해": -0.7, "우울한": -0.7,
    "무서워": -0.6, "무서운": -0.6, "두려워": -0.6, "두려운": -0.6,
    "~지마": -0.5, "~하지마": -0.5, "~마": -0.4, "~지 말고": -0.3,
    "짜증스러워": -0.8, "불편": -0.6, "불편해": -0.6,
    "싫증": -0.7, "지루해": -0.6, "지루한": -0.6,
    "후회": -0.7, "후회해": -0.7,
    "실망": -0.7, "실망했어": -0.7, "실망이야": -0.7,
    "괴로워": -0.7, "괴로운": -0.7,
    "짜증스럽다": -0.8, "힘겨워": -0.7, "불행": -0.8,
    "외로워": -0.6, "외로운": -0.6,
    "차갑": -0.5, "냉정": -0.6, "싫증나": -0.6
}

# 공손한 표현 사전
POLITE_PHRASES = [
    "감사합니다", "고맙습니다", "죄송합니다", "미안합니다", "실례합니다",
    "부탁드립니다", "부탁합니다", "도와주세요", "알려주세요", "가르쳐주세요",
    "~해주세요", "~해주시면", "~해주시는", "~해주셔서", "~해주신",
    "~시겠어요", "~시겠습니까", "~시는군요", "~시는구나", "~시는지",
    "정중히", "실례지만", "양해 부탁드립니다", "수고하셨습니다",
    "고생하셨습니다", "정말 감사합니다", "진심으로 감사드립니다",
    "부탁드려요", "감사드려요", "도움 주셔서 감사합니다",
    "도와주셔서 감사합니다", "감사 인사드립니다"
]

# 공감 표현 사전
EMPATHY_INDICATORS = [
    "그렇구나", "그런가봐", "그런 것 같아", "이해해", "이해가 돼",
    "공감해", "공감이 돼", "같은 생각이야", "나도 그래", "나도 그랬어",
    "힘들었겠다", "어려웠겠다", "괜찮을 거야", "괜찮아질 거야", "잘 될 거야",
    "도움이 될까", "무엇을 도와줄까", "어떻게 하면 좋을까", "어떻게 생각해",
    "어떻게 느껴", "어떤 기분이야", "어떤 생각이야",
    "고생 많았어", "고생했겠다", "속상했겠다", "속상했을 것 같아",
    "마음 아팠겠다", "걱정 많았겠다", "걱정했지", "얼마나 힘들었을까",
    "많이 힘들었겠다", "그럴 수도 있겠다", "충분히 이해해", "나도 느껴",
    "나도 겪어봤어", "네 입장 이해해", "네 기분 이해해",
    "괜찮아 괜찮아", "너 잘하고 있어", "고마워 그런 얘기해줘서"
]

# 열정 표현 사전
ENTHUSIASM_INDICATORS = [
    "와!", "우와!", "대박!", "진짜?", "정말?", "와우!", "놀라워!",
    "신기해!", "멋져!", "완벽해!", "최고야!", "특별해!", "소중해!",
    "기뻐!", "신나!", "즐거워!", "재밌어!", "재미있어!", "행복해!",
    "사랑해!", "예뻐!", "아름다워!", "훌륭해!", "완벽해!", "최고야!",
    "굉장해!", "엄청나!", "환상적이야!", "믿을 수 없어!", "쩔어!",
    "끝내줘!", "흥미진진해!", "놀랍다!", "감동이야!", "최강이야!",
    "완전 멋져!", "레전드야!", "압도적이야!", "죽여준다!", "최상급이야!",
    "열광적이야!", "짜릿해!", "짱이야!", "완전 좋아!", "좋아 죽겠다!"
]

@dataclass
class VoiceToneAnalysis:
    """음성 톤 분석 결과"""
    pitch_variation: float      # 0-1, 높을수록 표현력 풍부
    speaking_speed: float       # 초당 단어 수
    volume_consistency: float   # 0-1, 높을수록 안정적
    warmth_score: float         # 0-1, 높을수록 따뜻함
    enthusiasm_level: float     # 0-1, 높을수록 열정적
    politeness_level: float     # 0-1, 높을수록 공손함
    confidence_level: float     # 0-1, 높을수록 자신감
    volume_strength: float      # 0-1, 높을수록 강한 볼륨

@dataclass
class WordChoiceAnalysis:
    """단어 선택 분석 결과"""
    positive_words: List[str]
    negative_words: List[str]
    polite_phrases: List[str]
    empathy_indicators: List[str]
    enthusiasm_indicators: List[str]
    politeness_score: float     # 0-1
    empathy_score: float        # 0-1
    enthusiasm_score: float     # 0-1
    valence_score: float        # 0-1, 맥락/시간/톤 반영한 정서 점수

@dataclass
class VoiceAnalysisResult:
    """음성 분석 종합 결과"""
    transcript: str
    emotion: str
    emotion_score: float
    voice_tone: VoiceToneAnalysis
    word_choice: WordChoiceAnalysis
    total_score: float
    voice_tone_score: float
    word_choice_score: float
    overall_mood: str
    evidence: Dict[str, str]
    recommendations: List[str]
    processing_time: float
    audio_quality: Dict[str, Any]

class VoiceAnalyzer:
    """음성 분석 핵심 클래스"""
    
    def __init__(self, gpu_config: Optional[Dict] = None):
        self.gpu_config = gpu_config or self._detect_gpu_config()
        self._asr_model: Optional[WhisperModel] = None
        self._nli_tokenizer = None
        self._nli_model = None
        self._audio_clf = None
        self._models_loaded = False
        
        logger.info(f"VoiceAnalyzer 초기화 - GPU 설정: {self.gpu_config['name']}")
    
    def _detect_gpu_config(self) -> Dict:
        """GPU 설정 자동 감지"""
        if not torch.cuda.is_available():
            return {
                "name": "CPU",
                "memory_gb": 0,
                "asr_model_size": "small",
                "asr_compute_type": "int8",
                "nli_model_id": "joeddav/xlm-roberta-large-xnli",
                "max_seconds": 20,
                "batch_size": 1
            }
        
        gpu_name = torch.cuda.get_device_name(0).lower()
        memory_gb = torch.cuda.get_device_properties(0).total_memory // (1024**3)
        
        if "4080" in gpu_name or memory_gb >= 16:
            return {
                "name": "RTX 4080 20GB",
                "memory_gb": 20,
                "asr_model_size": "large-v3",
                "asr_compute_type": "float16",
                "nli_model_id": "joeddav/xlm-roberta-large-xnli",
                "max_seconds": 30,
                "batch_size": 4
            }
        else:
            return {
                "name": "1660 Super 6GB",
                "memory_gb": 6,
                "asr_model_size": "small",
                "asr_compute_type": "int8",
                "nli_model_id": "joeddav/xlm-roberta-large-xnli",
                "max_seconds": 20,
                "batch_size": 1
            }
    
    def load_models(self):
        """모든 AI 모델을 메모리에 로드 (첫 번째 성공 모델 채택)"""
        if self._models_loaded:
            logger.info("모델이 이미 로드되어 있습니다.")
            return
        
        logger.info("모델 로딩 시작... (첫 번째 성공 모델 채택)")
        
        # GKE 환경에서는 CPU 사용을 우선
        device = "cpu"  # GKE 환경에서는 CPU 사용
        logger.info(f"🎯 사용 디바이스: {device}")
        logger.info("🌐 GKE 환경에서 CPU 기반 음성 분석 준비")
        
        # 1. ASR 모델 (첫 번째 성공 모델 채택)
        self._asr_model = None
        self._stt_method = "none"
        
        # 방법 1: faster-whisper 시도 (libctranslate2 오류 방지)
        global FASTER_WHISPER_AVAILABLE
        if FASTER_WHISPER_AVAILABLE:
            try:
                self._asr_model = WhisperModel("tiny", device="cpu", compute_type="int8", num_workers=2)
                self._stt_method = "faster-whisper-tiny"
                logger.info("✅ ASR 모델 로드 성공 (faster-whisper tiny - 성능 최적화)")
                logger.info("🎤 faster-whisper tiny 모델 채택 (2배 빠름, 2 workers)")
            except Exception as e:
                logger.warning(f"⚠️ faster-whisper base 로드 실패: {e}")
                if "libctranslate2" in str(e).lower():
                    logger.warning("⚠️ libctranslate2 오류로 faster-whisper 비활성화")
                    FASTER_WHISPER_AVAILABLE = False
                else:
                    # tiny 모델로 재시도
                    try:
                        self._asr_model = WhisperModel("tiny", device="cpu", compute_type="int8")
                        self._stt_method = "faster-whisper-tiny"
                        logger.info("✅ ASR 모델 로드 성공 (faster-whisper tiny)")
                        logger.info("🎤 faster-whisper tiny 모델 채택")
                    except Exception as e2:
                        logger.warning(f"⚠️ faster-whisper tiny도 실패: {e2}")
                        if "libctranslate2" in str(e2).lower():
                            logger.warning("⚠️ libctranslate2 오류로 faster-whisper tiny도 비활성화")
                            FASTER_WHISPER_AVAILABLE = False
        
        # 방법 2: OpenAI Whisper API 시도 (faster-whisper 실패 시)
        if self._asr_model is None and OPENAI_AVAILABLE:
            try:
                # OpenAI API 키 확인
                if os.getenv('OPENAI_API_KEY'):
                    self._stt_method = "openai-whisper"
                    logger.info("✅ OpenAI Whisper API 준비 완료")
                    logger.info("🎤 OpenAI Whisper API 채택")
                else:
                    logger.warning("⚠️ OpenAI API 키가 설정되지 않음")
            except Exception as e:
                logger.warning(f"⚠️ OpenAI Whisper API 설정 실패: {e}")
        
        # 방법 3: Google Speech-to-Text API 시도 (이전 방법들 실패 시)
        if self._asr_model is None and self._stt_method == "none":
            try:
                from google.cloud import speech
                self._stt_method = "google-speech"
                logger.info("✅ Google Speech-to-Text API 준비 완료")
                logger.info("🎤 Google Speech-to-Text API 채택")
            except ImportError:
                logger.info("ℹ️ Google Speech-to-Text API 미설치")
            except Exception as e:
                logger.warning(f"⚠️ Google Speech-to-Text API 설정 실패: {e}")
        
        # 2. 텍스트 감정 분석 모델 (키워드 기반으로 단순화)
        logger.info("키워드 기반 감정 분석 사용 (GKE 환경 최적화)")
        self._nli_tokenizer = None
        self._nli_model = None
        logger.info("💡 GKE 환경에서 가벼운 키워드 기반 감정 분석 사용")
        
        # 3. 음성 감정 분석 모델 (GKE 환경에서는 비활성화)
        logger.info("음성 감정 분석 모델 비활성화 (키워드 기반 사용 - GKE 최적화)")
        self._audio_clf = None
        logger.info("🎵 GKE 환경에서 키워드 기반 감정 분석으로 대체")
        
        # STT 모델 상태 확인
        if self._stt_method != "none":
            logger.info(f"✅ STT 모델 채택 완료: {self._stt_method}")
        else:
            logger.warning("⚠️ 모든 STT 모델 로드 실패 - 음성 인식 제한됨")
        
        self._models_loaded = True
        logger.info("🎯 모델 로딩 완료 (첫 번째 성공 모델 채택)")
        logger.info(f"📊 채택된 모델: STT={self._stt_method}, 감정분석=키워드기반")
        logger.info("🚀 GKE 환경에서 STT 기능 준비 완료")
        logger.info("🎉 음성 입력 기능이 활성화되었습니다!")
    
    def analyze_voice_tone(self, audio_array: np.ndarray, sr: int) -> VoiceToneAnalysis:
        """음성 톤의 다양한 특성을 분석"""
        try:
            # FFT를 이용한 음높이 변화량 추정
            fft = np.fft.fft(audio_array)
            freqs = np.fft.fftfreq(len(audio_array), 1/sr)
            positive_freqs = freqs[freqs > 0]
            positive_fft = np.abs(fft[freqs > 0])
            
            # 주요 주파수 찾기
            if len(positive_freqs) > 0:
                dominant_freq_idx = np.argmax(positive_fft)
                dominant_freq = positive_freqs[dominant_freq_idx]
                
                # 주파수 변화량 계산
                freq_variance = np.var(positive_freqs[positive_fft > np.max(positive_fft) * 0.1])
                pitch_variation = min(1.0, freq_variance / 10000)
            else:
                pitch_variation = 0.0
            
            # 볼륨 일관성 계산
            chunk_size = int(0.1 * sr)  # 100ms chunks
            volumes = []
            for i in range(0, len(audio_array), chunk_size):
                chunk = audio_array[i:i+chunk_size]
                if len(chunk) > 0:
                    rms = np.sqrt(np.mean(np.square(chunk)))
                    volumes.append(rms)
            
            if len(volumes) > 1:
                volume_std = np.std(volumes)
                volume_consistency = max(0.0, 1.0 - volume_std / 0.1)
            else:
                volume_consistency = 0.5
            
            # 말하기 속도 추정 (간소화된 버전)
            speaking_speed = 3.0  # 기본값
            
            # 따뜻함 점수 (저주파 에너지 기반)
            low_freq_energy = np.sum(np.abs(fft[freqs < 500])) / len(fft)
            high_freq_energy = np.sum(np.abs(fft[freqs > 2000])) / len(fft)
            warmth_score = min(1.0, low_freq_energy / (high_freq_energy + 1e-6))
            
            # 열정 수준 (에너지 변화량 기반)
            energy_variation = np.std(np.abs(audio_array))
            enthusiasm_level = min(1.0, energy_variation / 0.1)
            
            # 공손함 수준 (볼륨 일관성과 피치 변화량 기반)
            politeness_level = (volume_consistency + (1.0 - pitch_variation)) / 2
            
            # 자신감 수준 (여러 요소 종합)
            overall_rms = np.sqrt(np.mean(np.square(audio_array)))
            volume_strength = min(1.0, overall_rms / 0.1)
            
            confidence_factors = [
                volume_strength * 0.4,
                volume_consistency * 0.3,
                min(1.0, energy_variation * 2) * 0.3
            ]
            confidence_level = sum(confidence_factors)
            
            return VoiceToneAnalysis(
                pitch_variation=pitch_variation,
                speaking_speed=speaking_speed,
                volume_consistency=volume_consistency,
                warmth_score=warmth_score,
                enthusiasm_level=enthusiasm_level,
                politeness_level=politeness_level,
                confidence_level=confidence_level,
                volume_strength=volume_strength
            )
            
        except Exception as e:
            logger.error(f"음성 톤 분석 실패: {e}")
            return VoiceToneAnalysis(0.5, 3.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    
    def analyze_word_choice(self, text: str, elapsed_sec: float = 0.0, voice: Optional[VoiceToneAnalysis] = None) -> WordChoiceAnalysis:
        """맥락/시간/음성톤을 반영한 단어 선택 분석"""
        if not text:
            return WordChoiceAnalysis(
                positive_words=[], negative_words=[], polite_phrases=[],
                empathy_indicators=[], enthusiasm_indicators=[],
                politeness_score=0.5, empathy_score=0.5, enthusiasm_score=0.5,
                valence_score=0.5
            )
        
        text_norm = text.strip()
        text_lower = text_norm.lower()
        
        # 긍정/부정 단어 스캔
        positive_words = [w for w, s in POSITIVE_DATING_WORDS.items() if w in text_lower]
        negative_words = [w for w, s in NEGATIVE_DATING_WORDS.items() if w in text_lower]
        
        pos_raw_score = sum(POSITIVE_DATING_WORDS.get(w, 0) for w in positive_words)
        neg_raw_score = sum(abs(NEGATIVE_DATING_WORDS.get(w, 0)) for w in negative_words)
        
        # 시간 가중치 적용
        early = elapsed_sec < 30.0
        late = elapsed_sec >= 120.0
        
        # 초반 과잉 긍정은 감점
        if early and any(tok in text_norm for tok in ["사랑", "결혼", "영원", "평생", "운명"]):
            pos_raw_score *= 0.6
            neg_raw_score += 0.3
        
        # 초반 부정은 가중
        if early and neg_raw_score > 0:
            neg_raw_score *= 1.2
        
        # 후반부 부정은 완화
        if late and neg_raw_score > 0:
            neg_raw_score *= 0.8
        
        # 음성 톤 결합
        if voice is not None:
            tone_warm_bright = 0.6 * voice.warmth_score + 0.4 * voice.enthusiasm_level
            neg_raw_score *= (1.0 - 0.6 * min(1.0, max(0.0, tone_warm_bright)))
            if tone_warm_bright < 0.4:
                pos_raw_score *= 0.8
        
        # 공손/공감/열정 스코어
        polite_phrases = [p for p in POLITE_PHRASES if p in text_norm]
        empathy_indicators = [e for e in EMPATHY_INDICATORS if e in text_norm]
        enthusiasm_indicators = [e for e in ENTHUSIASM_INDICATORS if e in text_norm]
        
        politeness_score = min(1.0, len(polite_phrases) / 2.0)
        empathy_score = min(1.0, len(empathy_indicators) / 1.5)
        enthusiasm_score = min(1.0, len(enthusiasm_indicators) / 1.5)
        
        # valence 계산
        pos_norm = min(1.0, pos_raw_score / 5.0)
        neg_norm = min(1.0, neg_raw_score / 5.0)
        valence_score = 0.4 + (pos_norm * 0.7 - neg_norm * 0.5)
        valence_score = max(0.3, min(1.0, valence_score))
        
        return WordChoiceAnalysis(
            positive_words=positive_words,
            negative_words=negative_words,
            polite_phrases=polite_phrases,
            empathy_indicators=empathy_indicators,
            enthusiasm_indicators=enthusiasm_indicators,
            politeness_score=politeness_score,
            empathy_score=empathy_score,
            enthusiasm_score=enthusiasm_score,
            valence_score=valence_score
        )
    
    def transcribe_korean(self, audio_array: np.ndarray) -> str:
        """한국어 음성을 텍스트로 변환 (다중 STT 방법 지원)"""
        if self._stt_method == "none":
            logger.warning("STT 모델이 로드되지 않았습니다.")
            return ""
        
        try:
            # 방법 1: faster-whisper 사용
            if self._stt_method in ["faster-whisper", "faster-whisper-tiny"] and self._asr_model is not None:
                return self._transcribe_with_faster_whisper(audio_array)
            
            # 방법 2: OpenAI Whisper API 사용
            elif self._stt_method == "openai-whisper":
                return self._transcribe_with_openai(audio_array)
            
            # 방법 3: Google Speech-to-Text API 사용
            elif self._stt_method == "google-speech":
                return self._transcribe_with_google(audio_array)
            
            else:
                logger.warning(f"지원되지 않는 STT 방법: {self._stt_method}")
                return ""
                
        except Exception as e:
            logger.error(f"전사 실패: {e}")
            return ""
    
    def _transcribe_with_faster_whisper(self, audio_array: np.ndarray) -> str:
        """faster-whisper를 사용한 전사"""
        try:
            # 오디오 전처리
            processed_audio = self._preprocess_audio(audio_array)
            
            # 첫 번째 시도: 성능 최적화 설정
            try:
                segments, _ = self._asr_model.transcribe(
                    processed_audio,
                    language="ko",
                    beam_size=1,              # 5 → 1 (5배 빠름)
                    best_of=1,               # 기본값 5 → 1 (5배 빠름)
                    temperature=0.0,          # 확률적 샘플링 비활성화
                    vad_filter=True,
                    vad_parameters=dict(
                        min_silence_duration_ms=300,  # 500 → 300 (더 빠른 감지)
                        max_speech_duration_s=30      # 긴 음성 제한
                    ),
                    condition_on_previous_text=False,
                    initial_prompt="한국어"        # 프롬프트 단순화
                )
            except Exception as e:
                logger.warning(f"기본 전사 실패: {e}")
                # 두 번째 시도: 단순화된 설정
                segments, _ = self._asr_model.transcribe(
                    processed_audio,
                    language="ko",
                    beam_size=1,
                    vad_filter=False,
                    condition_on_previous_text=False
                )
            
            text_parts = [seg.text for seg in segments]
            transcript = " ".join(tp.strip() for tp in text_parts).strip()
            
            if transcript:
                logger.info(f"✅ faster-whisper 전사 성공: '{transcript}'")
                return transcript
            else:
                logger.warning("faster-whisper 전사 결과가 비어있습니다.")
                return ""
                
        except Exception as e:
            if "libctranslate2" in str(e).lower():
                logger.error("⚠️ libctranslate2 오류로 faster-whisper 전사 실패")
            else:
                logger.error(f"faster-whisper 전사 실패: {e}")
            return ""
    
    def _transcribe_with_openai(self, audio_array: np.ndarray) -> str:
        """OpenAI Whisper API를 사용한 전사"""
        try:
            import tempfile
            import os
            
            # 오디오를 임시 파일로 저장
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                torchaudio.save(temp_path, torch.tensor(audio_array).unsqueeze(0), 16000)
            
            try:
                # OpenAI API 호출 (새로운 클라이언트 방식)
                from openai import OpenAI
                
                # 프록시 완전 차단 - 환경변수도 임시 정리
                print("🔗 OpenAI 클라이언트 안전 초기화 (Voice Analyzer)")
                
                # OpenAI 클라이언트 생성 전 proxy 환경변수 임시 제거
                original_env = {}
                proxy_vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
                
                for var in proxy_vars:
                    if var in os.environ:
                        original_env[var] = os.environ.pop(var)
                
                try:
                    client = OpenAI(
                        api_key=os.getenv('OPENAI_API_KEY'),
                        timeout=60.0
                    )
                    print("✅ OpenAI 음성 분석 안전 연결 완료")
                    
                finally:
                    # 환경변수 복원
                    for var, value in original_env.items():
                        os.environ[var] = value
                    
                    with open(temp_path, 'rb') as audio_file:
                        response = client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file,
                            language="ko"
                        )
                    
                    transcript = response.text.strip()
                    if transcript:
                        logger.info(f"✅ OpenAI Whisper 전사 성공: '{transcript}'")
                        return transcript
                    else:
                        logger.warning("OpenAI Whisper 전사 결과가 비어있습니다.")
                        return ""
                        
            except ImportError:
                # httpx가 없으면 기본 방식 사용
                client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                
                with open(temp_path, 'rb') as audio_file:
                    response = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="ko"
                    )
                
                transcript = response.text.strip()
                if transcript:
                    logger.info(f"✅ OpenAI Whisper 전사 성공: '{transcript}'")
                    return transcript
                else:
                    logger.warning("OpenAI Whisper 전사 결과가 비어있습니다.")
                    return ""
                    
            finally:
                # 임시 파일 정리
                os.unlink(temp_path)
                
        except Exception as e:
            logger.error(f"OpenAI Whisper 전사 실패: {e}")
            return ""
    
    def _transcribe_with_google(self, audio_array: np.ndarray) -> str:
        """Google Speech-to-Text API를 사용한 전사"""
        try:
            from google.cloud import speech
            import tempfile
            import os
            
            # 오디오를 임시 파일로 저장
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                torchaudio.save(temp_path, torch.tensor(audio_array).unsqueeze(0), 16000)
            
            try:
                # Google Speech-to-Text API 호출
                client = speech.SpeechClient()
                
                with open(temp_path, 'rb') as audio_file:
                    content = audio_file.read()
                
                audio = speech.RecognitionAudio(content=content)
                config = speech.RecognitionConfig(
                    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=16000,
                    language_code="ko-KR",
                )
                
                response = client.recognize(config=config, audio=audio)
                
                transcript = ""
                for result in response.results:
                    transcript += result.alternatives[0].transcript
                
                transcript = transcript.strip()
                if transcript:
                    logger.info(f"✅ Google Speech-to-Text 전사 성공: '{transcript}'")
                    return transcript
                else:
                    logger.warning("Google Speech-to-Text 전사 결과가 비어있습니다.")
                    return ""
                    
            finally:
                # 임시 파일 정리
                os.unlink(temp_path)
                
        except Exception as e:
            logger.error(f"Google Speech-to-Text 전사 실패: {e}")
            return ""
    
    def classify_emotion_audio(self, audio_array: np.ndarray) -> List[Tuple[str, float]]:
        """오디오에서 직접 감정 분류"""
        if self._audio_clf is None:
            logger.info("음성 감정 분석 모델이 로드되지 않았습니다. 중립 감정 사용")
            return [("중립", 1.0)]
        
        try:
            result = self._audio_clf(
                {"array": audio_array, "sampling_rate": TARGET_SR}, 
                top_k=None
            )
            
            # 결과를 한국어 레이블로 변환
            agg = {}
            for item in result:
                ko_label = AUDIO_LABEL_MAP.get(item["label"], item["label"])
                agg[ko_label] = agg.get(ko_label, 0.0) + item["score"]
            
            return sorted(agg.items(), key=lambda x: x[1], reverse=True)
            
        except Exception as e:
            logger.error(f"음성 감정 분석 실패: {e}")
            return [("중립", 1.0)]
    
    def classify_emotion_by_keywords(self, text: str) -> List[Tuple[str, float]]:
        """키워드 기반 감정 분석"""
        if not text:
            return [("중립", 1.0)]
        
        positive_score = sum(1 for word in POSITIVE_DATING_WORDS if word in text)
        negative_score = sum(1 for word in NEGATIVE_DATING_WORDS if word in text)
        enthusiasm_score = sum(1 for word in ENTHUSIASM_INDICATORS if word in text)
        
        if enthusiasm_score > 0 or positive_score > negative_score:
            return [("기쁨", 0.8), ("중립", 0.2)]
        elif negative_score > positive_score:
            return [("슬픔", 0.7), ("중립", 0.3)]
        else:
            return [("중립", 1.0)]
    
    def _preprocess_audio(self, audio_array: np.ndarray) -> np.ndarray:
        """오디오 전처리"""
        audio_array = audio_array.astype(np.float32)
        
        # 볼륨 정규화
        rms = np.sqrt(np.mean(np.square(audio_array)))
        if rms > 0:
            target_rms = 0.1
            gain = min(target_rms / rms, 10.0)
            audio_array = audio_array * gain
        
        # 고주파 필터 (저주파 노이즈 제거)
        try:
            from scipy import signal
            nyquist = TARGET_SR / 2
            cutoff = 80  # Hz
            b, a = signal.butter(4, cutoff / nyquist, btype='high')
            audio_array = signal.filtfilt(b, a, audio_array).astype(np.float32)
        except ImportError:
            logger.warning("scipy 없음 - 고주파 필터 건너뜀")
        
        # 노이즈 게이트
        threshold = 0.01
        audio_array[np.abs(audio_array) < threshold] = 0
        
        return audio_array.astype(np.float32)
    
    def check_audio_quality(self, audio_array: np.ndarray, sr: int) -> Dict[str, Any]:
        """오디오 품질 검사"""
        if len(audio_array) == 0:
            return {
                "rms_level": 0.0,
                "peak_level": 0.0,
                "silence_ratio": 1.0,
                "duration": 0.0,
                "sample_count": 0,
                "is_valid": False,
                "error_message": "빈 오디오 배열"
            }
        
        rms_level = float(np.sqrt(np.mean(np.square(audio_array))))
        peak_level = float(np.max(np.abs(audio_array)))
        duration = float(len(audio_array)) / float(sr)
        sample_count = len(audio_array)
        
        # 무음 비율 계산
        silence_threshold = 0.01
        silent_samples = np.sum(np.abs(audio_array) < silence_threshold)
        silence_ratio = silent_samples / sample_count if sample_count > 0 else 1.0
        
        # 유효성 판단 (완화된 기준)
        is_valid = True
        error_message = ""
        
        if rms_level < 0.001:  # RMS 기준 완화
            is_valid = False
            error_message = f"오디오가 너무 조용함 (RMS: {rms_level:.6f})"
        elif peak_level < 0.005:  # 피크 기준 완화
            is_valid = False
            error_message = f"오디오 피크가 너무 낮음 (Peak: {peak_level:.6f})"
        elif silence_ratio > 0.98:  # 무음 비율 기준 완화
            is_valid = False
            error_message = f"무음이 너무 많음 ({silence_ratio:.1%})"
        elif duration < 0.3:  # 최소 길이 기준 완화
            is_valid = False
            error_message = f"오디오가 너무 짧음 ({duration:.2f}s)"
        
        return {
            "rms_level": rms_level,
            "peak_level": peak_level,
            "silence_ratio": silence_ratio,
            "duration": duration,
            "sample_count": sample_count,
            "is_valid": is_valid,
            "error_message": error_message
        }

    def _analyze_emotion(self, audio_array: np.ndarray, transcript: str) -> List[Tuple[str, float]]:
        """감정 분석 (오디오 + 텍스트 결합)"""
        try:
            # 1. 텍스트 기반 감정 분석 (우선)
            text_emotions = self.classify_emotion_by_keywords(transcript)
            
            # 2. 오디오 기반 감정 분석 (보조)
            audio_emotions = self.classify_emotion_audio(audio_array)
            
            # 3. 결과 결합 (텍스트 우선, 오디오 보조)
            combined_emotions = {}
            
            # 텍스트 감정 가중치 0.7
            for emotion, score in text_emotions:
                combined_emotions[emotion] = combined_emotions.get(emotion, 0.0) + score * 0.7
            
            # 오디오 감정 가중치 0.3
            for emotion, score in audio_emotions:
                combined_emotions[emotion] = combined_emotions.get(emotion, 0.0) + score * 0.3
            
            # 정규화
            total_score = sum(combined_emotions.values())
            if total_score > 0:
                combined_emotions = {k: v / total_score for k, v in combined_emotions.items()}
            
            return sorted(combined_emotions.items(), key=lambda x: x[1], reverse=True)
            
        except Exception as e:
            logger.error(f"감정 분석 실패: {e}")
            return [("중립", 1.0)]

    def analyze_audio(
        self,
        audio_array: np.ndarray,
        sr: int = 16000,
        elapsed_sec: float = 0.0
    ) -> VoiceAnalysisResult:
        """
        오디오를 완전히 분석하여 VoiceAnalysisResult 반환
        
        Args:
            audio_array: 오디오 데이터
            sr: 샘플링 레이트
            elapsed_sec: 경과 시간 (대화 맥락용)
            
        Returns:
            완전한 음성 분석 결과
        """
        start_time = time.time()
        
        try:
            # 1. 음성 인식 (STT)
            transcript = self.transcribe_korean(audio_array)
            if not transcript:
                transcript = "음성을 인식하지 못했습니다."
            
            # 2. 감정 분석
            emotion_scores = self._analyze_emotion(audio_array, transcript)
            top_emotion, top_score = emotion_scores[0] if emotion_scores else ("중립", 1.0)
            
            # 3. 음성 톤 분석
            voice_tone = self.analyze_voice_tone(audio_array, sr)
            
            # 4. 단어 선택 분석
            word_choice = self.analyze_word_choice(transcript, elapsed_sec, voice_tone)
            
            # 5. 오디오 품질 검사
            audio_quality = self.check_audio_quality(audio_array, sr)
            
            # 6. 처리 시간 계산
            processing_time = time.time() - start_time
            
            # 7. VoiceAnalysisResult 생성
            result = VoiceAnalysisResult(
                transcript=transcript,
                emotion=top_emotion,
                emotion_score=top_score,
                voice_tone=voice_tone,
                word_choice=word_choice,
                total_score=0.0,  # VoiceScorer에서 계산
                voice_tone_score=0.0,  # VoiceScorer에서 계산
                word_choice_score=0.0,  # VoiceScorer에서 계산
                overall_mood="보통",  # VoiceScorer에서 계산
                evidence={},  # VoiceScorer에서 생성
                recommendations=[],  # VoiceScorer에서 생성
                processing_time=processing_time,
                audio_quality=audio_quality
            )
            
            return result
            
        except Exception as e:
            logger.error(f"오디오 분석 실패: {e}")
            # 기본 결과 반환
            return VoiceAnalysisResult(
                transcript="분석 실패",
                emotion="중립",
                emotion_score=1.0,
                voice_tone=VoiceToneAnalysis(0.5, 3.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5),
                word_choice=WordChoiceAnalysis([], [], [], [], [], 0.5, 0.5, 0.5, 0.5),
                total_score=50.0,
                voice_tone_score=50.0,
                word_choice_score=50.0,
                overall_mood="보통",
                evidence={"오류": "분석 실패"},
                recommendations=["다시 시도해보세요"],
                processing_time=time.time() - start_time,
                audio_quality={"error": "분석 실패"}
            )
