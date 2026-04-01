#!/usr/bin/env python3
"""
Backend API Testing for CreatorFlow AI - Thumbnail → Metadata Pipeline Transition
Focused test for pipeline state transitions and thumbnail selection logic
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://youtube-pipeline-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testuser@creatorflow.ai"
TEST_PASSWORD = "TestPassword123!"

class PipelineTransitionTest:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.project_id = None
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def register_and_authenticate(self):
        """Register and authenticate user"""
        try:
            # Register user (will return 409 if exists)
            self.session.post(f"{API_BASE}/register", json={
                "name": "Test User",
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            # Get CSRF token
            csrf_response = self.session.get(f"{BASE_URL}/api/auth/csrf")
            csrf_token = csrf_response.json().get('csrfToken')
            
            # Authenticate
            auth_data = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "csrfToken": csrf_token,
                "redirect": "false",
                "json": "true"
            }
            
            auth_response = self.session.post(
                f"{BASE_URL}/api/auth/callback/credentials",
                data=auth_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            if auth_response.status_code == 200:
                cookies = self.session.cookies.get_dict()
                session_cookies = [k for k in cookies.keys() if 'next-auth' in k.lower()]
                if session_cookies:
                    self.log("✅ Authentication successful")
                    return True
            
            self.log("❌ Authentication failed")
            return False
            
        except Exception as e:
            self.log(f"❌ Auth error: {e}")
            return False
    
    def create_project(self):
        """Create test project"""
        try:
            response = self.session.post(f"{API_BASE}/projects", json={
                "concept": "How to Build a Successful YouTube Channel in 2024",
                "duration_seconds": 60,
                "aspect_ratio": "16:9",
                "language": "English",
                "content_style": "professional",
                "publishing_mode": "draft"
            })
            
            if response.status_code == 201:
                data = response.json()
                self.project_id = data['project']['_id']
                self.log(f"✅ Project created: {self.project_id}")
                return True
            else:
                self.log(f"❌ Project creation failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"❌ Project creation error: {e}")
            return False
    
    def test_dependency_validation(self):
        """Test 1: Verify dependency validation is working"""
        try:
            self.log("🔒 TEST 1: Pipeline Dependency Validation")
            
            # Try to generate thumbnail without prerequisites
            response = self.session.post(f"{API_BASE}/projects/{self.project_id}/generate-thumbnail")
            
            if response.status_code == 400:
                error_data = response.json()
                if error_data.get('error_code') == 'DEPENDENCY_ERROR':
                    self.log("✅ Dependency validation working - thumbnail blocked without prerequisites")
                    return True
                else:
                    self.log(f"❌ Wrong error code: {error_data.get('error_code')}")
                    return False
            else:
                self.log(f"❌ Expected 400 error, got: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Dependency test error: {e}")
            return False
    
    def test_thumbnail_selection_validation(self):
        """Test 2: Thumbnail Selection Validation Logic"""
        try:
            self.log("🎯 TEST 2: Thumbnail Selection Validation")
            
            # Test empty URL
            response = self.session.post(f"{API_BASE}/projects/{self.project_id}/select-thumbnail", json={
                "selected_thumbnail_url": ""
            })
            
            if response.status_code != 400:
                self.log(f"❌ Empty URL should be rejected, got: {response.status_code}")
                return False
            
            # Test invalid URL
            response = self.session.post(f"{API_BASE}/projects/{self.project_id}/select-thumbnail", json={
                "selected_thumbnail_url": "https://invalid-url.com/fake.jpg"
            })
            
            if response.status_code != 400:
                self.log(f"❌ Invalid URL should be rejected, got: {response.status_code}")
                return False
            
            self.log("✅ Thumbnail selection validation working correctly")
            return True
            
        except Exception as e:
            self.log(f"❌ Validation test error: {e}")
            return False
    
    def test_metadata_dependency_check(self):
        """Test 3: Metadata step dependency validation"""
        try:
            self.log("🔓 TEST 3: Metadata Dependency Validation")
            
            # Try to generate metadata without thumbnail completion
            response = self.session.post(f"{API_BASE}/projects/{self.project_id}/generate-metadata")
            
            if response.status_code == 400:
                error_data = response.json()
                if error_data.get('error_code') == 'DEPENDENCY_ERROR':
                    self.log("✅ Metadata correctly blocked without thumbnail completion")
                    return True
                else:
                    self.log(f"❌ Wrong error code: {error_data.get('error_code')}")
                    return False
            else:
                self.log(f"❌ Expected 400 error, got: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Metadata dependency test error: {e}")
            return False
    
    def test_pipeline_state_structure(self):
        """Test 4: Pipeline State Structure"""
        try:
            self.log("📊 TEST 4: Pipeline State Structure")
            
            response = self.session.get(f"{API_BASE}/projects/{self.project_id}")
            
            if response.status_code == 200:
                data = response.json()
                project = data.get('project')
                pipeline_state = project.get('pipeline_state', {})
                progress = data.get('progress', {})
                current_step = data.get('current_step', {})
                
                # Verify pipeline state has all required steps
                required_steps = ['evaluate', 'script', 'scenes', 'video', 'thumbnail', 'metadata', 'upload', 'schedule']
                
                for step in required_steps:
                    if step not in pipeline_state:
                        self.log(f"❌ Missing pipeline step: {step}")
                        return False
                    
                    step_state = pipeline_state[step]
                    if 'status' not in step_state:
                        self.log(f"❌ Missing status for step: {step}")
                        return False
                
                # Verify progress structure
                if 'completed' not in progress or 'total' not in progress or 'percentage' not in progress:
                    self.log("❌ Invalid progress structure")
                    return False
                
                # Verify current step structure
                if 'key' not in current_step or 'name' not in current_step:
                    self.log("❌ Invalid current step structure")
                    return False
                
                self.log("✅ Pipeline state structure is correct")
                self.log(f"   Progress: {progress['completed']}/{progress['total']} ({progress['percentage']}%)")
                self.log(f"   Current step: {current_step['name']}")
                return True
            else:
                self.log(f"❌ Failed to get project: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Pipeline state test error: {e}")
            return False
    
    def test_force_regenerate_logic(self):
        """Test 5: Force Regenerate Bypass Logic"""
        try:
            self.log("🔄 TEST 5: Force Regenerate Logic")
            
            # Test that force regenerate can bypass dependencies
            response = self.session.post(f"{API_BASE}/projects/{self.project_id}/generate-thumbnail", json={
                "regenerate": True
            })
            
            # This should either succeed (if OpenAI is configured) or fail with OpenAI error (not dependency error)
            if response.status_code == 200:
                self.log("✅ Force regenerate bypassed dependencies successfully")
                return True
            elif response.status_code == 500:
                error_text = response.text
                if "OpenAI not connected" in error_text:
                    self.log("✅ Force regenerate bypassed dependencies (failed at OpenAI integration as expected)")
                    return True
                else:
                    self.log(f"❌ Unexpected 500 error: {error_text}")
                    return False
            elif response.status_code == 400:
                error_data = response.json()
                if error_data.get('error_code') == 'DEPENDENCY_ERROR':
                    self.log("❌ Force regenerate did not bypass dependencies")
                    return False
                else:
                    self.log(f"❌ Unexpected 400 error: {error_data}")
                    return False
            else:
                self.log(f"❌ Unexpected response: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Force regenerate test error: {e}")
            return False
    
    def test_api_endpoints_exist(self):
        """Test 6: Verify all required API endpoints exist"""
        try:
            self.log("🔗 TEST 6: API Endpoints Existence")
            
            endpoints_to_test = [
                ("POST", f"/projects/{self.project_id}/generate-thumbnail"),
                ("POST", f"/projects/{self.project_id}/select-thumbnail"),
                ("POST", f"/projects/{self.project_id}/generate-metadata"),
                ("GET", f"/projects/{self.project_id}")
            ]
            
            all_exist = True
            
            for method, endpoint in endpoints_to_test:
                if method == "POST":
                    response = self.session.post(f"{API_BASE}{endpoint}", json={})
                else:
                    response = self.session.get(f"{API_BASE}{endpoint}")
                
                # We expect 400 (bad request) or 500 (server error), not 404 (not found)
                if response.status_code == 404:
                    self.log(f"❌ Endpoint not found: {method} {endpoint}")
                    all_exist = False
                else:
                    self.log(f"✅ Endpoint exists: {method} {endpoint}")
            
            return all_exist
            
        except Exception as e:
            self.log(f"❌ Endpoints test error: {e}")
            return False
    
    def run_pipeline_logic_tests(self):
        """Run focused pipeline logic tests"""
        self.log("🚀 Starting Pipeline Logic Tests")
        self.log("=" * 60)
        
        test_results = []
        
        # Setup
        if not self.register_and_authenticate():
            return False
        if not self.create_project():
            return False
        
        # Core logic tests
        test_results.append(("Dependency Validation", self.test_dependency_validation()))
        test_results.append(("Thumbnail Selection Validation", self.test_thumbnail_selection_validation()))
        test_results.append(("Metadata Dependency Check", self.test_metadata_dependency_check()))
        test_results.append(("Pipeline State Structure", self.test_pipeline_state_structure()))
        test_results.append(("Force Regenerate Logic", self.test_force_regenerate_logic()))
        test_results.append(("API Endpoints Existence", self.test_api_endpoints_exist()))
        
        # Results summary
        self.log("=" * 60)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status} {test_name}")
            if result:
                passed += 1
        
        self.log("=" * 60)
        success_rate = (passed / total) * 100
        self.log(f"🎯 OVERALL RESULT: {passed}/{total} tests passed ({success_rate:.1f}%)")
        
        if success_rate >= 85:
            self.log("🎉 PIPELINE LOGIC TESTS SUCCESSFUL!")
            return True
        else:
            self.log("⚠️ PIPELINE LOGIC TESTS FAILED - Issues found")
            return False

def main():
    """Main test execution"""
    tester = PipelineTransitionTest()
    
    try:
        success = tester.run_pipeline_logic_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()