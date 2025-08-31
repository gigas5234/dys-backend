#!/usr/bin/env python3
"""
실시간 표정 분석기 - MLflow PyTorch 모델 통합
"""

import torch
import numpy as np
import cv2
from PIL import Image
import base64
import io
import os
from typing import Dict, Any, Optional, List, Tuple
import logging

# 새로운 구조에 맞게 import 경로 수정
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

# MLflow는 선택적으로 import
try:
    import mlflow.pytorch
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    print("⚠️ MLflow 없음 - PyTorch 직접 로드 방식 사용")

class ExpressionAnalyzer:
    """MLflow PyTorch 모델을 사용한 실시간 표정 분석기"""
    
    def __init__(self):
        self.model = None
        self.device = None
        self.expression_categories = [
            'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral', 'contempt'
        ]
        self.is_initialized = False
        self.logger = logging.getLogger(__name__)
        
    def _ensure_vit_runtime_compat(self):
        """Transformers 버전/가중치 불일치로 인한 런타임 오류를 예방하기 위한 호환성 패치."""
        try:
            import torch.nn as nn
        except Exception:
            return
        
        # config 필드 보강
        if hasattr(self.model, 'config'):
            cfg = self.model.config
            if not hasattr(cfg, 'output_attentions'):
                cfg.output_attentions = False
            if not hasattr(cfg, 'output_hidden_states'):
                cfg.output_hidden_states = False
            if not hasattr(cfg, 'use_return_dict'):
                cfg.use_return_dict = True
            if not hasattr(cfg, 'attention_probs_dropout_prob'):
                cfg.attention_probs_dropout_prob = 0.0
        
        def patch_module(m):
            # ViT Self-Attention 계층에 dropout 속성이 없는 경우 주입
            class_name = m.__class__.__name__
            if class_name == 'ViTSelfAttention':
                if not hasattr(m, 'dropout'):
                    p = 0.0
                    try:
                        if hasattr(self.model, 'config') and hasattr(self.model.config, 'attention_probs_dropout_prob'):
                            p = float(self.model.config.attention_probs_dropout_prob)
                    except Exception:
                        p = 0.0
                    try:
                        m.dropout = nn.Dropout(p)
                        self.logger.info(f"🔧 ViTSelfAttention.dropout 추가(p={p})")
                    except Exception:
                        m.dropout = nn.Identity()
                        self.logger.info("🔧 ViTSelfAttention.dropout=Identity()로 대체")
            return m
        
        # 하위 모듈 순회하며 패치 적용
        try:
            for name, module in self.model.named_modules():
                patch_module(module)
        except Exception as e:
            self.logger.warning(f"⚠️ ViT 호환성 패치 중 경고: {e}")
        
    def initialize(self):
        """모델을 초기화합니다."""
        try:
            self.logger.info("🤖 표정 분석기 초기화 시작...")
            
            # MLflow 모델 경로들 (우선순위 순서)
            mlflow_paths = [
                # 현재 스크립트 기준 상대 경로 (가장 우선)
                os.path.join(os.path.dirname(__file__), "models"),
                # 서버 실행 디렉토리 기준
                os.path.join(os.getcwd(), "src", "backend", "models", "ml_models"),
                os.path.join(os.getcwd(), "backend", "models", "ml_models"),
                # GKE 환경 절대 경로
                "/workspace/app/src/backend/models/ml_models",
                "/usr/src/app/src/backend/models/ml_models",
                # 추가 가능한 경로들
                "/app/src/backend/models/ml_models",
                "/opt/app/src/backend/models/ml_models"
            ]
            
            model_loaded = False
            
            # MLflow 모델 로드 시도
            if MLFLOW_AVAILABLE:
                self.logger.info("🔄 MLflow 모델 로딩 시도 중...")
                for model_path in mlflow_paths:
                    try:
                        self.logger.info(f"📁 MLflow 모델 경로 시도: {os.path.abspath(model_path)}")
                        if os.path.exists(model_path) and os.path.exists(os.path.join(model_path, "MLmodel")):
                            self.logger.info("🔄 MLflow 모델 로딩 중...")
                            
                            # MLflow 모델 로드 (CPU 매핑으로 CUDA 호환성 문제 해결)
                            # PyTorch 버전 불일치 경고 무시
                            import warnings
                            with warnings.catch_warnings():
                                warnings.filterwarnings("ignore", category=UserWarning)
                                
                                try:
                                    # 먼저 MLflow로 시도
                                    self.model = mlflow.pytorch.load_model(
                                        model_path, 
                                        map_location='cpu'
                                    )
                                except Exception as mlflow_error:
                                    self.logger.warning(f"⚠️ MLflow 로딩 실패, 직접 PyTorch 로딩 시도: {mlflow_error}")
                                    
                                    # MLflow 실패시 직접 PyTorch로 로드
                                    import torch
                                    model_file = os.path.join(model_path, "data", "model.pth")
                                    if os.path.exists(model_file):
                                        self.model = torch.load(model_file, map_location='cpu', weights_only=False)
                                        self.logger.info(f"✅ 직접 PyTorch 로딩 성공: {model_file}")
                                    else:
                                        raise FileNotFoundError(f"모델 파일을 찾을 수 없음: {model_file}")
                            
                            # ViT 모델 호환성 패치 적용
                            self._ensure_vit_runtime_compat()
                            
                            self.logger.info(f"✅ MLflow 모델 로드 완료: {model_path}")
                            self.logger.info(f"📊 모델 정보: {type(self.model)}")
                            model_loaded = True
                            self.is_initialized = True
                            break
                        else:
                            self.logger.warning(f"⚠️ MLflow 모델 파일 없음: {model_path}")
                            self.logger.warning(f"   - 디렉토리 존재: {os.path.exists(model_path)}")
                            self.logger.warning(f"   - MLmodel 파일 존재: {os.path.exists(os.path.join(model_path, 'MLmodel'))}")
                    except Exception as e:
                        self.logger.warning(f"⚠️ MLflow 모델 경로 실패: {model_path}")
                        self.logger.warning(f"   - 오류: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
            else:
                self.logger.warning("⚠️ MLflow가 사용 불가능 - PyTorch 직접 로드로 진행")
            
            # PyTorch 직접 로드 시도 (.pth 파일)
            if not model_loaded:
                model_file_paths = [
                    os.environ.get('MODEL_PATH'),  # 환경변수에서 먼저 확인
                    os.path.join(os.path.dirname(__file__), "models", "data", "model.pth"),
                    os.path.join(os.getcwd(), "src", "backend", "models", "ml_models", "data", "model.pth"),
                    os.path.join(os.getcwd(), "backend", "models", "ml_models", "data", "model.pth"),
                    "/workspace/app/src/backend/models/ml_models/data/model.pth",
                    "/usr/src/app/src/backend/models/ml_models/data/model.pth"
                ]
                
                for model_file in model_file_paths:
                    try:
                        self.logger.info(f"📁 PyTorch 모델 파일 시도: {os.path.abspath(model_file)}")
                        if os.path.exists(model_file):
                            self.logger.info("🔄 PyTorch 모델 로딩 중...")
                            
                            # transformers 모델인 경우 처리
                            try:
                                # 먼저 일반 PyTorch 모델로 시도
                                self.model = torch.load(model_file, map_location='cpu')
                                
                                # ViT 모델인 경우 config 속성 확인 및 추가
                                if hasattr(self.model, 'config'):
                                    if not hasattr(self.model.config, 'output_attentions'):
                                        self.model.config.output_attentions = False
                                        self.logger.info("🔧 output_attentions 속성 추가")
                                    if not hasattr(self.model.config, 'output_hidden_states'):
                                        self.model.config.output_hidden_states = False
                                        self.logger.info("🔧 output_hidden_states 속성 추가")
                                    if not hasattr(self.model.config, 'use_return_dict'):
                                        self.model.config.use_return_dict = True
                                        self.logger.info("🔧 use_return_dict 속성 추가")
                                
                                self.logger.info(f"✅ PyTorch 모델 로드 완료: {model_file}")
                                model_loaded = True
                                self.is_initialized = True
                                break
                            except Exception as pytorch_error:
                                self.logger.warning(f"⚠️ 일반 PyTorch 로드 실패: {pytorch_error}")
                                
                                # transformers 모델로 시도
                                try:
                                    self.logger.info("🔄 Transformers 모델로 재시도...")
                                    
                                    # Transformers 라이브러리가 있는 경우 실제 모델 로드
                                    try:
                                        from transformers import ViTForImageClassification, ViTConfig
                                        self.logger.info("✅ Transformers 라이브러리 확인됨")
                                        
                                        # 실제 모델 파일에서 로드
                                        # 먼저 저장된 모델 타입 확인
                                        model_dict = torch.load(model_file, map_location='cpu')
                                        self.logger.info(f"🔍 모델 딕셔너리 키: {list(model_dict.keys())}")
                                        
                                        # 호환 가능한 ViT 설정으로 모델 생성
                                        try:
                                            # 최신 버전용 설정
                                            config = ViTConfig(
                                                image_size=384,  # 고화질 대응
                                                patch_size=16,
                                                num_channels=3,
                                                num_labels=8,  # 8개 감정 카테고리
                                                hidden_size=768,
                                                num_hidden_layers=12,
                                                num_attention_heads=12,
                                                intermediate_size=3072,
                                                output_attentions=False,  # 명시적으로 False 설정
                                                output_hidden_states=False,
                                                use_return_dict=True
                                            )
                                        except TypeError:
                                            # 구버전 호환 설정 (output_attentions 속성이 없는 경우)
                                            config = ViTConfig(
                                                image_size=384,  # 고화질 대응
                                                patch_size=16,
                                                num_channels=3,
                                                num_labels=8,  # 8개 감정 카테고리
                                                hidden_size=768,
                                                num_hidden_layers=12,
                                                num_attention_heads=12,
                                                intermediate_size=3072
                                            )
                                        
                                        # 새 모델 생성
                                        self.model = ViTForImageClassification(config)
                                        
                                        # ViTConfig에 누락된 속성들 강제 추가
                                        if not hasattr(self.model.config, 'output_attentions'):
                                            self.model.config.output_attentions = False
                                        if not hasattr(self.model.config, 'output_hidden_states'):
                                            self.model.config.output_hidden_states = False
                                        if not hasattr(self.model.config, 'use_return_dict'):
                                            self.model.config.use_return_dict = True
                                        
                                        # 저장된 모델이 state_dict 형태인지 확인하고 로드
                                        if isinstance(model_dict, dict):
                                            if 'state_dict' in model_dict:
                                                state_dict = model_dict['state_dict']
                                            elif 'model_state_dict' in model_dict:
                                                state_dict = model_dict['model_state_dict']
                                            else:
                                                # 전체가 state_dict인 경우
                                                state_dict = model_dict
                                            
                                            # 키 이름 정리 (모델 프리픽스 제거)
                                            cleaned_state_dict = {}
                                            for key, value in state_dict.items():
                                                new_key = key.replace('model.', '').replace('module.', '')
                                                cleaned_state_dict[new_key] = value
                                            
                                            # strict=False로 호환되지 않는 키 무시
                                            missing_keys, unexpected_keys = self.model.load_state_dict(cleaned_state_dict, strict=False)
                                            if missing_keys:
                                                self.logger.warning(f"⚠️ 누락된 키: {len(missing_keys)}개")
                                            if unexpected_keys:
                                                self.logger.warning(f"⚠️ 예상치 못한 키: {len(unexpected_keys)}개")
                                        else:
                                            # 직접 모델 객체인 경우
                                            self.model = model_dict
                                        
                                        self.logger.info(f"✅ ViT 모델 로드 완료: {model_file}")
                                        model_loaded = True
                                        self.is_initialized = True
                                        break
                                        
                                    except ImportError:
                                        self.logger.warning("⚠️ Transformers 라이브러리 없음 - 더미 모델 생성")
                                        # 개발용 더미 모델
                                        import torch.nn as nn
                                        
                                        class DummyExpressionModel(nn.Module):
                                            def __init__(self):
                                                super().__init__()
                                                self.classifier = nn.Linear(768, 8)  # 8개 표정 클래스
                                                
                                            def forward(self, x):
                                                # 더미 결과 생성
                                                batch_size = x.shape[0] if len(x.shape) > 0 else 1
                                                logits = torch.randn(batch_size, 8)  # 8개 표정
                                                
                                                # ImageClassifierOutput 스타일 객체 생성
                                                class Output:
                                                    def __init__(self, logits):
                                                        self.logits = logits
                                                
                                                return Output(logits)
                                        
                                        self.model = DummyExpressionModel()
                                        self.logger.warning(f"⚠️ 더미 표정 분석 모델 생성 (개발용): {model_file}")
                                        model_loaded = True
                                        self.is_initialized = True
                                        break
                                    
                                except Exception as transformers_error:
                                    self.logger.warning(f"⚠️ Transformers 모델 로드도 실패: {transformers_error}")
                                    continue
                    except Exception as e:
                        self.logger.warning(f"⚠️ PyTorch 모델 파일 실패: {model_file}")
                        self.logger.warning(f"   - 오류: {e}")
                        continue
            
            if not model_loaded:
                self.logger.error("❌ 모든 모델 로드 시도 실패")
                return False
            
            # 모델을 평가 모드로 설정
            self.model.eval()
            
            # CUDA 사용 가능 여부 확인 및 설정
            if torch.cuda.is_available():
                self.device = torch.device('cuda')
                self.model = self.model.to(self.device)
                self.logger.info("🚀 CUDA 사용 가능 - GPU 가속 활성화")
            else:
                self.device = torch.device('cpu')
                self.logger.info("💻 CPU 모드로 실행")
            
            self.logger.info("✅ 표정 분석기 초기화 완료")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 표정 분석기 초기화 실패: {e}")
            import traceback
            traceback.print_exc()
            return False

    def preprocess_image(self, image_data: str) -> Optional[torch.Tensor]:
        """이미지를 모델 입력 형식으로 전처리합니다."""
        try:
            # Base64 디코딩
            if image_data.startswith('data:image'):
                # data:image/jpeg;base64, 형태 제거
                image_data = image_data.split(',')[1]
            
            # Base64 디코딩
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # RGB 변환
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # 리사이즈 (384x384) - 고화질 대응
            image = image.resize((384, 384), Image.Resampling.LANCZOS)
            
            # numpy 배열로 변환
            image_array = np.array(image)
            
            # 정규화 (0-1 범위)
            image_array = image_array.astype(np.float32) / 255.0
            
            # PyTorch 텐서로 변환
            image_tensor = torch.from_numpy(image_array).permute(2, 0, 1)  # HWC -> CHW
            
            # 배치 차원 추가
            image_tensor = image_tensor.unsqueeze(0)
            
            # 디바이스로 이동
            image_tensor = image_tensor.to(self.device)
            
            return image_tensor
            
        except Exception as e:
            self.logger.error(f"❌ 이미지 전처리 실패: {e}")
            return None

    def analyze_expression(self, image_data: str) -> Dict[str, Any]:
        """이미지에서 표정을 분석합니다."""
        try:
            if not self.is_initialized:
                self.logger.error("❌ 모델이 초기화되지 않았습니다")
                return {
                    'success': False,
                    'error': 'Model not initialized',
                    'expressions': {},
                    'dominant_expression': None,
                    'confidence': 0.0
                }
            
            # 이미지 전처리
            image_tensor = self.preprocess_image(image_data)
            if image_tensor is None:
                return {
                    'success': False,
                    'error': 'Image preprocessing failed',
                    'expressions': {},
                    'dominant_expression': None,
                    'confidence': 0.0
                }
            
            # 모델 추론
            with torch.no_grad():
                outputs = self.model(image_tensor)
                
                # logits 추출
                if hasattr(outputs, 'logits'):
                    logits = outputs.logits
                else:
                    logits = outputs
                
                # 소프트맥스 적용하여 확률 계산
                probabilities = torch.softmax(logits, dim=1)
                
                # CPU로 이동하여 numpy로 변환
                probabilities = probabilities.cpu().numpy()[0]
                
                # 결과 구성
                expressions = {}
                for i, category in enumerate(self.expression_categories):
                    expressions[category] = float(probabilities[i])
                
                # 가장 높은 확률의 표정 찾기
                dominant_idx = np.argmax(probabilities)
                dominant_expression = self.expression_categories[dominant_idx]
                confidence = float(probabilities[dominant_idx])
                
                return {
                    'success': True,
                    'expressions': expressions,
                    'dominant_expression': dominant_expression,
                    'confidence': confidence,
                    'probabilities': probabilities.tolist()
                }
                
        except Exception as e:
            self.logger.error(f"❌ 표정 분석 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e),
                'expressions': {},
                'dominant_expression': None,
                'confidence': 0.0
            }

    def analyze_expression_batch(self, image_data_list: List[str]) -> List[Dict[str, Any]]:
        """여러 이미지의 표정을 일괄 분석합니다."""
        results = []
        for image_data in image_data_list:
            result = self.analyze_expression(image_data)
            results.append(result)
        return results

    def get_expression_summary(self, analysis_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """여러 분석 결과를 종합하여 요약합니다."""
        try:
            if not analysis_results:
                return {
                    'success': False,
                    'error': 'No analysis results',
                    'summary': {}
                }
            
            # 성공한 결과만 필터링
            successful_results = [r for r in analysis_results if r.get('success', False)]
            
            if not successful_results:
                return {
                    'success': False,
                    'error': 'No successful analysis results',
                    'summary': {}
                }
            
            # 각 표정별 평균 확률 계산
            expression_sums = {category: 0.0 for category in self.expression_categories}
            expression_counts = {category: 0 for category in self.expression_categories}
            
            for result in successful_results:
                expressions = result.get('expressions', {})
                for category, probability in expressions.items():
                    expression_sums[category] += probability
                    expression_counts[category] += 1
            
            # 평균 계산
            expression_averages = {}
            for category in self.expression_categories:
                if expression_counts[category] > 0:
                    expression_averages[category] = expression_sums[category] / expression_counts[category]
                else:
                    expression_averages[category] = 0.0
            
            # 가장 많이 나타난 표정 찾기
            dominant_expression = max(expression_averages.items(), key=lambda x: x[1])
            
            return {
                'success': True,
                'summary': {
                    'expression_averages': expression_averages,
                    'dominant_expression': dominant_expression[0],
                    'dominant_confidence': dominant_expression[1],
                    'total_analyses': len(successful_results),
                    'success_rate': len(successful_results) / len(analysis_results)
                }
            }
            
        except Exception as e:
            self.logger.error(f"❌ 표정 분석 요약 실패: {e}")
            return {
                'success': False,
                'error': str(e),
                'summary': {}
            }
    
    def analyze_expression_sync(self, image) -> Dict[str, Any]:
        """
        동기식 표정 분석 (하이브리드 모드용)
        
        Args:
            image: OpenCV 형식 이미지 (BGR)
            
        Returns:
            Dict: 분석 결과 {'success': bool, 'emotion': str, 'confidence': float, ...}
        """
        try:
            self.logger.info("🧠 [EXPRESSION_SYNC] 동기식 표정 분석 시작")
            
            if not self.is_initialized or not self.model:
                self.logger.warning("⚠️ [EXPRESSION_SYNC] 모델이 초기화되지 않음")
                return {
                    "success": False,
                    "error": "모델이 초기화되지 않음",
                    "emotion": "neutral",
                    "confidence": 0.0,
                    "happiness": 0.0,
                    "sadness": 0.0,
                    "anger": 0.0,
                    "surprise": 0.0
                }
            
            # 이미지 전처리
            processed_image = self._preprocess_image(image)
            if processed_image is None:
                return {
                    "success": False,
                    "error": "이미지 전처리 실패",
                    "emotion": "neutral", 
                    "confidence": 0.0,
                    "happiness": 0.0,
                    "sadness": 0.0,
                    "anger": 0.0,
                    "surprise": 0.0
                }
            
            # 모델 추론
            self.model.eval()
            with torch.no_grad():
                if processed_image.dim() == 3:
                    processed_image = processed_image.unsqueeze(0)  # 배치 차원 추가
                
                # GPU 사용 가능하면 GPU로, 아니면 CPU로
                processed_image = processed_image.to(self.device)
                
                outputs = self.model(processed_image)
                
                # 결과 처리 (모델 타입에 따라 다르게)
                if hasattr(outputs, 'logits'):
                    logits = outputs.logits
                else:
                    logits = outputs
                
                # 소프트맥스로 확률 계산
                probabilities = torch.softmax(logits, dim=1)
                predicted_class = torch.argmax(probabilities, dim=1).item()
                confidence = torch.max(probabilities).item()
                
                # 감정 레이블 매핑
                emotion = self.expression_categories[predicted_class] if predicted_class < len(self.expression_categories) else "neutral"
                
                # 각 감정별 확률 계산
                emotion_scores = {}
                for i, category in enumerate(self.expression_categories):
                    if i < probabilities.shape[1]:
                        emotion_scores[category] = probabilities[0][i].item()
                
                self.logger.info(f"✅ [EXPRESSION_SYNC] 분석 완료: {emotion} (신뢰도: {confidence:.3f})")
                
                return {
                    "success": True,
                    "emotion": emotion,
                    "confidence": confidence,
                    "expression": confidence * 100,  # UI에서 사용하는 형식
                    "concentration": emotion_scores.get('neutral', 0.5) * 100,  # 중립일 때 집중도 높음
                    "happiness": emotion_scores.get('happy', 0.0) * 100,
                    "sadness": emotion_scores.get('sad', 0.0) * 100,
                    "anger": emotion_scores.get('angry', 0.0) * 100,
                    "surprise": emotion_scores.get('surprised', 0.0) * 100,
                    "fear": emotion_scores.get('fearful', 0.0) * 100,
                    "disgust": emotion_scores.get('disgusted', 0.0) * 100,
                    "neutral": emotion_scores.get('neutral', 0.0) * 100,
                    "all_scores": emotion_scores,
                    "predicted_class": predicted_class,
                    "processing_device": str(self.device)
                }
                
        except Exception as e:
            self.logger.error(f"❌ [EXPRESSION_SYNC] 동기식 분석 실패: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                "success": False,
                "error": str(e),
                "emotion": "neutral",
                "confidence": 0.0,
                "happiness": 0.0,
                "sadness": 0.0,
                "anger": 0.0,
                "surprise": 0.0
            }

# 전역 인스턴스
expression_analyzer = ExpressionAnalyzer()
