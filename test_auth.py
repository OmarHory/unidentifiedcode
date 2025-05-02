import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8000"  # Change if your server is running on a different URL
AUTH_ENDPOINT = f"{BASE_URL}/api/auth/token"
PROJECT_ENDPOINT = f"{BASE_URL}/api/ide/projects"

def get_token():
    """Get authentication token"""
    try:
        print(f"Making request to {AUTH_ENDPOINT}")
        response = requests.post(
            AUTH_ENDPOINT,
            json={"username": "test", "password": "test"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Auth response status: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            print(f"Token received: {token_data['access_token'][:10]}...")
            return token_data["access_token"]
        else:
            print(f"Auth error: {response.text}")
            return None
    except Exception as e:
        print(f"Error getting token: {str(e)}")
        return None

def create_project(token):
    """Create a project using the token"""
    try:
        print(f"Making request to {PROJECT_ENDPOINT}")
        auth_header = f"Bearer {token}"
        print(f"Using Authorization header: {auth_header}")
        
        response = requests.post(
            PROJECT_ENDPOINT,
            json={"name": "test_project"},
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_header
            }
        )
        
        print(f"Project creation response status: {response.status_code}")
        
        if response.status_code == 200 or response.status_code == 201:
            print(f"Project created: {response.json()}")
            return True
        else:
            print(f"Project creation error: {response.text}")
            return False
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return False

def main():
    print("=== SpeakCode Auth Test ===")
    
    # Check if server is running
    try:
        health_check = requests.get(f"{BASE_URL}/api/health")
        if health_check.status_code != 200:
            print(f"Server doesn't seem to be running properly. Health check status: {health_check.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print(f"Cannot connect to server at {BASE_URL}. Is it running?")
        return
    
    # Get token
    token = get_token()
    if not token:
        print("Failed to get token. Exiting.")
        return
    
    # Create project
    success = create_project(token)
    if success:
        print("Test completed successfully!")
    else:
        print("Test failed.")

if __name__ == "__main__":
    main() 