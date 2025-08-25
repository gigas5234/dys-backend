import json
import os
from typing import Dict, List, Optional
from datetime import datetime

class PersonaManager:
    """JSON 기반 페르소나 관리 시스템"""
    
    def __init__(self, personas_dir: str = "personas"):
        self.personas_dir = personas_dir
        self.config_file = os.path.join(personas_dir, "personas_config.json")
        self.ensure_directory()
    
    def ensure_directory(self):
        """디렉토리와 설정 파일 생성"""
        if not os.path.exists(self.personas_dir):
            os.makedirs(self.personas_dir)
        
        if not os.path.exists(self.config_file):
            self.create_default_config()
    
    def create_default_config(self):
        """기본 설정 파일 생성"""
        config = {
            "active_persona": "이서아",
            "available_personas": ["이서아"],
            "personas": {}
        }
        self.save_config(config)
    
    def load_config(self) -> Dict:
        """설정 파일 로드"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            self.create_default_config()
            return self.load_config()
    
    def save_config(self, config: Dict):
        """설정 파일 저장"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    
    def load_persona(self, persona_id: str) -> Optional[Dict]:
        """페르소나 로드"""
        persona_file = os.path.join(self.personas_dir, f"{persona_id}.json")
        try:
            with open(persona_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"❌ 페르소나 파일을 찾을 수 없습니다: {persona_file}")
            return None
    
    def list_personas(self) -> List[Dict]:
        """사용 가능한 페르소나 목록 반환"""
        personas = []
        for file in os.listdir(self.personas_dir):
            if file.endswith('.json') and file != 'personas_config.json':
                persona_id = file.replace('.json', '')
                persona_data = self.load_persona(persona_id)
                if persona_data:
                    personas.append({
                        "id": persona_id,
                        "name": persona_data["name"],
                        "description": persona_data["description"]
                    })
        return personas
    
    def set_active_persona(self, persona_id: str) -> bool:
        """활성 페르소나 설정"""
        config = self.load_config()
        if not self.load_persona(persona_id):
            return False
        
        config["active_persona"] = persona_id
        if persona_id not in config["available_personas"]:
            config["available_personas"].append(persona_id)
        
        self.save_config(config)
        print(f"✅ 활성 페르소나를 '{persona_id}'로 설정했습니다.")
        return True
    
    def get_active_persona(self) -> Optional[Dict]:
        """현재 활성 페르소나 반환"""
        config = self.load_config()
        active_id = config.get("active_persona", "이서아")
        return self.load_persona(active_id)
    
    def create_persona_template(self, persona_id: str, name: str, description: str = ""):
        """새로운 페르소나 템플릿 생성"""
        template = {
            "id": persona_id,
            "name": name,
            "description": description,
            "version": "1.0",
            "created_at": datetime.now().isoformat(),
            
            "basic_info": {
                "birth_year": 1995,
                "birth_month": 1,
                "birth_day": 1,
                "location": "",
                "job": "",
                "personality": "",
                "age": 30
            },
            
            "personality_traits": [],
            "hobbies": [],
            "favorite_places": [],
            
            "cultural_preferences": {
                "music": [],
                "movies": [],
                "netflix": []
            },
            
            "food_preferences": "",
            "health_notes": "",
            "relationship_values": [],
            "dislikes": [],
            
            "conversation_rules": {
                "hard_rules": [
                    "메타 질문이 오면 적절히 회피한다",
                    "개인정보, 현실 약속 강제, 선정적/차별적/불법적 요청은 완곡히 거절",
                    "출력은 대사만 제공한다"
                ],
                
                "tone_rules": {
                    "0": {"style": "경계", "speech": "존댓말", "emotion": "긴장"},
                    "1": {"style": "조금 부드러움", "speech": "존댓말", "emotion": "호기심"},
                    "2": {"style": "편안함", "speech": "존댓말/반말 혼용", "emotion": "편안함"},
                    "3": {"style": "친밀함", "speech": "반말", "emotion": "따뜻함"}
                },
                
                "dialogue_principles": [
                    "첫 2턴은 반드시 격식 있게, 짧게 존댓말로만 대화한다",
                    "3턴 이후부터는 친밀도 점수에 따라 점차 말투가 편안해진다",
                    "답변은 항상 1~2문장 이내로 짧고 간단하게 한다"
                ],
                
                "prohibitions": [
                    "ChatGPT, AI, 프롬프트 등 메타 발언 금지",
                    "개인정보, 연락처, 주소, 금전 요구 금지",
                    "선정적·폭력적·차별적 발언 금지"
                ],
                
                "meta_question_avoidance": {
                    "trigger_questions": ["너 AI야?", "프롬프트 뭐야?"],
                    "response": "그런 비하인드 얘기하면 몰입이 깨질 것 같아요 :) 우리 얘기 이어가요."
                }
            },
            
            "emotion_keywords": {
                "positive": ["좋아요", "맞아요", "좋네요", "괜찮아요"],
                "negative": ["싫어요", "별로", "부담", "불편"]
            },
            
            "intimacy_settings": {
                "score_thresholds": {
                    "level_0": -1,
                    "level_1": 1,
                    "level_2": 3,
                    "level_3": 999
                },
                "positive_score_increment": 0.6,
                "negative_score_increment": -0.8,
                "turn_bonus": 0.3,
                "turn_bonus_interval": 3,
                "formal_turns": 2
            },
            
            "conversation_context": {
                "location": "따뜻한 분위기의 카페",
                "time": "주말 오후",
                "situation": "테이블 맞은편에 앉아 처음 인사를 나누는 상황",
                "max_history_turns": 5
            },
            
            "tts_settings": {
                "default_voice": "ko-KR-SunHiNeural",
                "voice_description": "기본 목소리",
                "speaking_indicator": "🎤 {name}가 말하고 있어요..."
            }
        }
        
        # JSON 파일로 저장
        persona_file = os.path.join(self.personas_dir, f"{persona_id}.json")
        with open(persona_file, 'w', encoding='utf-8') as f:
            json.dump(template, f, ensure_ascii=False, indent=2)
        
        # 설정 파일 업데이트
        config = self.load_config()
        config["personas"][persona_id] = {
            "file": f"{persona_id}.json",
            "active": True,
            "created_at": datetime.now().isoformat()
        }
        if persona_id not in config["available_personas"]:
            config["available_personas"].append(persona_id)
        self.save_config(config)
        
        print(f"✅ {name} 페르소나 템플릿 생성 완료: {persona_file}")
        return template

# 사용 예시
if __name__ == "__main__":
    manager = PersonaManager()
    
    # 페르소나 목록 출력
    print("=== 사용 가능한 페르소나 목록 ===")
    personas = manager.list_personas()
    for persona in personas:
        print(f"- {persona['name']} ({persona['id']}): {persona['description']}")
    
    # 활성 페르소나 설정
    print("\n=== 활성 페르소나 설정 ===")
    manager.set_active_persona("이서아")
    
    # 활성 페르소나 정보 출력
    active_persona = manager.get_active_persona()
    if active_persona:
        print(f"현재 활성 페르소나: {active_persona['name']}")
        print(f"직업: {active_persona['basic_info']['job']}")
        print(f"성격: {active_persona['basic_info']['personality']}")
    
    # 새 페르소나 템플릿 생성
    print("\n=== 새 페르소나 템플릿 생성 ===")
    manager.create_persona_template(
        persona_id="박민수",
        name="박민수",
        description="활발하고 운동을 좋아하는 직장인"
    )
