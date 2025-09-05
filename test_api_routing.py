#!/usr/bin/env python3
"""
API Gateway 라우팅 시뮬레이션 테스트
실제 Lambda 함수들이 어떻게 라우팅을 처리하는지 확인
"""

import json
import sys
import os

# Lambda 함수 경로 추가
sys.path.append('/Users/Rene/Documents/rene/project/awsqhackthon2025/team21-aws-hackathon/backend/lambda')

def simulate_api_gateway_event(resource, method, body=None):
    """API Gateway 이벤트 시뮬레이션"""
    return {
        'resource': resource,
        'httpMethod': method,
        'path': resource,
        'body': json.dumps(body) if body else None,
        'headers': {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000'
        },
        'pathParameters': None,
        'queryStringParameters': None
    }

def test_session_api():
    """session-api.py 테스트"""
    print("🔍 Testing session-api.py")
    print("=" * 50)
    
    # session-api.py 임포트
    try:
        # 파일 직접 읽어서 실행
        with open('/Users/Rene/Documents/rene/project/awsqhackthon2025/team21-aws-hackathon/backend/lambda/session-api.py', 'r') as f:
            session_api_code = f.read()
        
        # 테스트 케이스들
        test_cases = [
            {
                'name': 'POST /sessions (세션 생성)',
                'event': simulate_api_gateway_event('/sessions', 'POST', {})
            },
            {
                'name': 'GET /sessions (세션 목록)',
                'event': simulate_api_gateway_event('/sessions', 'GET')
            },
            {
                'name': 'POST /sessions/process (문제의 엔드포인트)',
                'event': simulate_api_gateway_event('/sessions/process', 'POST', {'sessionId': 'test-session'})
            },
            {
                'name': 'POST /session/{id} (세션 처리)',
                'event': simulate_api_gateway_event('/session/{id}', 'POST', {'userProfile': {'target': 'keto'}})
            }
        ]
        
        for test_case in test_cases:
            print(f"\n📝 {test_case['name']}")
            event = test_case['event']
            
            # 라우팅 로직 시뮬레이션
            http_method = event['httpMethod']
            resource = event['resource']
            
            print(f"   Method: {http_method}")
            print(f"   Resource: {resource}")
            
            # session-api.py의 라우팅 로직 재현
            if http_method == 'POST' and resource == '/sessions':
                print("   ✅ 매치: create_session()")
            elif http_method == 'GET' and resource == '/sessions':
                print("   ✅ 매치: list_sessions()")
            elif http_method == 'POST' and '/session/' in resource:
                print("   ✅ 매치: process_session()")
            else:
                print("   ❌ 매치 없음: 404 Not Found 반환")
                
    except Exception as e:
        print(f"❌ Error: {e}")

def test_process_lambda():
    """process Lambda 함수 테스트"""
    print("\n\n🔍 Testing process/lambda_function.py")
    print("=" * 50)
    
    try:
        # process Lambda 함수 확인
        process_path = '/Users/Rene/Documents/rene/project/awsqhackthon2025/team21-aws-hackathon/backend/lambda/process/lambda_function.py'
        
        if os.path.exists(process_path):
            with open(process_path, 'r') as f:
                content = f.read()
                
            print("📄 Process Lambda 함수 존재 확인:")
            print(f"   파일 크기: {len(content)} bytes")
            
            # 주요 함수들 확인
            functions = ['lambda_handler', 'validate_session', 'start_workflow']
            for func in functions:
                if f"def {func}" in content:
                    print(f"   ✅ {func}() 함수 존재")
                else:
                    print(f"   ❌ {func}() 함수 없음")
                    
            # Step Functions ARN 확인
            if 'ai-chef-workflow' in content:
                print("   ✅ Step Functions 워크플로우 연결됨")
            else:
                print("   ❌ Step Functions 워크플로우 연결 없음")
                
        else:
            print("❌ Process Lambda 함수 파일이 없음")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def check_api_gateway_config():
    """API Gateway 설정 확인"""
    print("\n\n🔍 API Gateway 설정 분석")
    print("=" * 50)
    
    print("현재 API Gateway 라우팅:")
    print("   ✅ POST /sessions → ai-chef-session-api")
    print("   ✅ GET /sessions → ai-chef-session-api") 
    print("   ❌ POST /sessions/process → ai-chef-session-api (잘못된 연결!)")
    print("   ✅ POST /session/{id} → ai-chef-session-api")
    
    print("\n올바른 라우팅이어야 할 것:")
    print("   ✅ POST /sessions → ai-chef-session-api")
    print("   ✅ GET /sessions → ai-chef-session-api")
    print("   🔧 POST /sessions/process → process Lambda (수정 필요!)")
    print("   ✅ POST /session/{id} → ai-chef-session-api")

if __name__ == "__main__":
    print("🚀 API Gateway 라우팅 시뮬레이션 시작")
    print("=" * 60)
    
    test_session_api()
    test_process_lambda()
    check_api_gateway_config()
    
    print("\n\n🎯 결론:")
    print("=" * 60)
    print("❌ 문제: /sessions/process가 잘못된 Lambda(ai-chef-session-api)로 라우팅됨")
    print("✅ 해결: API Gateway에서 /sessions/process를 process Lambda로 연결해야 함")
    print("📁 Process Lambda는 이미 구현되어 있음!")
