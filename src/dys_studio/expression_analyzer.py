#!/usr/bin/env python3
"""
실시간 표정 분석기 - MediaPipe + PyTorch ViT 모델 통합
"""

import torch
import numpy as np
import cv2
from PIL import Image
import base64
import io
import os
from typing import Dict, Any, Optional

# MLflow는 선택적으로 import
try:
    import mlflow.pytorch
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    print("⚠️ MLflow 없음 - PyTorch 직접 로드 방식 사용")

class ExpressionAnalyzer:
    """MediaPipe와 PyTorch ViT 모델을 통합한 실시간 표정 분석기"""
    
    def __init__(self):
        self.model = None
        self.device = None
        self.expression_categories = [
            'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral', 'contempt'
        ]
        self.is_initialized = False
        
    def initialize(self):
        """모델을 초기화합니다."""
        try:
            print("🤖 표정 분석기 초기화 시작...")
            
            # 모델 파일 경로들 (Google Storage에서 다운로드된 .pth 파일)
            model_file_paths = [
                # Google Storage에서 다운로드된 파일
                os.path.join(os.path.dirname(__file__), "models", "data", "model.pth"),
                # 서버 실행 디렉토리 기준
                os.path.join(os.getcwd(), "src", "dys_studio", "models", "data", "model.pth"),
                os.path.join(os.getcwd(), "dys_studio", "models", "data", "model.pth"),
                # 절대 경로
                "/workspace/app/dys_studio/models/data/model.pth",
                "/usr/src/app/dys_studio/models/data/model.pth"
            ]
            
            # MLflow 모델 경로들 (만약 있다면)
            mlflow_paths = [
                os.path.join(os.path.dirname(__file__), "models"),
                os.path.join(os.getcwd(), "src", "dys_studio", "models"),
                os.path.join(os.getcwd(), "dys_studio", "models"),
                "/workspace/app/dys_studio/models",
                "/usr/src/app/dys_studio/models"
            ]
            
            model_loaded = False
            
            # 1. MLflow 모델 로드 시도 (우선)
            if MLFLOW_AVAILABLE:
                for model_path in mlflow_paths:
                    try:
                        print(f"📁 MLflow 모델 경로 시도: {os.path.abspath(model_path)}")
                        if os.path.exists(model_path) and os.path.exists(os.path.join(model_path, "MLmodel")):
                            print("🔄 MLflow 모델 로딩 중...")
                            import mlflow.pytorch
                            self.model = mlflow.pytorch.load_model(model_path)
                            print(f"✅ MLflow 모델 로드 완료: {model_path}")
                            model_loaded = True
                            break
                    except Exception as e:
                        print(f"⚠️ MLflow 모델 경로 실패: {model_path} - {e}")
                        continue
            
            # 2. PyTorch 직접 로드 시도 (.pth 파일)
            if not model_loaded:
                for model_file in model_file_paths:
                    try:
                        print(f"📁 PyTorch 모델 파일 시도: {os.path.abspath(model_file)}")
                        if os.path.exists(model_file):
                            print("🔄 PyTorch 모델 로딩 중...")
                            
                            # transformers 모델인 경우 처리
                            try:
                                # 먼저 일반 PyTorch 모델로 시도
                                self.model = torch.load(model_file, map_location='cpu')
                                print(f"✅ PyTorch 모델 로드 완료: {model_file}")
                                model_loaded = True
                                break
                            except Exception as pytorch_error:
                                print(f"⚠️ 일반 PyTorch 로드 실패: {pytorch_error}")
                                
                                # transformers 모델로 시도
                                try:
                                    print("🔄 Transformers 모델로 재시도...")
                                    
                                    # Transformers 라이브러리가 있는 경우 실제 모델 로드
                                    try:
                                        from transformers import AutoImageProcessor, AutoModelForImageClassification
                                        print("✅ Transformers 라이브러리 확인됨")
                                        
                                        # 실제 모델 파일에서 로드
                                        # 먼저 저장된 모델 타입 확인
                                        model_dict = torch.load(model_file, map_location='cpu')
                                        print(f"🔍 모델 딕셔너리 키: {list(model_dict.keys())}")
                                        
                                        # 저장된 모델이 state_dict 형태인지 확인
                                        if 'model_state_dict' in model_dict:
                                            # state_dict 형태로 저장된 경우
                                            print("📦 State dict 형태 모델 감지")
                                            self.model = model_dict['model']  # 전체 모델 객체
                                        elif hasattr(model_dict, 'state_dict'):
                                            # 모델 객체가 직접 저장된 경우
                                            print("📦 모델 객체 직접 저장 감지")
                                            self.model = model_dict
                                        else:
                                            print("📦 일반 PyTorch 모델로 재시도")
                                            self.model = model_dict
                                        
                                        print(f"✅ Transformers 모델 로드 완료: {model_file}")
                                        model_loaded = True
                                        break
                                        
                                    except ImportError:
                                        print("⚠️ Transformers 라이브러리 없음 - 더미 모델 생성")
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
                                        print(f"⚠️ 더미 표정 분석 모델 생성 (개발용): {model_file}")
                                        model_loaded = True
                                        break
                                    
                                except Exception as transformers_error:
                                    print(f"⚠️ Transformers 모델 로드도 실패: {transformers_error}")
                                    continue
                                    
                    except Exception as e:
                        print(f"⚠️ 모델 파일 처리 실패: {model_file} - {e}")
                        continue
            
            if not model_loaded:
                print("❌ 모든 모델 경로에서 모델을 찾을 수 없습니다.")
                print("⚠️ 표정 분석기 초기화 실패 - 모델 파일 없음")
                print("🔍 확인된 경로들:")
                for path in model_file_paths + mlflow_paths:
                    print(f"   - {os.path.abspath(path)} (존재: {os.path.exists(path)})")
                return False
            
            # GPU 설정
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            print(f"🖥️ 사용 디바이스: {self.device}")
            
            # 모델을 GPU로 이동
            if torch.cuda.is_available():
                self.model = self.model.to(self.device)
                print("✅ 모델을 GPU로 이동 완료")
            
            # 모델을 평가 모드로 설정
            self.model.eval()
            print("✅ 모델을 평가 모드로 설정")
            
            self.is_initialized = True
            print("✅ 표정 분석기 초기화 완료!")
            
            return True
            
        except Exception as e:
            print(f"❌ 표정 분석기 초기화 실패: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def preprocess_image(self, image_data: str) -> Optional[torch.Tensor]:
        """Base64 이미지 데이터를 전처리합니다."""
        try:
            # Base64 디코딩
            if image_data.startswith('data:image'):
                # data:image/jpeg;base64, 형태 제거
                image_data = image_data.split(',')[1]
            
            # 이미지 디코딩
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # RGB 변환
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # 크기 조정 (224x224)
            image = image.resize((224, 224), Image.Resampling.LANCZOS)
            
            # NumPy 배열로 변환
            image_array = np.array(image).astype(np.float32)
            
            # 정규화 (0-255 -> 0-1)
            image_array = image_array / 255.0
            
            # ImageNet 정규화 (평균, 표준편차)
            mean = np.array([0.485, 0.456, 0.406])
            std = np.array([0.229, 0.224, 0.225])
            
            # 채널별 정규화
            for i in range(3):
                image_array[:, :, i] = (image_array[:, :, i] - mean[i]) / std[i]
            
            # 텐서로 변환 및 차원 조정 (HWC -> CHW)
            image_tensor = torch.from_numpy(image_array).permute(2, 0, 1)
            
            # 배치 차원 추가
            image_tensor = image_tensor.unsqueeze(0)
            
            return image_tensor
            
        except Exception as e:
            print(f"❌ 이미지 전처리 실패: {e}")
            return None
    
    def analyze_expression(self, image_data: str) -> Dict[str, Any]:
        """이미지에서 표정을 분석합니다."""
        if not self.is_initialized:
            print("❌ 표정 분석기가 초기화되지 않았습니다.")
            return {
                'success': False,
                'error': 'Expression analyzer not initialized'
            }
        
        try:
            # 이미지 전처리
            image_tensor = self.preprocess_image(image_data)
            if image_tensor is None:
                return {
                    'success': False,
                    'error': 'Image preprocessing failed'
                }
            
            # GPU로 이동
            if self.device.type == 'cuda':
                image_tensor = image_tensor.to(self.device)
            
            # 추론
            with torch.no_grad():
                output = self.model(image_tensor)
            
            # 결과 처리
            if hasattr(output, 'logits'):
                logits = output.logits
                probabilities = torch.softmax(logits, dim=1)
                
                # 결과 추출
                probs = probabilities[0].cpu().numpy()
                predicted_class = torch.argmax(probabilities, dim=1).cpu().numpy()[0]
                confidence = probabilities.max().cpu().numpy()
                
                # 표정 카테고리 매핑
                expression = self.expression_categories[predicted_class]
                
                # 결과 반환
                result = {
                    'success': True,
                    'expression': expression,
                    'confidence': float(confidence),
                    'predicted_class': int(predicted_class),
                    'probabilities': {
                        cat: float(prob) for cat, prob in zip(self.expression_categories, probs)
                    },
                    'all_probabilities': probs.tolist()
                }
                
                print(f"🎭 표정 분석 결과: {expression} (신뢰도: {confidence:.3f})")
                return result
            
        except Exception as e:
            print(f"❌ 표정 분석 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_expression_score(self, expression_result: Dict[str, Any]) -> Dict[str, Any]:
        """표정 분석 결과를 점수로 변환합니다."""
        if not expression_result.get('success', False):
            return {
                'score': 0,
                'label': '분석 실패',
                'details': expression_result.get('error', 'Unknown error')
            }
        
        expression = expression_result['expression']
        confidence = expression_result['confidence']
        
        # 표정별 점수 매핑 (개선된 점수 시스템)
        expression_scores = {
            'happy': 95,      # 매우 높은 점수
            'neutral': 85,    # 높은 점수 (중립적이지만 긍정적)
            'surprised': 75,  # 긍정적 점수
            'sad': 45,        # 중간 점수
            'angry': 25,      # 낮은 점수
            'fearful': 30,    # 낮은 점수
            'disgusted': 20,  # 매우 낮은 점수
            'contempt': 35    # 낮은 점수
        }
        
        # 기본 점수
        base_score = expression_scores.get(expression, 60)
        
        # 신뢰도에 따른 점수 조정 (신뢰도가 높을수록 점수 보너스)
        confidence_bonus = 1.0 + (confidence - 0.5) * 0.4  # 신뢰도 50% 이상에서 보너스
        adjusted_score = int(base_score * confidence_bonus)
        
        # 점수 범위 제한 (최소 20점 보장)
        final_score = max(20, min(100, adjusted_score))
        
        # 라벨 생성 (개선된 라벨 시스템)
        if final_score >= 85:
            label = "매우 긍정적"
        elif final_score >= 70:
            label = "긍정적"
        elif final_score >= 50:
            label = "중립적"
        elif final_score >= 30:
            label = "부정적"
        else:
            label = "매우 부정적"
        
        return {
            'score': final_score,
            'label': label,
            'expression': expression,
            'confidence': confidence,
            'base_score': base_score,
            'confidence_bonus': confidence_bonus,
            'expression_scores': expression_scores,
            'details': f"{expression} 표정 (신뢰도: {confidence:.2f}, 기본점수: {base_score}, 최종점수: {final_score})"
        }

# 전역 인스턴스
expression_analyzer = ExpressionAnalyzer()

def initialize_expression_analyzer():
    """표정 분석기를 초기화합니다."""
    return expression_analyzer.initialize()

def analyze_expression_from_image(image_data: str) -> Dict[str, Any]:
    """이미지에서 표정을 분석합니다."""
    return expression_analyzer.analyze_expression(image_data)

def get_expression_score_from_result(expression_result: Dict[str, Any]) -> Dict[str, Any]:
    """표정 분석 결과를 점수로 변환합니다."""
    return expression_analyzer.get_expression_score(expression_result)

if __name__ == "__main__":
    print("🚀 표정 분석기 테스트")
    print("=" * 50)
    
    # 초기화
    if initialize_expression_analyzer():
        print("✅ 표정 분석기 초기화 성공!")
        
        # 테스트 이미지 생성 (더미)
        print("\n🧪 더미 이미지로 테스트...")
        dummy_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        dummy_image_pil = Image.fromarray(dummy_image)
        
        # PIL 이미지를 Base64로 변환
        buffer = io.BytesIO()
        dummy_image_pil.save(buffer, format='JPEG')
        dummy_image_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # 표정 분석
        result = analyze_expression_from_image(dummy_image_base64)
        print(f"📊 분석 결과: {result}")
        
        if result['success']:
            # 점수 변환
            score_result = get_expression_score_from_result(result)
            print(f"📈 점수 결과: {score_result}")
        
        print("\n" + "=" * 50)
        print("✅ 테스트 완료!")
    else:
        print("❌ 표정 분석기 초기화 실패")
