#!/usr/bin/env python3
"""
CreatorFlow AI Backend API Testing Suite
Tests all backend endpoints with proper authentication flow
"""

import requests
import json
import time
import uuid
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://youtube-pipeline-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class CreatorFlowAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.test_project_id = None
        self.test_email = f"testuser_{uuid.uuid4().hex[:8]}@creatorflow.ai"
        self.test_password = "TestPassword123!"
        self.test_name = "Test User"
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")
        
    def test_health_check(self):
        """Test health endpoint (no auth required)"""
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log("✅ Health check passed", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Health check failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Health check failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check exception: {str(e)}", "ERROR")
            return False
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        try:
            payload = {
                "name": self.test_name,
                "email": self.test_email,
                "password": self.test_password
            }
            
            response = self.session.post(f"{API_BASE}/register", json=payload)
            
            if response.status_code == 201:
                data = response.json()
                if data.get('success') and data.get('user'):
                    self.user_id = data['user']['id']
                    self.log(f"✅ User registration successful: {data['user']['email']}", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Registration failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Registration failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Registration exception: {str(e)}", "ERROR")
            return False
    
    def test_authentication(self):
        """Test NextAuth authentication"""
        try:
            # First, try to get CSRF token
            csrf_response = self.session.get(f"{BASE_URL}/api/auth/csrf")
            if csrf_response.status_code != 200:
                self.log(f"❌ Failed to get CSRF token: {csrf_response.status_code}", "ERROR")
                return False
                
            csrf_data = csrf_response.json()
            csrf_token = csrf_data.get('csrfToken')
            
            # Now attempt login
            login_payload = {
                "email": self.test_email,
                "password": self.test_password,
                "csrfToken": csrf_token,
                "callbackUrl": BASE_URL,
                "json": "true"
            }
            
            login_response = self.session.post(
                f"{BASE_URL}/api/auth/callback/credentials",
                data=login_payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            # Check if we got session cookies
            if 'next-auth.session-token' in self.session.cookies or 'next-auth.csrf-token' in self.session.cookies:
                self.log("✅ Authentication successful - session cookies received", "SUCCESS")
                return True
            else:
                # Try alternative approach - check if we can access protected endpoint
                test_response = self.session.get(f"{API_BASE}/dashboard/stats")
                if test_response.status_code == 200:
                    self.log("✅ Authentication successful - can access protected endpoint", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Authentication failed - cannot access protected endpoint: {test_response.status_code}", "ERROR")
                    return False
                    
        except Exception as e:
            self.log(f"❌ Authentication exception: {str(e)}", "ERROR")
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/dashboard/stats")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'stats' in data:
                    stats = data['stats']
                    required_fields = ['total', 'in_progress', 'completed', 'scheduled', 'failed']
                    if all(field in stats for field in required_fields):
                        self.log(f"✅ Dashboard stats working: {stats}", "SUCCESS")
                        return True
                    else:
                        self.log(f"❌ Dashboard stats missing fields: {data}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Dashboard stats failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Dashboard stats failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Dashboard stats exception: {str(e)}", "ERROR")
            return False
    
    def test_create_project(self):
        """Test project creation"""
        try:
            payload = {
                "concept": "How to build a successful YouTube channel using AI automation tools",
                "duration_seconds": 60,
                "aspect_ratio": "16:9",
                "language": "English",
                "content_style": "professional",
                "publishing_mode": "draft"
            }
            
            response = self.session.post(f"{API_BASE}/projects", json=payload)
            
            if response.status_code == 201:
                data = response.json()
                if data.get('success') and data.get('project'):
                    project = data['project']
                    self.test_project_id = project['_id']
                    self.log(f"✅ Project created successfully: {project['concept'][:50]}...", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Project creation failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Project creation failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Project creation exception: {str(e)}", "ERROR")
            return False
    
    def test_get_projects(self):
        """Test getting projects list"""
        try:
            response = self.session.get(f"{API_BASE}/projects")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'projects' in data:
                    projects = data['projects']
                    self.log(f"✅ Get projects successful: {len(projects)} projects found", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Get projects failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get projects failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get projects exception: {str(e)}", "ERROR")
            return False
    
    def test_get_single_project(self):
        """Test getting single project"""
        if not self.test_project_id:
            self.log("❌ No test project ID available", "ERROR")
            return False
            
        try:
            response = self.session.get(f"{API_BASE}/projects/{self.test_project_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('project'):
                    project = data['project']
                    self.log(f"✅ Get single project successful: {project['_id']}", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Get single project failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get single project failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get single project exception: {str(e)}", "ERROR")
            return False
    
    def test_pipeline_step(self, step_name, endpoint_suffix):
        """Test a pipeline step"""
        if not self.test_project_id:
            self.log(f"❌ No test project ID available for {step_name}", "ERROR")
            return False
            
        try:
            response = self.session.post(f"{API_BASE}/projects/{self.test_project_id}/{endpoint_suffix}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log(f"✅ {step_name} successful", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ {step_name} failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ {step_name} failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ {step_name} exception: {str(e)}", "ERROR")
            return False
    
    def test_integrations_get(self):
        """Test getting integrations"""
        try:
            response = self.session.get(f"{API_BASE}/integrations")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'integrations' in data:
                    integrations = data['integrations']
                    self.log(f"✅ Get integrations successful: {len(integrations)} integrations", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Get integrations failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get integrations failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get integrations exception: {str(e)}", "ERROR")
            return False
    
    def test_save_integration(self):
        """Test saving an integration"""
        try:
            payload = {
                "provider": "openai",
                "config_json": {
                    "api_key": "sk-test-key-for-testing-purposes-only"
                }
            }
            
            response = self.session.post(f"{API_BASE}/integrations", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('integration'):
                    self.log("✅ Save integration successful", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Save integration failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Save integration failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Save integration exception: {str(e)}", "ERROR")
            return False
    
    def test_integration_test(self):
        """Test integration testing endpoint"""
        try:
            payload = {"provider": "openai"}
            
            response = self.session.post(f"{API_BASE}/integrations/test", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log(f"✅ Integration test successful: {data.get('message', 'No message')}", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Integration test failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Integration test failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Integration test exception: {str(e)}", "ERROR")
            return False
    
    def test_delete_integration(self):
        """Test deleting an integration"""
        try:
            response = self.session.delete(f"{API_BASE}/integrations/openai")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log("✅ Delete integration successful", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Delete integration failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Delete integration failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Delete integration exception: {str(e)}", "ERROR")
            return False
    
    def test_delete_project(self):
        """Test deleting a project"""
        if not self.test_project_id:
            self.log("❌ No test project ID available for deletion", "ERROR")
            return False
            
        try:
            response = self.session.delete(f"{API_BASE}/projects/{self.test_project_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log("✅ Delete project successful", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Delete project failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Delete project failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Delete project exception: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        self.log("🚀 Starting CreatorFlow AI Backend API Tests", "INFO")
        self.log(f"Base URL: {BASE_URL}", "INFO")
        self.log(f"Test Email: {self.test_email}", "INFO")
        
        results = {}
        
        # Test 1: Health Check (no auth required)
        self.log("\n=== Testing Health Check ===", "INFO")
        results['health_check'] = self.test_health_check()
        
        # Test 2: User Registration
        self.log("\n=== Testing User Registration ===", "INFO")
        results['user_registration'] = self.test_user_registration()
        
        # Test 3: Authentication
        self.log("\n=== Testing Authentication ===", "INFO")
        results['authentication'] = self.test_authentication()
        
        # Only continue with authenticated tests if auth worked
        if not results['authentication']:
            self.log("❌ Authentication failed - skipping authenticated tests", "ERROR")
            return results
        
        # Test 4: Dashboard Stats
        self.log("\n=== Testing Dashboard Stats ===", "INFO")
        results['dashboard_stats'] = self.test_dashboard_stats()
        
        # Test 5: Create Project
        self.log("\n=== Testing Create Project ===", "INFO")
        results['create_project'] = self.test_create_project()
        
        # Test 6: Get Projects
        self.log("\n=== Testing Get Projects ===", "INFO")
        results['get_projects'] = self.test_get_projects()
        
        # Test 7: Get Single Project
        self.log("\n=== Testing Get Single Project ===", "INFO")
        results['get_single_project'] = self.test_get_single_project()
        
        # Test 8-14: Pipeline Steps
        pipeline_steps = [
            ("Evaluate Idea", "evaluate"),
            ("Generate Script", "generate-script"),
            ("Generate Scenes", "generate-scenes"),
            ("Generate Video", "generate-video"),
            ("Generate Metadata", "generate-metadata"),
            ("Publish YouTube", "publish-youtube"),
            ("Run Pipeline", "run-pipeline")
        ]
        
        for step_name, endpoint in pipeline_steps:
            self.log(f"\n=== Testing {step_name} ===", "INFO")
            results[f'pipeline_{endpoint.replace("-", "_")}'] = self.test_pipeline_step(step_name, endpoint)
        
        # Test 15: Get Integrations
        self.log("\n=== Testing Get Integrations ===", "INFO")
        results['get_integrations'] = self.test_integrations_get()
        
        # Test 16: Save Integration
        self.log("\n=== Testing Save Integration ===", "INFO")
        results['save_integration'] = self.test_save_integration()
        
        # Test 17: Test Integration
        self.log("\n=== Testing Integration Test ===", "INFO")
        results['test_integration'] = self.test_integration_test()
        
        # Test 18: Delete Integration
        self.log("\n=== Testing Delete Integration ===", "INFO")
        results['delete_integration'] = self.test_delete_integration()
        
        # Test 19: Delete Project
        self.log("\n=== Testing Delete Project ===", "INFO")
        results['delete_project'] = self.test_delete_project()
        
        # Summary
        self.log("\n" + "="*60, "INFO")
        self.log("🏁 TEST SUMMARY", "INFO")
        self.log("="*60, "INFO")
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}", "INFO")
        
        self.log(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)", "INFO")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
        else:
            self.log(f"⚠️  {total - passed} tests failed", "ERROR")
        
        return results

if __name__ == "__main__":
    tester = CreatorFlowAPITester()
    results = tester.run_all_tests()