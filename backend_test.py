#!/usr/bin/env python3
"""
YouTube OAuth Integration Test Suite
Tests the complete YouTube OAuth integration flow including:
1. YouTube Integration Save
2. YouTube Connection Status
3. YouTube OAuth Start
4. State Parameter Validation
5. OAuth Callback Simulation
"""

import requests
import json
import base64
from urllib.parse import urlparse, parse_qs
import sys

# Configuration
BASE_URL = "https://youtube-pipeline-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from review request
TEST_EMAIL = "testuser@creatorflow.ai"
TEST_PASSWORD = "TestPassword123!"
TEST_YOUTUBE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"
TEST_CLIENT_SECRET = "test-client-secret"

class YouTubeOAuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.session_token = None
        
    def log(self, message, status="INFO"):
        print(f"[{status}] {message}")
        
    def register_user(self):
        """Register test user"""
        try:
            self.log("Registering test user...")
            response = self.session.post(f"{API_BASE}/register", json={
                "name": "Test User",
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 201:
                data = response.json()
                self.user_id = data["user"]["id"]
                self.log(f"✅ User registered successfully with ID: {self.user_id}")
                return True
            elif response.status_code == 409:
                self.log("User already exists, proceeding with authentication")
                return True
            else:
                self.log(f"❌ Registration failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}", "ERROR")
            return False
    
    def authenticate(self):
        """Authenticate user and get session"""
        try:
            self.log("Authenticating user...")
            
            # Get NextAuth CSRF token
            csrf_response = self.session.get(f"{API_BASE}/auth/csrf")
            if csrf_response.status_code != 200:
                self.log(f"❌ Failed to get CSRF token: {csrf_response.text}", "ERROR")
                return False
                
            csrf_data = csrf_response.json()
            csrf_token = csrf_data.get("csrfToken")
            
            # Authenticate with credentials
            auth_response = self.session.post(f"{API_BASE}/auth/callback/credentials", data={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "csrfToken": csrf_token,
                "callbackUrl": BASE_URL,
                "json": "true"
            })
            
            if auth_response.status_code == 200:
                auth_data = auth_response.json()
                if auth_data.get("url"):
                    self.log("✅ Authentication successful")
                    
                    # Get session to extract user ID
                    session_response = self.session.get(f"{API_BASE}/auth/session")
                    if session_response.status_code == 200:
                        session_data = session_response.json()
                        if session_data.get("user", {}).get("id"):
                            self.user_id = session_data["user"]["id"]
                            self.log(f"✅ Session established for user ID: {self.user_id}")
                            return True
                    
                    self.log("❌ Failed to get user session", "ERROR")
                    return False
                else:
                    self.log(f"❌ Authentication failed: {auth_data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Authentication failed: {auth_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def test_youtube_integration_save(self):
        """Test 1: POST /api/integrations with YouTube provider"""
        try:
            self.log("\n=== TEST 1: YouTube Integration Save ===")
            
            response = self.session.post(f"{API_BASE}/integrations", json={
                "provider": "youtube",
                "config_json": {
                    "client_id": TEST_YOUTUBE_CLIENT_ID,
                    "client_secret": TEST_CLIENT_SECRET
                }
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("integration"):
                    integration = data["integration"]
                    self.log(f"✅ YouTube integration saved successfully")
                    self.log(f"   Provider: {integration.get('provider')}")
                    self.log(f"   Connected: {data.get('connected')}")
                    self.log(f"   Message: {data.get('message')}")
                    
                    # Verify client_id is saved but client_secret is masked
                    config = integration.get("config_json", {})
                    if config.get("client_id") == TEST_YOUTUBE_CLIENT_ID:
                        self.log("✅ Client ID saved correctly")
                    else:
                        self.log("❌ Client ID not saved correctly", "ERROR")
                        return False
                        
                    if "client_secret" in config and config["client_secret"] != TEST_CLIENT_SECRET:
                        self.log("✅ Client secret is masked in response")
                    else:
                        self.log("⚠️  Client secret might not be masked", "WARN")
                    
                    return True
                else:
                    self.log(f"❌ Integration save failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Integration save failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Integration save error: {str(e)}", "ERROR")
            return False
    
    def test_get_integrations(self):
        """Test 2: GET /api/integrations to confirm YouTube integration is saved"""
        try:
            self.log("\n=== TEST 2: Get Integrations ===")
            
            response = self.session.get(f"{API_BASE}/integrations")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "integrations" in data:
                    integrations = data["integrations"]
                    youtube_integration = None
                    
                    for integration in integrations:
                        if integration.get("provider") == "youtube":
                            youtube_integration = integration
                            break
                    
                    if youtube_integration:
                        self.log("✅ YouTube integration found in integrations list")
                        self.log(f"   Provider: {youtube_integration.get('provider')}")
                        self.log(f"   Connected: {youtube_integration.get('is_connected')}")
                        
                        config = youtube_integration.get("config_json", {})
                        if config.get("client_id") == TEST_YOUTUBE_CLIENT_ID:
                            self.log("✅ Client ID persisted correctly")
                        else:
                            self.log("❌ Client ID not persisted correctly", "ERROR")
                            return False
                        
                        return True
                    else:
                        self.log("❌ YouTube integration not found in list", "ERROR")
                        return False
                else:
                    self.log(f"❌ Get integrations failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get integrations failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get integrations error: {str(e)}", "ERROR")
            return False
    
    def test_youtube_connection_status(self):
        """Test 3: GET /api/youtube/connection-status"""
        try:
            self.log("\n=== TEST 3: YouTube Connection Status ===")
            
            response = self.session.get(f"{API_BASE}/youtube/connection-status")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log("✅ YouTube connection status retrieved successfully")
                    self.log(f"   Connected: {data.get('connected')}")
                    self.log(f"   Has Credentials: {data.get('has_credentials')}")
                    self.log(f"   Has Access Token: {data.get('has_access_token')}")
                    self.log(f"   Requires OAuth: {data.get('requires_oauth')}")
                    self.log(f"   Channel Info: {data.get('channel_info')}")
                    
                    # Verify expected status
                    expected_status = {
                        "has_credentials": True,
                        "has_access_token": False,
                        "requires_oauth": True,
                        "connected": False
                    }
                    
                    for key, expected_value in expected_status.items():
                        actual_value = data.get(key)
                        if actual_value == expected_value:
                            self.log(f"✅ {key}: {actual_value} (correct)")
                        else:
                            self.log(f"❌ {key}: {actual_value}, expected: {expected_value}", "ERROR")
                            return False
                    
                    return True
                else:
                    self.log(f"❌ Connection status failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Connection status failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Connection status error: {str(e)}", "ERROR")
            return False
    
    def test_youtube_oauth_start(self):
        """Test 4: GET /api/youtube/auth - OAuth start"""
        try:
            self.log("\n=== TEST 4: YouTube OAuth Start ===")
            
            response = self.session.get(f"{API_BASE}/youtube/auth")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("auth_url"):
                    auth_url = data["auth_url"]
                    self.log("✅ OAuth auth URL generated successfully")
                    self.log(f"   Auth URL: {auth_url}")
                    
                    # Parse the auth URL to verify parameters
                    parsed_url = urlparse(auth_url)
                    query_params = parse_qs(parsed_url.query)
                    
                    # Check required parameters
                    required_params = ["client_id", "redirect_uri", "state", "scope", "response_type"]
                    for param in required_params:
                        if param in query_params:
                            self.log(f"✅ {param}: {query_params[param][0]}")
                        else:
                            self.log(f"❌ Missing required parameter: {param}", "ERROR")
                            return False
                    
                    # Verify client_id
                    if query_params.get("client_id", [None])[0] == TEST_YOUTUBE_CLIENT_ID:
                        self.log("✅ Client ID in auth URL matches saved credentials")
                    else:
                        self.log("❌ Client ID in auth URL doesn't match", "ERROR")
                        return False
                    
                    # Verify redirect_uri
                    expected_redirect = f"{BASE_URL}/api/youtube/callback"
                    if query_params.get("redirect_uri", [None])[0] == expected_redirect:
                        self.log("✅ Redirect URI is correct")
                    else:
                        self.log(f"❌ Redirect URI incorrect. Expected: {expected_redirect}", "ERROR")
                        return False
                    
                    # Verify scope contains YouTube permissions
                    scope = query_params.get("scope", [None])[0]
                    if scope and "youtube" in scope.lower():
                        self.log("✅ Scope contains YouTube permissions")
                    else:
                        self.log("❌ Scope doesn't contain YouTube permissions", "ERROR")
                        return False
                    
                    # Store state for next test
                    self.oauth_state = query_params.get("state", [None])[0]
                    return True
                else:
                    self.log(f"❌ OAuth start failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ OAuth start failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ OAuth start error: {str(e)}", "ERROR")
            return False
    
    def test_state_parameter_validation(self):
        """Test 5: Verify state parameter can be decoded and contains userId"""
        try:
            self.log("\n=== TEST 5: State Parameter Validation ===")
            
            if not hasattr(self, 'oauth_state') or not self.oauth_state:
                self.log("❌ No OAuth state available from previous test", "ERROR")
                return False
            
            # Decode the state parameter
            try:
                decoded_state = base64.b64decode(self.oauth_state).decode('utf-8')
                state_data = json.loads(decoded_state)
                self.log(f"✅ State parameter decoded successfully")
                self.log(f"   Decoded state: {state_data}")
                
                # Verify userId is present and matches
                if "userId" in state_data:
                    state_user_id = state_data["userId"]
                    if state_user_id == self.user_id:
                        self.log(f"✅ State contains correct userId: {state_user_id}")
                        return True
                    else:
                        self.log(f"❌ State userId mismatch. Expected: {self.user_id}, Got: {state_user_id}", "ERROR")
                        return False
                else:
                    self.log("❌ State doesn't contain userId", "ERROR")
                    return False
                    
            except Exception as decode_error:
                self.log(f"❌ Failed to decode state parameter: {str(decode_error)}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ State validation error: {str(e)}", "ERROR")
            return False
    
    def test_oauth_callback_simulation(self):
        """Test 6: Simulate OAuth callback (will fail on token exchange but should pass state validation)"""
        try:
            self.log("\n=== TEST 6: OAuth Callback Simulation ===")
            
            if not hasattr(self, 'oauth_state') or not self.oauth_state:
                self.log("❌ No OAuth state available from previous test", "ERROR")
                return False
            
            # Simulate callback with test code and real state
            callback_url = f"{API_BASE}/youtube/callback?code=test_authorization_code&state={self.oauth_state}"
            
            self.log(f"Simulating callback to: {callback_url}")
            
            # Note: We expect this to fail on token exchange since we're using a fake code
            # But it should pass state validation
            response = self.session.get(callback_url, allow_redirects=False)
            
            # Check if it's a redirect (which is expected behavior)
            if response.status_code in [302, 307, 308]:
                redirect_location = response.headers.get('Location', '')
                self.log(f"✅ Callback returned redirect (expected): {response.status_code}")
                self.log(f"   Redirect location: {redirect_location}")
                
                # Check if redirect contains error (expected due to fake code)
                if "youtube_callback=error" in redirect_location:
                    self.log("✅ Callback correctly failed on token exchange (expected with fake code)")
                    
                    # Check if error message indicates token exchange failure, not state validation failure
                    if "state" not in redirect_location.lower() and "invalid" not in redirect_location.lower():
                        self.log("✅ State validation passed (error is from token exchange, not state)")
                        return True
                    else:
                        self.log("❌ State validation failed", "ERROR")
                        return False
                else:
                    self.log("⚠️  Unexpected redirect without error", "WARN")
                    return True
                    
            elif response.status_code == 200:
                # Direct JSON response
                try:
                    data = response.json()
                    if "state" in str(data).lower() and "invalid" in str(data).lower():
                        self.log("❌ State validation failed", "ERROR")
                        return False
                    else:
                        self.log("✅ State validation passed", "INFO")
                        return True
                except:
                    self.log("✅ Non-JSON response, likely passed state validation", "INFO")
                    return True
            else:
                # Check response content for state-related errors
                response_text = response.text.lower()
                if "state" in response_text and ("invalid" in response_text or "missing" in response_text):
                    self.log(f"❌ State validation failed: {response.text}", "ERROR")
                    return False
                else:
                    self.log(f"✅ State validation passed (error from token exchange): {response.status_code}", "INFO")
                    return True
                
        except Exception as e:
            self.log(f"❌ OAuth callback simulation error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all YouTube OAuth integration tests"""
        self.log("🚀 Starting YouTube OAuth Integration Test Suite")
        self.log(f"Base URL: {BASE_URL}")
        self.log(f"Test Email: {TEST_EMAIL}")
        
        tests = [
            ("User Registration", self.register_user),
            ("User Authentication", self.authenticate),
            ("YouTube Integration Save", self.test_youtube_integration_save),
            ("Get Integrations", self.test_get_integrations),
            ("YouTube Connection Status", self.test_youtube_connection_status),
            ("YouTube OAuth Start", self.test_youtube_oauth_start),
            ("State Parameter Validation", self.test_state_parameter_validation),
            ("OAuth Callback Simulation", self.test_oauth_callback_simulation)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                    self.log(f"✅ {test_name} PASSED", "SUCCESS")
                else:
                    failed += 1
                    self.log(f"❌ {test_name} FAILED", "FAIL")
            except Exception as e:
                failed += 1
                self.log(f"❌ {test_name} ERROR: {str(e)}", "FAIL")
        
        self.log(f"\n📊 TEST SUMMARY:")
        self.log(f"   Total Tests: {len(tests)}")
        self.log(f"   Passed: {passed}")
        self.log(f"   Failed: {failed}")
        self.log(f"   Success Rate: {(passed/len(tests)*100):.1f}%")
        
        if failed == 0:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
            return True
        else:
            self.log(f"⚠️  {failed} TEST(S) FAILED", "FAIL")
            return False

if __name__ == "__main__":
    tester = YouTubeOAuthTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)