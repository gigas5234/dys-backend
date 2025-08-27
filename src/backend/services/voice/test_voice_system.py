#!/usr/bin/env python3
"""
Voice System Test - 새로운 voice 시스템 테스트
기존 simple_mic_test.py의 로직을 포함하여 테스트
"""

import os
import sys
import time
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext
import numpy as np
import sounddevice as sd
from datetime import datetime

# 새로운 voice 모듈 import
sys.path.append('.')
from voice.voice_api import (
    process_audio_simple, 
    preload_voice_models,
    is_voice_processor_ready,
    get_voice_model_status
)

class VoiceSystemTest:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🎤 Voice System Test - 새로운 음성 분석 시스템")
        self.root.geometry("900x700")
        
        # 녹음 상태
        self.is_recording = False
        self.audio_buffer = []
        self.recording_thread = None
        self.elapsed_sec = 0.0  # 대화 경과 시간
        
        # 모델 로딩
        print("새로운 Voice System 모델 로딩 중...")
        preload_voice_models()
        
        if is_voice_processor_ready():
            print("✅ Voice System 모델 로딩 완료!")
        else:
            print("⚠️ Voice System 모델 로딩 실패")
        
        self.setup_ui()
        
    def setup_ui(self):
        """UI 구성"""
        # 메인 프레임
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 제목
        title_label = ttk.Label(main_frame, text="🎤 Voice System Test - 새로운 음성 분석 시스템", 
                               font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 20))
        
        # 모델 상태 표시
        status_frame = ttk.LabelFrame(main_frame, text="🔧 모델 상태", padding="10")
        status_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        model_status = get_voice_model_status()
        status_text = f"ASR 모델: {'✅' if model_status['asr_model'] else '❌'}, "
        status_text += f"음성 감정 분석: {'✅' if model_status['audio_classifier'] else '❌'}, "
        status_text += f"전체 로드: {'✅' if model_status['models_loaded'] else '❌'}"
        
        status_label = ttk.Label(status_frame, text=status_text, font=("Arial", 10))
        status_label.grid(row=0, column=0, sticky=tk.W)
        
        # 마이크 버튼
        self.mic_button = ttk.Button(main_frame, text="🎤 녹음 시작", 
                                    command=self.toggle_recording,
                                    style="Accent.TButton")
        self.mic_button.grid(row=2, column=0, columnspan=2, pady=(0, 20))
        
        # 상태 표시
        self.status_label = ttk.Label(main_frame, text="대기 중...", 
                                     font=("Arial", 10))
        self.status_label.grid(row=3, column=0, columnspan=2, pady=(0, 10))
        
        # 결과 프레임
        result_frame = ttk.LabelFrame(main_frame, text="📊 분석 결과", padding="10")
        result_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 기본 정보
        ttk.Label(result_frame, text="전사:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky=tk.W)
        self.transcript_label = ttk.Label(result_frame, text="", font=("Arial", 10))
        self.transcript_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(result_frame, text="감정:", font=("Arial", 10, "bold")).grid(row=1, column=0, sticky=tk.W, pady=(5, 0))
        self.emotion_label = ttk.Label(result_frame, text="", font=("Arial", 10))
        self.emotion_label.grid(row=1, column=1, sticky=tk.W, padx=(10, 0), pady=(5, 0))
        
        ttk.Label(result_frame, text="총점:", font=("Arial", 10, "bold")).grid(row=2, column=0, sticky=tk.W, pady=(5, 0))
        self.total_score_label = ttk.Label(result_frame, text="", font=("Arial", 10))
        self.total_score_label.grid(row=2, column=1, sticky=tk.W, padx=(10, 0), pady=(5, 0))
        
        ttk.Label(result_frame, text="음성 톤:", font=("Arial", 10, "bold")).grid(row=3, column=0, sticky=tk.W, pady=(5, 0))
        self.voice_tone_label = ttk.Label(result_frame, text="", font=("Arial", 10))
        self.voice_tone_label.grid(row=3, column=1, sticky=tk.W, padx=(10, 0), pady=(5, 0))
        
        ttk.Label(result_frame, text="단어 선택:", font=("Arial", 10, "bold")).grid(row=4, column=0, sticky=tk.W, pady=(5, 0))
        self.word_choice_label = ttk.Label(result_frame, text="", font=("Arial", 10))
        self.word_choice_label.grid(row=4, column=1, sticky=tk.W, padx=(10, 0), pady=(5, 0))
        
        ttk.Label(result_frame, text="시간:", font=("Arial", 10, "bold")).grid(row=5, column=0, sticky=tk.W, pady=(5, 0))
        self.time_label = ttk.Label(result_frame, text="", font=("Arial", 10))
        self.time_label.grid(row=5, column=1, sticky=tk.W, padx=(10, 0), pady=(5, 0))
        
        # 로그 영역
        log_frame = ttk.LabelFrame(main_frame, text="📝 상세 로그", padding="10")
        log_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=20, width=100, font=("Consolas", 9))
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 그리드 가중치 설정
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(4, weight=1)
        main_frame.rowconfigure(5, weight=1)
        result_frame.columnconfigure(1, weight=1)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        
    def log_message(self, message):
        """로그 메시지 추가"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}\n"
        self.log_text.insert(tk.END, log_entry)
        self.log_text.see(tk.END)
        self.root.update_idletasks()
        
    def toggle_recording(self):
        """녹음 시작/중지 토글"""
        if not self.is_recording:
            self.start_recording()
        else:
            self.stop_recording()
            
    def start_recording(self):
        """녹음 시작"""
        self.is_recording = True
        self.audio_buffer = []
        self.mic_button.config(text="⏹️ 녹음 중지")
        self.status_label.config(text="녹음 중... (마이크에 말해보세요)")
        
        self.log_message("🎤 녹음 시작")
        
        # 녹음 스레드 시작
        self.recording_thread = threading.Thread(target=self.record_audio)
        self.recording_thread.daemon = True
        self.recording_thread.start()
        
    def stop_recording(self):
        """녹음 중지"""
        self.is_recording = False
        self.mic_button.config(text="🎤 녹음 시작")
        self.status_label.config(text="분석 중...")
        
        self.log_message("⏹️ 녹음 중지")
        
        # 녹음 스레드 종료 대기
        if self.recording_thread and self.recording_thread.is_alive():
            self.recording_thread.join(timeout=1.0)
            
    def record_audio(self):
        """오디오 녹음"""
        try:
            chunk_size = int(0.1 * 16000)  # 100ms chunks
            
            with sd.InputStream(samplerate=16000, channels=1, dtype=np.float32, blocksize=chunk_size) as stream:
                self.log_message("✅ 마이크 스트림 열림")
                
                while self.is_recording:
                    try:
                        data, _ = stream.read(chunk_size)
                        chunk = np.asarray(data).squeeze(-1)
                        self.audio_buffer.append(chunk)
                    except Exception as e:
                        self.log_message(f"❌ 녹음 오류: {e}")
                        break
                        
            self.log_message("✅ 마이크 스트림 닫힘")
            
            # 녹음 완료 후 분석
            if self.audio_buffer:
                self.analyze_audio()
            else:
                self.log_message("❌ 녹음된 오디오가 없습니다")
                self.status_label.config(text="대기 중...")
                
        except Exception as e:
            self.log_message(f"❌ 녹음 스레드 오류: {e}")
            self.status_label.config(text="오류 발생")
            
    def analyze_audio(self):
        """오디오 분석"""
        try:
            # 오디오 배열 생성
            audio_array = np.concatenate(self.audio_buffer)
            duration = len(audio_array) / 16000
            
            self.log_message(f"📊 오디오 길이: {duration:.2f}초")
            
            # 새로운 Voice System으로 분석 실행
            start_time = time.time()
            result = process_audio_simple(audio_array, 16000, self.elapsed_sec)
            analysis_time = time.time() - start_time
            
            # 경과 시간 업데이트
            self.elapsed_sec += duration
            
            # 결과 표시
            self.display_results(result, duration, analysis_time)
            
        except Exception as e:
            self.log_message(f"❌ 분석 오류: {e}")
            self.status_label.config(text="분석 실패")
            
    def display_results(self, result, duration, analysis_time):
        """결과 표시"""
        try:
            # 기본 정보 업데이트
            transcript = result.get('transcript', '전사 실패')
            self.transcript_label.config(text=transcript)
            
            emotion = result.get('emotion', '감정 분석 실패')
            emotion_score = result.get('emotion_score', 0.0)
            self.emotion_label.config(text=f"{emotion} ({emotion_score:.3f})")
            
            total_score = result.get('total_score', 0.0)
            self.total_score_label.config(text=f"{total_score:.1f}/100")
            
            voice_tone_score = result.get('voice_tone_score', 0.0)
            self.voice_tone_label.config(text=f"{voice_tone_score:.1f}/100")
            
            word_choice_score = result.get('word_choice_score', 0.0)
            self.word_choice_label.config(text=f"{word_choice_score:.1f}/100")
            
            self.time_label.config(text=f"오디오: {duration:.2f}초, 분석: {analysis_time:.2f}초, 경과: {self.elapsed_sec:.1f}초")
            
            # 상세 로그 업데이트
            self.log_message(f"📝 전사: {transcript}")
            self.log_message(f"😊 감정: {emotion} ({emotion_score:.3f})")
            self.log_message(f"📊 총점: {total_score:.1f}/100")
            self.log_message(f"🎤 음성 톤 점수: {voice_tone_score:.1f}/100")
            self.log_message(f"💬 단어 선택 점수: {word_choice_score:.1f}/100")
            
            # 음성 톤 상세 점수
            voice_details = result.get('voice_details', {})
            if voice_details:
                self.log_message(f"   - 따뜻함: {voice_details.get('warmth', 0.0):.2f}")
                self.log_message(f"   - 공손함: {voice_details.get('politeness', 0.0):.2f}")
                self.log_message(f"   - 일관성: {voice_details.get('consistency', 0.0):.2f}")
                self.log_message(f"   - 열정: {voice_details.get('enthusiasm', 0.0):.2f}")
                self.log_message(f"   - 자신감: {voice_details.get('confidence', 0.0):.2f}")
                self.log_message(f"   - 볼륨 강도: {voice_details.get('volume_strength', 0.0):.2f}")
            
            # 단어 선택 상세 점수
            word_details = result.get('word_details', {})
            if word_details:
                self.log_message(f"   - 공손함: {word_details.get('politeness', 0.0):.2f}")
                self.log_message(f"   - 공감: {word_details.get('empathy', 0.0):.2f}")
                self.log_message(f"   - 열정: {word_details.get('enthusiasm', 0.0):.2f}")
                self.log_message(f"   - 정서 밸런스(valence): {word_details.get('valence', 0.0):.2f}")
            
            # 가중치 정보
            weights = result.get('weights', {})
            if weights:
                self.log_message(f"⚖️ 가중치: 음성톤({weights.get('voice', 0.4):.1f}) + 단어선택({weights.get('word', 0.4):.1f}) + 감정({weights.get('emotion', 0.2):.1f})")
            
            # 긍정/부정 단어 분석
            positive_words = result.get('positive_words', [])
            negative_words = result.get('negative_words', [])
            if positive_words:
                self.log_message(f"✅ 긍정적 단어: {', '.join(positive_words[:5])}")
            if negative_words:
                self.log_message(f"⚠️ 부정적 단어: {', '.join(negative_words[:5])}")
            
            self.log_message(f"⏱️ 분석 완료: {analysis_time:.2f}초")
            
            self.status_label.config(text="분석 완료")
            
        except Exception as e:
            self.log_message(f"❌ 결과 표시 오류: {e}")
            self.status_label.config(text="표시 오류")
            
    def run(self):
        """애플리케이션 실행"""
        self.log_message("🚀 Voice System Test 시작")
        self.log_message("💡 녹음 버튼을 클릭하여 테스트를 시작하세요")
        self.log_message("🔄 새로운 Voice System으로 음성 분석을 수행합니다")
        
        self.root.mainloop()

if __name__ == "__main__":
    app = VoiceSystemTest()
    app.run()
