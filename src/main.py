import os
import requests

def download_model_if_not_exists():
    model_path = "src/dys_studio/models/data/model.pth"
    model_url = "https://storage.googleapis.com/dys-model-storage/model.pth"

    if not os.path.exists(model_path):
        print(f"'{model_path}'를 찾을 수 없습니다. GCS에서 모델을 다운로드합니다...")
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        try:
            response = requests.get(model_url, stream=True)
            response.raise_for_status()  # 오류 발생 시 예외 처리
            
            with open(model_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("✅ 모델 다운로드 완료.")
        except Exception as e:
            print(f"❌ 모델 다운로드 실패: {e}")
            print("⚠️ 서버는 계속 실행되지만 일부 기능이 제한될 수 있습니다.")
    else:
        print("✅ 모델이 이미 존재합니다.")

# FastAPI 앱을 초기화하기 전에 모델 다운로드 함수를 호출
download_model_if_not_exists()

from dotenv import load_dotenv
import os

# .env 파일 로드
load_dotenv()

from server import app  # server.py 안의 app 객체 가져오기

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)