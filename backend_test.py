#!/usr/bin/env python3
"""
CreatorFlow AI Backend Testing Suite - Phase 1 Improvements
Testing new YouTube Connection Status and Settings endpoints plus regression tests
"""

import requests
import json
import uuid
import time
from datetime import datetime

# Configuration
BASE_URL = "https://youtube-pipeline-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials as specified in review request
TEST_EMAIL = "testuser@creatorflow.ai"
TEST_PASSWORD = "TestPassword123!"
TEST_NAME = "Test User"

class CreatorFlowTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.session_token = None
        self.project_id = None
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")
        
    def test_health_check(self):
        """Test basic health endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
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
    
    def register_user(self):
        """Register a new test user"""
        try:
            # Use unique email to avoid conflicts
            unique_email = f"testuser_{uuid.uuid4().hex[:8]}@creatorflow.ai"
            
            payload = {
                "name": TEST_NAME,
                "email": unique_email,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(f"{API_BASE}/register", json=payload)
            
            if response.status_code == 201:
                data = response.json()
                if data.get("success"):
                    self.user_id = data["user"]["id"]
                    self.log(f"✅ User registered successfully: {unique_email}", "SUCCESS")
                    return unique_email
                else:
                    self.log(f"❌ Registration failed: {data}", "ERROR")
                    return None
            else:
                self.log(f"❌ Registration failed with status {response.status_code}: {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Registration exception: {str(e)}", "ERROR")
            return None
    
    def authenticate_user(self, email):
        """Authenticate user via NextAuth credentials"""
        try:
            # First, try to get CSRF token
            csrf_response = self.session.get(f"{BASE_URL}/api/auth/csrf")
            if csrf_response.status_code == 200:
                csrf_token = csrf_response.json().get("csrfToken")
                self.log(f"✅ Got CSRF token", "SUCCESS")
            else:
                self.log("⚠️ Could not get CSRF token, proceeding without it", "WARNING")
                csrf_token = None
            
            # Attempt to sign in via NextAuth
            signin_payload = {
                "email": email,
                "password": TEST_PASSWORD,
                "redirect": "false"
            }
            
            if csrf_token:
                signin_payload["csrfToken"] = csrf_token
            
            signin_response = self.session.post(
                f"{BASE_URL}/api/auth/callback/credentials",
                data=signin_payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                allow_redirects=False
            )
            
            # Check for session cookie
            session_cookies = [cookie for cookie in self.session.cookies if 'session' in cookie.name.lower()]
            
            if session_cookies:
                self.log(f"✅ Authentication successful - got session cookies", "SUCCESS")
                return True
            else:
                self.log(f"❌ Authentication failed - no session cookies found", "ERROR")
                self.log(f"Response status: {signin_response.status_code}", "DEBUG")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication exception: {str(e)}", "ERROR")
            return False
    
    def test_youtube_connection_status(self):
        """Test NEW YouTube Connection Status endpoint"""
        try:
            self.log("Testing YouTube Connection Status endpoint...", "INFO")
            
            response = self.session.get(f"{API_BASE}/youtube/connection-status")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Verify expected fields are present
                    required_fields = ["connected", "has_credentials", "has_access_token", "requires_oauth", "channel_info"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        self.log(f"✅ YouTube connection status endpoint working correctly", "SUCCESS")
                        self.log(f"   Connected: {data['connected']}", "INFO")
                        self.log(f"   Has credentials: {data['has_credentials']}", "INFO")
                        self.log(f"   Has access token: {data['has_access_token']}", "INFO")
                        self.log(f"   Requires OAuth: {data['requires_oauth']}", "INFO")
                        return True
                    else:
                        self.log(f"❌ Missing required fields: {missing_fields}", "ERROR")
                        return False
                else:
                    self.log(f"❌ YouTube connection status failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ YouTube connection status failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ YouTube connection status exception: {str(e)}", "ERROR")
            return False
    
    def test_settings_endpoints(self):
        """Test NEW Settings endpoints (GET and POST)"""
        try:
            self.log("Testing Settings endpoints...", "INFO")
            
            # Test GET /api/settings
            get_response = self.session.get(f"{API_BASE}/settings")
            
            if get_response.status_code == 200:
                get_data = get_response.json()
                if get_data.get("success"):
                    self.log("✅ GET /api/settings working correctly", "SUCCESS")
                    
                    # Verify expected structure
                    if "settings" in get_data and "user" in get_data:
                        settings = get_data["settings"]
                        user = get_data["user"]
                        
                        self.log(f"   User: {user.get('name')} ({user.get('email')})", "INFO")
                        self.log(f"   Theme: {settings.get('theme', 'not set')}", "INFO")
                        self.log(f"   Default language: {settings.get('default_language', 'not set')}", "INFO")
                        
                        # Test POST /api/settings
                        updated_settings = {
                            "settings": {
                                "theme": "light",
                                "default_language": "Spanish",
                                "default_aspect_ratio": "9:16",
                                "default_publishing_mode": "public",
                                "default_avatar_id": "test_avatar_123",
                                "default_voice_id": "test_voice_456"
                            }
                        }
                        
                        post_response = self.session.post(f"{API_BASE}/settings", json=updated_settings)
                        
                        if post_response.status_code == 200:
                            post_data = post_response.json()
                            if post_data.get("success"):
                                self.log("✅ POST /api/settings working correctly", "SUCCESS")
                                
                                # Verify settings were saved
                                verify_response = self.session.get(f"{API_BASE}/settings")
                                if verify_response.status_code == 200:
                                    verify_data = verify_response.json()
                                    saved_settings = verify_data.get("settings", {})
                                    
                                    if saved_settings.get("theme") == "light" and saved_settings.get("default_language") == "Spanish":
                                        self.log("✅ Settings persistence verified", "SUCCESS")
                                        return True
                                    else:
                                        self.log("❌ Settings not properly saved", "ERROR")
                                        return False
                                else:
                                    self.log("❌ Could not verify settings save", "ERROR")
                                    return False
                            else:
                                self.log(f"❌ POST settings failed: {post_data}", "ERROR")
                                return False
                        else:
                            self.log(f"❌ POST settings failed with status {post_response.status_code}: {post_response.text}", "ERROR")
                            return False
                    else:
                        self.log("❌ GET settings missing required structure", "ERROR")
                        return False
                else:
                    self.log(f"❌ GET settings failed: {get_data}", "ERROR")
                    return False
            else:
                self.log(f"❌ GET settings failed with status {get_response.status_code}: {get_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Settings endpoints exception: {str(e)}", "ERROR")
            return False
    
    def test_projects_regression(self):
        """Regression test for existing project endpoints"""
        try:
            self.log("Testing Projects endpoints (regression)...", "INFO")
            
            # Test GET /api/projects (list)
            list_response = self.session.get(f"{API_BASE}/projects")
            if list_response.status_code == 200:
                list_data = list_response.json()
                if list_data.get("success"):
                    self.log("✅ GET /api/projects working correctly", "SUCCESS")
                    initial_count = len(list_data.get("projects", []))
                    self.log(f"   Found {initial_count} existing projects", "INFO")
                else:
                    self.log(f"❌ GET projects failed: {list_data}", "ERROR")
                    return False
            else:
                self.log(f"❌ GET projects failed with status {list_response.status_code}", "ERROR")
                return False
            
            # Test POST /api/projects (create)
            project_payload = {
                "concept": "AI-powered productivity tips for remote workers",
                "duration_seconds": 90,
                "aspect_ratio": "16:9",
                "language": "English",
                "content_style": "professional",
                "publishing_mode": "draft"
            }
            
            create_response = self.session.post(f"{API_BASE}/projects", json=project_payload)
            if create_response.status_code == 201:
                create_data = create_response.json()
                if create_data.get("success"):
                    self.project_id = create_data["project"]["_id"]
                    self.log(f"✅ POST /api/projects working correctly - created project {self.project_id}", "SUCCESS")
                else:
                    self.log(f"❌ POST projects failed: {create_data}", "ERROR")
                    return False
            else:
                self.log(f"❌ POST projects failed with status {create_response.status_code}: {create_response.text}", "ERROR")
                return False
            
            # Test GET /api/projects/:id (get specific project)
            if self.project_id:
                get_response = self.session.get(f"{API_BASE}/projects/{self.project_id}")
                if get_response.status_code == 200:
                    get_data = get_response.json()
                    if get_data.get("success"):
                        self.log("✅ GET /api/projects/:id working correctly", "SUCCESS")
                        project = get_data["project"]
                        self.log(f"   Project concept: {project.get('concept', 'N/A')}", "INFO")
                        self.log(f"   Project status: {project.get('status', 'N/A')}", "INFO")
                    else:
                        self.log(f"❌ GET project by ID failed: {get_data}", "ERROR")
                        return False
                else:
                    self.log(f"❌ GET project by ID failed with status {get_response.status_code}", "ERROR")
                    return False
            
            return True
            
        except Exception as e:
            self.log(f"❌ Projects regression test exception: {str(e)}", "ERROR")
            return False
    
    def test_pipeline_regression(self):
        """Quick regression test for pipeline endpoints"""
        try:
            if not self.project_id:
                self.log("⚠️ No project ID available, skipping pipeline tests", "WARNING")
                return True
                
            self.log("Testing Pipeline endpoints (regression)...", "INFO")
            
            # Test idea evaluation
            eval_response = self.session.post(f"{API_BASE}/projects/{self.project_id}/evaluate")
            if eval_response.status_code == 200:
                eval_data = eval_response.json()
                if eval_data.get("success"):
                    self.log("✅ POST /api/projects/:id/evaluate working correctly", "SUCCESS")
                    if eval_data.get("cached"):
                        self.log("   (Using cached result)", "INFO")
                else:
                    self.log(f"❌ Idea evaluation failed: {eval_data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Idea evaluation failed with status {eval_response.status_code}: {eval_response.text}", "ERROR")
                return False
            
            # Test script generation
            script_response = self.session.post(f"{API_BASE}/projects/{self.project_id}/generate-script")
            if script_response.status_code == 200:
                script_data = script_response.json()
                if script_data.get("success"):
                    self.log("✅ POST /api/projects/:id/generate-script working correctly", "SUCCESS")
                    if script_data.get("cached"):
                        self.log("   (Using cached result)", "INFO")
                else:
                    self.log(f"❌ Script generation failed: {script_data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Script generation failed with status {script_response.status_code}: {script_response.text}", "ERROR")
                return False
            
            return True
            
        except Exception as e:
            self.log(f"❌ Pipeline regression test exception: {str(e)}", "ERROR")
            return False
    
    def cleanup_test_project(self):
        """Clean up test project"""
        try:
            if self.project_id:
                delete_response = self.session.delete(f"{API_BASE}/projects/{self.project_id}")
                if delete_response.status_code == 200:
                    self.log(f"✅ Test project {self.project_id} cleaned up", "SUCCESS")
                else:
                    self.log(f"⚠️ Could not delete test project: {delete_response.status_code}", "WARNING")
        except Exception as e:
            self.log(f"⚠️ Cleanup exception: {str(e)}", "WARNING")
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("=== CreatorFlow AI Backend Testing - Phase 1 Improvements ===", "INFO")
        self.log(f"Testing against: {BASE_URL}", "INFO")
        
        results = {}
        
        # Test 1: Health Check
        results["health_check"] = self.test_health_check()
        
        # Test 2: User Registration
        email = self.register_user()
        results["user_registration"] = email is not None
        
        if not email:
            self.log("❌ Cannot proceed without user registration", "ERROR")
            return results
        
        # Test 3: Authentication
        results["authentication"] = self.authenticate_user(email)
        
        if not results["authentication"]:
            self.log("❌ Cannot proceed without authentication", "ERROR")
            return results
        
        # Test 4: NEW - YouTube Connection Status
        results["youtube_connection_status"] = self.test_youtube_connection_status()
        
        # Test 5: NEW - Settings Endpoints
        results["settings_endpoints"] = self.test_settings_endpoints()
        
        # Test 6: Projects Regression
        results["projects_regression"] = self.test_projects_regression()
        
        # Test 7: Pipeline Regression
        results["pipeline_regression"] = self.test_pipeline_regression()
        
        # Cleanup
        self.cleanup_test_project()
        
        # Summary
        self.log("=== TEST RESULTS SUMMARY ===", "INFO")
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}", "RESULT")
        
        self.log(f"Overall: {passed}/{total} tests passed", "SUMMARY")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
        else:
            self.log(f"⚠️ {total - passed} test(s) failed", "WARNING")
        
        return results

if __name__ == "__main__":
    tester = CreatorFlowTester()
    results = tester.run_all_tests()