#!/usr/bin/env python3

import requests
import json
import os
import base64
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def upload_file_to_onedrive():
    """
    Upload a file to OneDrive using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/upload_file"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get file details from user
    print("Uploading file to OneDrive...")
    print("=" * 50)
    
    file_path = input("Enter local file path to upload: ").strip()
    if not file_path or not os.path.exists(file_path):
        print("❌ Error: File not found")
        return None
    
    # Get file info
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)
    
    if file_size > 4 * 1024 * 1024:  # 4MB limit for demonstration
        print(f"❌ Error: File too large ({file_size} bytes). Limit: 4MB for this demo")
        return None
    
    # Read file content - check if it's text or binary
    try:
        # First try to read as text (for text files like .md, .txt, .py, etc.)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                file_content = f.read()
                print(f"📝 Reading as text file")
        except UnicodeDecodeError:
            # If it's binary, read as binary and base64 encode
            with open(file_path, 'rb') as f:
                file_content_bytes = f.read()
                file_content = base64.b64encode(file_content_bytes).decode('utf-8')
                print(f"🔢 Reading as binary file (base64 encoded)")
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return None
    
    # Get destination folder
    folder_input = input("Enter destination folder (or 'root' for root folder) [root]: ").strip()
    folder_id = folder_input if folder_input else "root"
    
    # Override filename if desired
    new_name = input(f"Enter new filename [{file_name}]: ").strip()
    if new_name:
        file_name = new_name

    # Data payload
    payload = {
        "data": {
            "file_path": file_name,
            "file_content": file_content,
            "folder_id": folder_id
        }
    }

    try:
        print(f"\nUploading file...")
        print(f"File: {file_name}")
        print(f"Size: {file_size:,} bytes")
        print(f"Destination: {folder_id}")
        print("-" * 50)
        
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=60
        )

        if response.status_code == 200:
            response_data = response.json()
            file_data = response_data.get("data", {})

            print("✅ File uploaded successfully!")
            
            if isinstance(file_data, dict):
                file_id = file_data.get('id', 'Unknown')
                web_url = file_data.get('webUrl', '')
                created_time = file_data.get('createdDateTime', 'Unknown')
                
                print(f"File ID: {file_id}")
                print(f"Created: {created_time}")
                if web_url:
                    print(f"Web URL: {web_url}")
            
            return file_data

        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("❌ Error: Forbidden - API key may be invalid or expired")
            return None
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out - File may be too large")
        return None
    except Exception as e:
        print(f"❌ Error: Unexpected error occurred - {e}")
        return None

def create_test_file():
    """
    Create and upload a test file
    """
    test_content = """AmplifyAPI OneDrive Integration Test

This is a test file created by the AmplifyAPI integration script.

Test Results:
✅ File Creation: Success
✅ OneDrive Upload: Working
✅ API Integration: Functional

Created: """ + str(os.environ.get('USER', 'Unknown')) + """
Timestamp: """ + str(requests.get('http://worldtimeapi.org/api/timezone/Etc/UTC').json().get('datetime', 'Unknown') if requests else 'Unknown')

    # Create temporary test file
    test_file_path = "/tmp/amplify_test_file.txt"
    try:
        with open(test_file_path, 'w') as f:
            f.write(test_content)
        
        print(f"Created test file: {test_file_path}")
        return test_file_path
    except Exception as e:
        print(f"❌ Error creating test file: {e}")
        return None

if __name__ == "__main__":
    try:
        print("OneDrive File Uploader - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Upload existing file\n2. Create and upload test file\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            test_file = create_test_file()
            if test_file:
                # Simulate user input for test file
                print(f"Uploading test file: {test_file}")
                result = upload_file_to_onedrive()
        else:
            result = upload_file_to_onedrive()

        if result is None:
            print("\n❌ Failed to upload file")
            exit(1)
        else:
            print("\n🎉 File upload completed successfully!")

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)