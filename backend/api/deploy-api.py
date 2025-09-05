#!/usr/bin/env python3
"""
API Gateway 생성 및 Lambda 통합 배포 스크립트
"""

import boto3
import json
import yaml
import os
from typing import Dict, Any

class APIGatewayDeployer:
    def __init__(self, region='us-east-1'):
        self.apigateway = boto3.client('apigateway', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.region = region
        self.account_id = boto3.client('sts').get_caller_identity()['Account']
    
    def create_api_gateway(self, api_name: str, description: str) -> str:
        """REST API Gateway 생성"""
        try:
            response = self.apigateway.create_rest_api(
                name=api_name,
                description=description,
                endpointConfiguration={
                    'types': ['REGIONAL']
                }
            )
            
            api_id = response['id']
            print(f"✅ API Gateway created: {api_id}")
            return api_id
            
        except Exception as e:
            print(f"❌ Error creating API Gateway: {str(e)}")
            raise
    
    def get_root_resource_id(self, api_id: str) -> str:
        """루트 리소스 ID 가져오기"""
        response = self.apigateway.get_resources(restApiId=api_id)
        
        for resource in response['items']:
            if resource['path'] == '/':
                return resource['id']
        
        raise Exception("Root resource not found")
    
    def create_resource(self, api_id: str, parent_id: str, path_part: str) -> str:
        """리소스 생성"""
        try:
            response = self.apigateway.create_resource(
                restApiId=api_id,
                parentId=parent_id,
                pathPart=path_part
            )
            
            resource_id = response['id']
            print(f"✅ Resource created: /{path_part} ({resource_id})")
            return resource_id
            
        except Exception as e:
            print(f"❌ Error creating resource: {str(e)}")
            raise
    
    def create_method(self, api_id: str, resource_id: str, http_method: str, 
                     lambda_function_name: str = None) -> None:
        """메서드 생성 및 Lambda 통합"""
        try:
            if lambda_function_name:
                # Lambda 프록시 통합
                integration_uri = f"arn:aws:apigateway:{self.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:{self.region}:{self.account_id}:function:{lambda_function_name}/invocations"
                
                # 메서드 생성
                self.apigateway.put_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    authorizationType='NONE'
                )
                
                # Lambda 통합 설정
                self.apigateway.put_integration(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    type='AWS_PROXY',
                    integrationHttpMethod='POST',
                    uri=integration_uri
                )
                
                # Lambda 권한 추가
                self._add_lambda_permission(lambda_function_name, api_id)
                
            else:
                # CORS OPTIONS 메서드
                self.apigateway.put_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    authorizationType='NONE'
                )
                
                # Mock 통합 (CORS용)
                self.apigateway.put_integration(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    type='MOCK',
                    requestTemplates={
                        'application/json': '{"statusCode": 200}'
                    }
                )
                
                # 응답 설정
                self.apigateway.put_method_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Headers': False,
                        'method.response.header.Access-Control-Allow-Methods': False,
                        'method.response.header.Access-Control-Allow-Origin': False
                    }
                )
                
                self.apigateway.put_integration_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'"
                    }
                )
            
            print(f"✅ Method created: {http_method}")
            
        except Exception as e:
            print(f"❌ Error creating method: {str(e)}")
            raise
    
    def _add_lambda_permission(self, function_name: str, api_id: str) -> None:
        """Lambda 함수에 API Gateway 호출 권한 추가"""
        try:
            source_arn = f"arn:aws:execute-api:{self.region}:{self.account_id}:{api_id}/*/*"
            
            self.lambda_client.add_permission(
                FunctionName=function_name,
                StatementId=f"apigateway-{api_id}",
                Action='lambda:InvokeFunction',
                Principal='apigateway.amazonaws.com',
                SourceArn=source_arn
            )
            
            print(f"✅ Lambda permission added for {function_name}")
            
        except self.lambda_client.exceptions.ResourceConflictException:
            print(f"⚠️  Lambda permission already exists for {function_name}")
        except Exception as e:
            print(f"❌ Error adding Lambda permission: {str(e)}")
    
    def deploy_api(self, api_id: str, stage_name: str = 'prod') -> str:
        """API 배포"""
        try:
            response = self.apigateway.create_deployment(
                restApiId=api_id,
                stageName=stage_name,
                description=f'Deployment to {stage_name} stage'
            )
            
            api_url = f"https://{api_id}.execute-api.{self.region}.amazonaws.com/{stage_name}"
            print(f"✅ API deployed: {api_url}")
            return api_url
            
        except Exception as e:
            print(f"❌ Error deploying API: {str(e)}")
            raise
    
    def setup_complete_api(self, lambda_function_name: str) -> str:
        """전체 API 설정"""
        try:
            # 1. API Gateway 생성
            api_id = self.create_api_gateway(
                api_name="recipe-nutrition-api",
                description="레시피 재료 영양소 정보 API"
            )
            
            # 2. 루트 리소스 ID 가져오기
            root_resource_id = self.get_root_resource_id(api_id)
            
            # 3. /recipe 리소스 생성
            recipe_resource_id = self.create_resource(api_id, root_resource_id, 'recipe')
            
            # 4. /recipe/nutrition 리소스 생성
            nutrition_resource_id = self.create_resource(api_id, recipe_resource_id, 'nutrition')
            
            # 5. POST 메서드 생성 (Lambda 통합)
            self.create_method(api_id, nutrition_resource_id, 'POST', lambda_function_name)
            
            # 6. OPTIONS 메서드 생성 (CORS)
            self.create_method(api_id, nutrition_resource_id, 'OPTIONS')
            
            # 7. /health 리소스 생성 (헬스 체크)
            health_resource_id = self.create_resource(api_id, root_resource_id, 'health')
            self.create_method(api_id, health_resource_id, 'GET')
            
            # 8. API 배포
            api_url = self.deploy_api(api_id)
            
            return api_url
            
        except Exception as e:
            print(f"❌ Error setting up API: {str(e)}")
            raise

def main():
    """메인 실행 함수"""
    
    # 환경변수에서 Lambda 함수명 가져오기
    lambda_function_name = os.environ.get('LAMBDA_FUNCTION_NAME', 'recipe-nutrition-lookup')
    
    try:
        deployer = APIGatewayDeployer()
        api_url = deployer.setup_complete_api(lambda_function_name)
        
        print("\n🎉 API Gateway 배포 완료!")
        print(f"API URL: {api_url}")
        print(f"영양소 조회 엔드포인트: {api_url}/recipe/nutrition")
        print(f"헬스 체크 엔드포인트: {api_url}/health")
        
        # 테스트 curl 명령어 출력
        print("\n📝 테스트 명령어:")
        print(f"""curl -X POST {api_url}/recipe/nutrition \\
  -H "Content-Type: application/json" \\
  -d '{{"ingredients": ["닭가슴살 200g", "브로콜리 100g"]}}'""")
        
        return True
        
    except Exception as e:
        print(f"❌ 배포 실패: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
