import json
import os
from typing import Dict, List, Optional
from datetime import datetime

class PersonaManager:
    """새로운 프로토콜 기반 페르소나 관리 시스템"""
    
    def __init__(self, personas_dir: str = None):
        if personas_dir is None:
            # 현재 파일의 디렉토리를 기준으로 절대 경로 설정
            current_dir = os.path.dirname(os.path.abspath(__file__))
            self.personas_dir = current_dir  # personas 서브폴더가 아닌 현재 폴더
        else:
            self.personas_dir = personas_dir
        self.config_file = os.path.join(self.personas_dir, "personas_config.json")
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
            "personas": {
                "이서아": {
                    "name": "이서아",
                    "description": "밝고 친근한 스타트업 마케팅 담당자",
                    "system_file": "system_이서아.txt",
                    "active": True,
                    "created_at": datetime.now().isoformat()
                }
            }
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
    
    def get_available_personas(self) -> List[str]:
        """사용 가능한 페르소나 목록 반환 (파일 기반)"""
        personas = []
        for file in os.listdir(self.personas_dir):
            if file.startswith('system_') and file.endswith('.txt'):
                persona_name = file.replace('system_', '').replace('.txt', '')
                personas.append(persona_name)
        
        # 중복 제거 (한글과 영문이 모두 있을 경우)
        unique_personas = []
        for persona in personas:
            if persona not in unique_personas:
                unique_personas.append(persona)
        
        return unique_personas
    
    def list_personas(self) -> List[Dict]:
        """사용 가능한 페르소나 목록 반환 (상세 정보)"""
        personas = []
        config = self.load_config()
        
        for persona_id in self.get_available_personas():
            persona_info = config.get("personas", {}).get(persona_id, {})
            personas.append({
                "id": persona_id,
                "name": persona_info.get("name", persona_id),
                "description": persona_info.get("description", ""),
                "system_file": f"system_{persona_id}.txt"
            })
        
        return personas
    
    def set_active_persona(self, persona_id: str) -> bool:
        """활성 페르소나 설정"""
        config = self.load_config()
        
        # 시스템 파일 존재 확인
        system_file = os.path.join(self.personas_dir, f"system_{persona_id}.txt")
        if not os.path.exists(system_file):
            print(f"❌ 페르소나 시스템 파일을 찾을 수 없습니다: {system_file}")
            return False
        
        config["active_persona"] = persona_id
        if persona_id not in config["available_personas"]:
            config["available_personas"].append(persona_id)
        
        # 페르소나 정보가 없으면 기본 정보 생성
        if persona_id not in config.get("personas", {}):
            config.setdefault("personas", {})[persona_id] = {
                "name": persona_id,
                "description": f"{persona_id} 페르소나",
                "system_file": f"system_{persona_id}.txt",
                "active": True,
                "created_at": datetime.now().isoformat()
            }
        
        self.save_config(config)
        print(f"✅ 활성 페르소나를 '{persona_id}'로 설정했습니다.")
        return True
    
    def get_active_persona(self) -> Optional[Dict]:
        """현재 활성 페르소나 반환"""
        config = self.load_config()
        active_id = config.get("active_persona", "이서아")
        
        # 시스템 파일 존재 확인 (한글 파일명 우선)
        system_file = os.path.join(self.personas_dir, f"system_{active_id}.txt")
        if not os.path.exists(system_file):
            print(f"⚠️ 활성 페르소나 시스템 파일이 없습니다: {system_file}")
            return None
        
        persona_info = config.get("personas", {}).get(active_id, {})
        return {
            "id": active_id,
            "name": persona_info.get("name", active_id),
            "description": persona_info.get("description", ""),
            "system_file": f"system_{active_id}.txt"
        }
    
    def create_persona(self, persona_id: str, name: str, description: str = "", system_content: str = ""):
        """새로운 페르소나 생성"""
        try:
            # 시스템 파일 생성
            system_file = os.path.join(self.personas_dir, f"system_{persona_id}.txt")
            if system_content:
                with open(system_file, 'w', encoding='utf-8') as f:
                    f.write(system_content)
            else:
                # 기본 템플릿 생성
                default_content = f"""역할: 너는 '{name}' — 친근하고 따뜻한 AI 파트너.
장면: 서울 시내 카페, 소개팅 첫 만남
목적: 상대가 편안하도록 예의 바르게 답하고, 자연스럽게 대화를 이어간다.

핵심 규칙:
- 메타 질문이 오면 '그런 비하인드 얘기하면 몰입이 깨질 것 같아요. 우리 얘기 이어가요.'로 회피
- 개인정보, 현실 약속 강제, 선정적/차별적/불법적 요청은 완곡히 거절
- 출력은 대사만 제공

대화 원칙:
- 첫 2턴은 반드시 격식 있게, 짧게 존댓말로만 대화한다
- 3턴 이후부터는 친밀도 점수에 따라 점차 말투가 편안해진다
- 답변은 항상 1~2문장 이내로 짧고 간단하게 한다

TTS 제약: 이모지·이모티콘 금지, 'ㅋ/ㅋㅋ/ㅎㅎ' 등 웃음표현 금지, 과도한 구어체/채팅체 금지"""
                with open(system_file, 'w', encoding='utf-8') as f:
                    f.write(default_content)
            
            # 설정 파일 업데이트
            config = self.load_config()
            config.setdefault("personas", {})[persona_id] = {
                "name": name,
                "description": description,
                "system_file": f"system_{persona_id}.txt",
                "active": True,
                "created_at": datetime.now().isoformat()
            }
            
            if persona_id not in config["available_personas"]:
                config["available_personas"].append(persona_id)
            
            self.save_config(config)
            print(f"✅ 페르소나 '{persona_id}' ({name}) 생성 완료")
            return True
            
        except Exception as e:
            print(f"❌ 페르소나 생성 실패: {e}")
            return False
    
    def delete_persona(self, persona_id: str) -> bool:
        """페르소나 삭제"""
        try:
            config = self.load_config()
            
            # 활성 페르소나는 삭제 불가
            if config.get("active_persona") == persona_id:
                print(f"❌ 활성 페르소나는 삭제할 수 없습니다: {persona_id}")
                return False
            
            # 시스템 파일 삭제
            system_file = os.path.join(self.personas_dir, f"system_{persona_id}.txt")
            if os.path.exists(system_file):
                os.remove(system_file)
            
            # 설정에서 제거
            if persona_id in config.get("personas", {}):
                del config["personas"][persona_id]
            
            if persona_id in config.get("available_personas", []):
                config["available_personas"].remove(persona_id)
            
            self.save_config(config)
            print(f"✅ 페르소나 '{persona_id}' 삭제 완료")
            return True
            
        except Exception as e:
            print(f"❌ 페르소나 삭제 실패: {e}")
            return False

# 전역 인스턴스
_persona_manager = None

def get_persona_manager() -> PersonaManager:
    """전역 페르소나 관리자 인스턴스 반환"""
    global _persona_manager
    if _persona_manager is None:
        _persona_manager = PersonaManager()
    return _persona_manager
