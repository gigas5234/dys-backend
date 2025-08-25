#!/usr/bin/env python3
"""
서버 시작 스크립트
- MongoDB 자동 시작
- 서버 실행
- 프로세스 관리
"""

import os
import sys
import time
import signal
import subprocess
import psutil
from pathlib import Path

# MongoDB 설정
MONGODB_PATH = "/usr/bin/mongod"
MONGODB_LOG_PATH = "/var/log/mongodb.log"
MONGODB_DATA_PATH = "/var/lib/mongodb"
MONGODB_PORT = 27017

# 서버 설정
SERVER_SCRIPT = "server.py"
SERVER_PORT = 8000

class ServerManager:
    def __init__(self):
        self.mongodb_process = None
        self.server_process = None
        
    def start_mongodb(self):
        """MongoDB 시작"""
        print("🔄 MongoDB 시작 중...")
        
        # MongoDB 데이터 디렉토리 생성
        os.makedirs(MONGODB_DATA_PATH, exist_ok=True)
        
        # MongoDB 프로세스 시작
        try:
            self.mongodb_process = subprocess.Popen([
                MONGODB_PATH,
                "--fork",
                "--logpath", MONGODB_LOG_PATH,
                "--dbpath", MONGODB_DATA_PATH,
                "--port", str(MONGODB_PORT)
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # MongoDB 시작 대기
            time.sleep(5)
            
            # MongoDB 연결 확인
            if self.check_mongodb_connection():
                print("✅ MongoDB 시작 완료")
                return True
            else:
                print("❌ MongoDB 시작 실패")
                return False
                
        except Exception as e:
            print(f"❌ MongoDB 시작 오류: {e}")
            return False
    
    def check_mongodb_connection(self):
        """MongoDB 연결 확인"""
        try:
            import motor.motor_asyncio
            client = motor.motor_asyncio.AsyncIOMotorClient(f"mongodb://localhost:{MONGODB_PORT}")
            
            # 연결 테스트
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(client.admin.command('ping'))
            loop.close()
            
            return result.get('ok') == 1
        except Exception as e:
            print(f"⚠️ MongoDB 연결 확인 실패: {e}")
            return False
    
    def start_server(self):
        """서버 시작"""
        print("🔄 서버 시작 중...")
        
        try:
            self.server_process = subprocess.Popen([
                sys.executable, SERVER_SCRIPT
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # 서버 시작 대기
            time.sleep(3)
            
            if self.server_process.poll() is None:
                print("✅ 서버 시작 완료")
                return True
            else:
                print("❌ 서버 시작 실패")
                return False
                
        except Exception as e:
            print(f"❌ 서버 시작 오류: {e}")
            return False
    
    def stop_mongodb(self):
        """MongoDB 중지"""
        if self.mongodb_process:
            print("🔄 MongoDB 중지 중...")
            self.mongodb_process.terminate()
            self.mongodb_process.wait()
            print("✅ MongoDB 중지 완료")
    
    def stop_server(self):
        """서버 중지"""
        if self.server_process:
            print("🔄 서버 중지 중...")
            self.server_process.terminate()
            self.server_process.wait()
            print("✅ 서버 중지 완료")
    
    def cleanup(self):
        """정리 작업"""
        self.stop_server()
        self.stop_mongodb()
    
    def signal_handler(self, signum, frame):
        """시그널 핸들러"""
        print(f"\n🛑 시그널 {signum} 수신, 정리 중...")
        self.cleanup()
        sys.exit(0)
    
    def run(self):
        """메인 실행 함수"""
        print("🚀 서버 매니저 시작")
        
        # 시그널 핸들러 등록
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        try:
            # MongoDB 시작
            if not self.start_mongodb():
                print("❌ MongoDB 시작 실패로 서버를 시작할 수 없습니다.")
                return False
            
            # 서버 시작
            if not self.start_server():
                print("❌ 서버 시작 실패")
                self.stop_mongodb()
                return False
            
            print("🎉 모든 서비스가 정상적으로 시작되었습니다!")
            print(f"📊 MongoDB: localhost:{MONGODB_PORT}")
            print(f"🌐 서버: http://localhost:{SERVER_PORT}")
            print("⏹️  종료하려면 Ctrl+C를 누르세요.")
            
            # 프로세스 모니터링
            while True:
                time.sleep(5)
                
                # MongoDB 상태 확인
                if self.mongodb_process and self.mongodb_process.poll() is not None:
                    print("❌ MongoDB가 예기치 않게 종료되었습니다.")
                    break
                
                # 서버 상태 확인
                if self.server_process and self.server_process.poll() is not None:
                    print("❌ 서버가 예기치 않게 종료되었습니다.")
                    break
                    
        except KeyboardInterrupt:
            print("\n🛑 사용자에 의해 중단되었습니다.")
        except Exception as e:
            print(f"❌ 예기치 않은 오류: {e}")
        finally:
            self.cleanup()
            print("👋 서버 매니저 종료")

if __name__ == "__main__":
    manager = ServerManager()
    manager.run()


















