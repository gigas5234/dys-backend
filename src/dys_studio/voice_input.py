import os
import sys
import logging
import json
from typing import Tuple, Dict, List, Optional
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
from dataclasses import dataclass

# --- 로깅 설정 ---
# 로그를 파일과 콘솔에 출력하여 디버깅을 용이하게 합니다.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('core_analysis.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# --- 분석 결과 저장을 위한 데이터 클래스 정의 ---
@dataclass
class VoiceToneAnalysis:
    """음성 톤 분석 결과"""
    pitch_variation: float
    speaking_speed: float
    volume_consistency: float
    warmth_score: float
    enthusiasm_level: float
    politeness_level: float
    confidence_level: float
    volume_strength: float

@dataclass
class WordChoiceAnalysis:
    """단어 선택 분석 결과"""
    positive_words: List[str]
    negative_words: List[str]
    polite_phrases: List[str]
    empathy_indicators: List[str]
    enthusiasm_indicators: List[str]
    politeness_score: float
    empathy_score: float
    enthusiasm_score: float
    valence_score: float

@dataclass
class DatingEmpathyScore:
    """종합 점수 및 분석 결과"""
    total_score: float
    voice_tone_score: float
    word_choice_score: float
    overall_mood: str
    voice_analysis: VoiceToneAnalysis
    word_analysis: WordChoiceAnalysis
    evidence: Dict[str, str]
    recommendations: List[str]
    voice_details: Dict[str, float] = None
    word_details: Dict[str, float] = None
    weights: Dict[str, float] = None
    positive_words: List[str] = None
    negative_words: List[str] = None

# --- 상수 및 설정값 ---
TARGET_SR = 16000 # 오디오 샘플링 레이트 (16kHz)

# 단어 분석에 사용될 사전
POSITIVE_DATING_WORDS = { "좋아": 0.8, "감사": 0.9, "행복": 0.9, "사랑": 1.0, "예쁘": 0.9, "멋있": 0.8, "최고": 0.9, "특별": 0.8, "기쁘": 0.8, "괜찮": 0.6, "맞아": 0.7, "정말": 0.7 }
NEGATIVE_DATING_WORDS = { "싫어": -0.8, "화나": -0.9, "짜증": -0.8, "귀찮": -0.7, "힘들": -0.6, "어려워": -0.5, "아프": -0.6, "불안": -0.7, "슬퍼": -0.7, "무서워": -0.6 }
POLITE_PHRASES = [ "감사합니다", "고맙습니다", "죄송합니다", "부탁드립니다", "~해주세요", "~시겠어요" ]
EMPATHY_INDICATORS = [ "그렇구나", "이해해", "공감해", "힘들었겠다", "괜찮을 거야", "어떻게 생각해" ]
ENTHUSIASM_INDICATORS = [ "와!", "대박!", "진짜?", "정말?", "최고야!", "멋져!" ]

# AI 모델 ID
AUDIO_EMO_MODEL_ID = "superb/wav2vec2-base-superb-er"
NLI_MODEL_ID = "cardiffnlp/twitter-roberta-base-emotion-multilingual-latest"  # 더 호환성 좋은 감정 분석 모델
ASR_MODEL_NAME = "large-v3" # Whisper 모델

# 감정 레이블 매핑 (영어 -> 한국어)
AUDIO_LABEL_MAP = { "angry": "분노", "calm": "중립", "disgust": "혐오", "fearful": "두려움", "happy": "기쁨", "neutral": "중립", "sad": "슬픔", "surprise": "놀람" }
KOREAN_EMOTION_LABELS = [ "기쁨", "슬픔", "분노", "중립", "두려움", "혐오", "놀람", "짜증", "귀찮음", "서운함", "억울함", "불안", "무심함" ]

# 전역 모델 변수 (초기에는 비어있음)
_asr_model: Optional[WhisperModel] = None
_nli_tokenizer = None  # Optional[AutoTokenizer] = None
_nli_model = None  # Optional[AutoModelForSequenceClassification] = None
_audio_clf = None

# --- 핵심 기능 함수 ---

def preload_models():
    """
    분석에 필요한 모든 AI 모델을 메모리에 로드합니다.
    GPU 사용을 기본으로 하며, GPU가 없을 경우 CPU를 사용합니다.
    """
    global _asr_model, _nli_tokenizer, _nli_model, _audio_clf
    
    if _asr_model is not None:
        logger.info("Models are already loaded.")
        return

    logger.info("Starting to preload models...")
    
    if torch.cuda.is_available():
        device = "cuda"
        # 최신 GPU에서는 float16을 사용하여 속도 향상
        asr_compute_type = "float16" if torch.cuda.get_device_capability(0)[0] >= 7 else "int8"
        logger.info(f"GPU detected. Device: {device}, ASR Compute Type: {asr_compute_type}")
    else:
        device = "cpu"
        asr_compute_type = "int8" # CPU에서는 가벼운 타입 사용
        logger.warning("GPU not available. Falling back to CPU, which will be significantly slower.")

    # 1. 음성 인식 모델 (Whisper)
    _asr_model = WhisperModel(ASR_MODEL_NAME, device=device, compute_type=asr_compute_type)
    
    # 2. 텍스트 감정 분석 모델 (키워드 기반으로 단순화)
    logger.info("Using keyword-based emotion analysis for better compatibility")
    _nli_tokenizer = None
    _nli_model = None
    
    # 3. 음성 감정 분석 모델 (wav2vec2)
    if TRANSFORMERS_AVAILABLE:
        try:
            device_id = 0 if device == "cuda" else -1
            _audio_clf = pipeline("audio-classification", model=AUDIO_EMO_MODEL_ID, device=device_id)
            logger.info("음성 감정 분석 모델 로드 성공")
        except ImportError:
            logger.error("The 'transformers' pipeline requires additional libraries. Audio classification is disabled.")
            _audio_clf = None
    else:
        logger.info("Transformers 라이브러리 없음 - 음성 감정 분석 비활성화")
        _audio_clf = None
    
    logger.info("All models have been preloaded successfully!")


def analyze_voice_tone(audio_array: np.ndarray, sr: int) -> VoiceToneAnalysis:
    """음성 톤의 다양한 특성을 분석합니다."""
    # 실제 분석 로직은 복잡하지만, 여기서는 핵심 개념을 보여주는 간소화된 버전을 사용합니다.
    try:
        rms = np.sqrt(np.mean(np.square(audio_array)))
        # FFT를 이용한 음높이 변화량 추정
        fft_abs = np.abs(np.fft.fft(audio_array))
        pitch_variation = min(1.0, np.std(fft_abs) / 5000)
        # 오디오를 20개로 나누어 볼륨 일관성 계산
        chunk_volumes = [np.sqrt(np.mean(np.square(c))) for c in np.array_split(audio_array, 20) if c.size > 0]
        volume_consistency = max(0.0, 1.0 - np.std(chunk_volumes) / 0.1) if len(chunk_volumes) > 1 else 0.5
        
        return VoiceToneAnalysis(
            pitch_variation=pitch_variation,
            speaking_speed=3.0, # 실제로는 STT 결과와 시간을 비교해야 함 (여기서는 고정값)
            volume_consistency=volume_consistency,
            warmth_score=min(1.0, rms * 5 + 0.3),
            enthusiasm_level=min(1.0, pitch_variation * 1.5),
            politeness_level=(volume_consistency + (1.0 - pitch_variation)) / 2,
            confidence_level=min(1.0, rms * 7),
            volume_strength=min(1.0, rms * 10)
        )
    except Exception as e:
        logger.error(f"Voice tone analysis failed: {e}")
        return VoiceToneAnalysis(0.5, 3.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)

def analyze_word_choice(text: str, elapsed_sec: float = 0.0) -> WordChoiceAnalysis:
    """텍스트의 단어 선택을 맥락과 시간을 고려하여 분석합니다."""
    positive_words = [w for w, s in POSITIVE_DATING_WORDS.items() if w in text]
    negative_words = [w for w, s in NEGATIVE_DATING_WORDS.items() if w in text]
    polite_phrases = [p for p in POLITE_PHRASES if p in text]
    empathy_indicators = [e for e in EMPATHY_INDICATORS if e in text]
    enthusiasm_indicators = [e for e in ENTHUSIASM_INDICATORS if e in text]

    pos_score = sum(POSITIVE_DATING_WORDS.get(w, 0) for w in positive_words)
    neg_score = sum(abs(NEGATIVE_DATING_WORDS.get(w, 0)) for w in negative_words)

    # 대화 초반(30초 이내)에 "사랑"과 같은 강한 표현은 오히려 감점
    if elapsed_sec < 30 and "사랑" in text:
        pos_score *= 0.6
        neg_score += 0.3

    # 긍정 점수와 부정 점수를 종합하여 0~1 사이의 정서 점수(valence) 계산
    valence_score = max(0.0, min(1.0, 0.5 + (pos_score - neg_score) / 5.0))

    return WordChoiceAnalysis(
        positive_words=positive_words, negative_words=negative_words,
        polite_phrases=polite_phrases, empathy_indicators=empathy_indicators,
        enthusiasm_indicators=enthusiasm_indicators,
        politeness_score=min(1.0, len(polite_phrases) / 2.0),
        empathy_score=min(1.0, len(empathy_indicators) / 2.0),
        enthusiasm_score=min(1.0, len(enthusiasm_indicators) / 2.0),
        valence_score=valence_score
    )

def calculate_dating_empathy_score(voice_analysis: VoiceToneAnalysis, word_analysis: WordChoiceAnalysis, emotion_scores: List[Tuple[str, float]]) -> DatingEmpathyScore:
    """음성, 단어, 감정 분석 결과를 종합하여 최종 점수를 계산합니다."""
    # 각 요소에 가중치를 부여하여 점수 계산
    voice_tone_score = (voice_analysis.warmth_score * 0.25 + voice_analysis.politeness_level * 0.25 + voice_analysis.volume_consistency * 0.15 + voice_analysis.enthusiasm_level * 0.15 + voice_analysis.confidence_level * 0.20) * 100
    word_choice_score = (word_analysis.politeness_score * 0.30 + word_analysis.empathy_score * 0.30 + word_analysis.enthusiasm_score * 0.15 + word_analysis.valence_score * 0.25) * 100

    emotion_dict = dict(emotion_scores)
    positive_emotions = ["기쁨", "중립", "놀람"]
    negative_emotions = ["분노", "슬픔", "두려움", "혐오", "짜증"]
    pos_emo_score = sum(emotion_dict.get(e, 0) for e in positive_emotions)
    neg_emo_score = sum(emotion_dict.get(e, 0) for e in negative_emotions)
    emotion_score = max(0, min(100, (pos_emo_score - neg_emo_score * 0.5) * 100))

    # 최종 점수 (음성 40%, 단어 40%, 감정 20%)
    total_score = (voice_tone_score * 0.4 + word_choice_score * 0.4 + emotion_score * 0.2)
    
    # 점수에 따른 분위기 및 조언 생성
    mood = "보통"
    if total_score >= 85: mood = "매우 좋음"
    elif total_score >= 70: mood = "좋음"
    elif total_score >= 30: mood = "나쁨"
    else: mood = "매우 나쁨"
    recommendations = ["지금처럼만 하시면 돼요! 아주 좋습니다."] if total_score > 70 else ["조금 더 자신감 있고 따뜻한 톤으로 말해보는 건 어떨까요?"]

    return DatingEmpathyScore(
        total_score=total_score, voice_tone_score=voice_tone_score, word_choice_score=word_choice_score,
        overall_mood=mood, voice_analysis=voice_analysis, word_analysis=word_analysis,
        evidence={"summary": "Analysis complete."}, recommendations=recommendations,
        voice_details=vars(voice_analysis), word_details=vars(word_analysis),
        weights={"voice": 0.4, "word": 0.4, "emotion": 0.2},
        positive_words=word_analysis.positive_words, negative_words=word_analysis.negative_words
    )

def transcribe_korean(audio_array: np.ndarray) -> str:
    """오디오 데이터를 한국어 텍스트로 변환합니다."""
    if _asr_model is None: raise RuntimeError("ASR model is not loaded. Call preload_models() first.")
    try:
        segments, _ = _asr_model.transcribe(audio_array, language="ko", beam_size=5)
        return " ".join(seg.text for seg in segments).strip()
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return ""

def classify_emotion_audio(audio_array: np.ndarray) -> List[Tuple[str, float]]:
    """오디오 데이터에서 직접 감정을 분류합니다."""
    if _audio_clf is None: return [("중립", 1.0)]
    try:
        result = _audio_clf({"array": audio_array, "sampling_rate": TARGET_SR}, top_k=None)
        # 결과를 한국어 레이블로 변환하고 점수 합산
        agg = {}
        for item in result:
            ko_label = AUDIO_LABEL_MAP.get(item["label"], item["label"])
            agg[ko_label] = agg.get(ko_label, 0.0) + item["score"]
        return sorted(agg.items(), key=lambda x: x[1], reverse=True)
    except Exception as e:
        logger.error(f"Audio emotion classification failed: {e}")
        return [("중립", 1.0)]

def classify_emotion_ko_zeroshot(text: str) -> List[Tuple[str, float]]:
    """텍스트에서 감정을 분류합니다. 모델이 없으면 키워드 기반 분석을 사용합니다."""
    if not text:
        return [("중립", 1.0)]
    
    # 모델이 로드되지 않았으면 키워드 기반 분석 사용
    if _nli_tokenizer is None or _nli_model is None:
        return classify_emotion_by_keywords(text)
    
    scores = []
    try:
        # 새로운 모델의 레이블 구조에 맞게 수정
        device = _nli_model.device
        enc = _nli_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        
        with torch.no_grad():
            logits = _nli_model(**enc).logits
            probs = torch.softmax(logits, dim=-1).squeeze(0)
        
        # 모델의 레이블에 따라 감정 매핑
        labels = ["기쁨", "슬픔", "분노", "중립"]
        for i, label in enumerate(labels):
            if i < len(probs):
                scores.append((label, float(probs[i])))
        
        if not scores:
            scores = [("중립", 1.0)]
            
        return sorted(scores, key=lambda x: x[1], reverse=True)
    except Exception as e:
        logger.error(f"Text emotion classification failed: {e}")
        return classify_emotion_by_keywords(text)

def classify_emotion_by_keywords(text: str) -> List[Tuple[str, float]]:
    """키워드 기반 간단한 감정 분석"""
    if not text:
        return [("중립", 1.0)]
    
    # 키워드 기반 감정 점수 계산
    positive_score = sum(1 for word in POSITIVE_DATING_WORDS if word in text)
    negative_score = sum(1 for word in NEGATIVE_DATING_WORDS if word in text)
    enthusiasm_score = sum(1 for word in ENTHUSIASM_INDICATORS if word in text)
    
    if enthusiasm_score > 0 or positive_score > negative_score:
        return [("기쁨", 0.8), ("중립", 0.2)]
    elif negative_score > positive_score:
        return [("슬픔", 0.7), ("중립", 0.3)]
    else:
        return [("중립", 1.0)]

def process_audio_simple(audio_array: np.ndarray) -> dict:
    """
    오디오 배열을 입력받아 모든 분석을 수행하고 결과를 딕셔너리로 반환하는 메인 함수.
    """
    if _asr_model is None:
        raise RuntimeError("Models are not loaded. Call preload_models() before processing audio.")
        
    result = {}
    try:
        # 1. 음성 인식 (STT)
        transcript = transcribe_korean(audio_array)
        result['transcript'] = transcript or "음성 인식 실패"
        
        # 2. 감정 분석 (음성 + 텍스트)
        audio_scores = classify_emotion_audio(audio_array)
        text_scores = classify_emotion_ko_zeroshot(transcript)
        
        # 텍스트가 있으면 텍스트 기반, 없으면 음성 기반 감정 사용
        final_emotion_scores = text_scores if transcript else audio_scores
        top_emotion, top_score = final_emotion_scores[0]
        result['emotion'] = str(top_emotion)
        result['emotion_score'] = float(top_score)
        
        # 3. 종합 점수 계산
        elapsed_sec = len(audio_array) / TARGET_SR
        voice_analysis = analyze_voice_tone(audio_array, TARGET_SR)
        word_analysis = analyze_word_choice(transcript, elapsed_sec)
        dating_score = calculate_dating_empathy_score(voice_analysis, word_analysis, final_emotion_scores)
        
        # 4. 최종 결과 딕셔너리에 추가 (JSON 직렬화 가능하도록 변환)
        result.update({
            'total_score': float(dating_score.total_score),
            'voice_tone_score': float(dating_score.voice_tone_score),
            'voice_details': {k: float(v) for k, v in dating_score.voice_details.items()},
            'word_choice_score': float(dating_score.word_choice_score),
            'word_details': {k: float(v) if isinstance(v, (int, float)) else v for k, v in dating_score.word_details.items()},
            'weights': {k: float(v) for k, v in dating_score.weights.items()},
            'positive_words': list(dating_score.positive_words),
            'negative_words': list(dating_score.negative_words)
        })

    except Exception as e:
        logger.critical(f"Critical error in audio processing pipeline: {e}", exc_info=True)
        # 오류 발생 시 기본값 반환
        return {
            'transcript': '처리 중 오류 발생', 'emotion': '오류', 'emotion_score': 0.0,
            'total_score': 0.0, 'voice_tone_score': 0.0, 'voice_details': {},
            'word_choice_score': 0.0, 'word_details': {}, 'weights': {},
            'positive_words': [], 'negative_words': []
        }
    return result

# --- 모듈 테스트용 코드 ---
if __name__ == "__main__":
    """
    이 스크립트 파일을 직접 실행할 경우, 아래 테스트 코드가 동작합니다.
    모델 로딩과 간단한 가상 오디오 데이터 분석을 통해 모듈이 정상 작동하는지 확인합니다.
    """
    print("="*50)
    print("Core Analysis Engine - Module Self-Test")
    print("="*50)

    try:
        # 1. 모델 로딩 테스트
        print("\n[Step 1] Preloading all models...")
        preload_models()
        print("\n[Step 1] Model loading test PASSED.")
    except Exception as e:
        print(f"\n[Step 1] Model loading test FAILED: {e}")
        sys.exit(1)

    try:
        # 2. 가상 오디오 데이터 생성 및 분석 테스트
        print("\n[Step 2] Creating dummy audio and running analysis...")
        # "안녕하세요, 반갑습니다"와 유사한 톤의 3초짜리 가상 오디오 생성
        sr = TARGET_SR
        duration = 3
        frequency1 = 120  # 남성 목소리 톤
        frequency2 = 150
        t = np.linspace(0., duration, int(sr * duration), endpoint=False)
        amplitude = np.iinfo(np.int16).max * 0.1
        # 시간에 따라 주파수가 변하는 자연스러운 톤 생성
        data = amplitude * (np.sin(2. * np.pi * (frequency1 + t * 10) * t) + 0.5 * np.sin(2. * np.pi * (frequency2 + t * 5) * t))
        dummy_audio = data.astype(np.float32) / np.iinfo(np.int16).max

        print(f"Generated {duration} seconds of dummy audio.")
        
        analysis_result = process_audio_simple(dummy_audio)
        
        print("\n--- Analysis Result (JSON) ---")
        print(json.dumps(analysis_result, indent=2, ensure_ascii=False))
        print("--------------------------------")

        if analysis_result and analysis_result['emotion'] != '오류':
             print("\n[Step 2] Analysis pipeline test PASSED.")
        else:
            raise RuntimeError("Analysis result was empty or indicated an error.")

    except Exception as e:
        print(f"\n[Step 2] Analysis pipeline test FAILED: {e}")
        sys.exit(1)

    print("\n✅ All tests completed successfully. The module is ready to be used.")
