#!/usr/bin/env python3

import requests
import json
import os
import base64
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def download_file_from_onedrive():
    """
    Download a file from OneDrive using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/download_file"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get file details from user
    print("Downloading file from OneDrive...")
    print("=" * 50)
    
    item_id = input("Enter OneDrive item ID to download: ").strip()
    if not item_id:
        print("❌ Error: Item ID is required")
        return None
    
    # Get local save path
    save_path = input("Enter local save path (with filename): ").strip()
    if not save_path:
        save_path = f"downloaded_file_{item_id[:8]}"
        print(f"Using default save path: {save_path}")

    # Data payload
    payload = {
        "data": {
            "item_id": item_id
        }
    }

    try:
        print(f"\nDownloading file...")
        print(f"Item ID: {item_id}")
        print(f"Save to: {save_path}")
        print("-" * 50)
        
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=60
        )

        if response.status_code == 200:
            response_data = response.json()
            
            # Debug: Print response structure to understand the API response
            print(f"📋 Debug - API Response structure:")
            print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Not a dict'}")
            
            file_data = response_data.get("data", {})
            print(f"   Data type: {type(file_data)}")
            if isinstance(file_data, dict):
                print(f"   Data keys: {list(file_data.keys())}")
            
            # Handle different possible response structures
            if isinstance(file_data, dict):
                # Try multiple possible field names for file content or download URL
                download_link = (
                    file_data.get('downloadLink') or  # This is what we're getting!
                    file_data.get('content') or 
                    file_data.get('file_content') or 
                    file_data.get('@microsoft.graph.downloadUrl') or
                    file_data.get('downloadUrl') or
                    ''
                )
                
                file_name = file_data.get('name', file_data.get('filename', 'downloaded_file'))
                file_size = file_data.get('size', 0)
                
                print(f"   File name: {file_name}")
                print(f"   File size: {file_size}")
                print(f"   Download link available: {'Yes' if download_link else 'No'}")
                if download_link:
                    print(f"   Download URL: {download_link[:60]}..." if len(download_link) > 60 else f"   Download URL: {download_link}")
                
                # If we got a download URL, use it to download the file
                if download_link and download_link.startswith('http'):
                    print("   📁 Got download URL, fetching content...")
                    try:
                        download_response = requests.get(download_link, timeout=60)
                        if download_response.status_code == 200:
                            file_content = download_response.content
                            
                            # Save to local file
                            os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else '.', exist_ok=True)
                            with open(save_path, 'wb') as f:
                                f.write(file_content)
                            
                            print("✅ File downloaded successfully!")
                            print(f"File Name: {file_name}")
                            print(f"File Size: {len(file_content):,} bytes")
                            print(f"Saved to: {save_path}")
                            
                            return {"file_path": save_path, "size": len(file_content)}
                        else:
                            print(f"❌ Failed to download from URL: HTTP {download_response.status_code}")
                            return None
                    except Exception as e:
                        print(f"❌ Error downloading from URL: {e}")
                        return None
                
                elif download_link and not download_link.startswith('http'):
                    try:
                        # Decode base64 content
                        file_content = base64.b64decode(download_link)
                        
                        # Save to local file
                        os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else '.', exist_ok=True)
                        with open(save_path, 'wb') as f:
                            f.write(file_content)
                        
                        print("✅ File downloaded successfully!")
                        print(f"File Name: {file_name}")
                        print(f"File Size: {len(file_content):,} bytes")
                        print(f"Saved to: {save_path}")
                        
                        return {"file_path": save_path, "size": len(file_content)}
                        
                    except Exception as e:
                        print(f"❌ Error decoding/saving file: {e}")
                        return None
                else:
                    print("❌ Error: No file content received from API")
                    print("   This might be because:")
                    print("   - The API endpoint doesn't return file content directly")
                    print("   - The file might be too large for direct download")
                    print("   - The item ID might be for a folder, not a file")
                    print("   - Different API endpoint might be needed for file downloads")
                    return None
            else:
                print("❌ Error: Invalid response format")
                return None

        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("❌ Error: Forbidden - API key may be invalid or expired")
            return None
        elif response.status_code == 404:
            print("❌ Error: File not found - Check the item ID")
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

def list_recent_files():
    """
    List recent OneDrive files to help user find item IDs
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/list_drive_items"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "data": {
            "folder_id": "root",
            "page_size": 10
        }
    }

    try:
        print("Listing recent OneDrive files...")
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            response_data = response.json()
            items = response_data.get("data", [])
            
            if isinstance(items, list) and items:
                print("\nRecent Files:")
                print("-" * 60)
                for i, item in enumerate(items[:10], 1):
                    if isinstance(item, dict):
                        name = item.get('name', 'Unknown')
                        item_id = item.get('id', 'Unknown')
                        size = item.get('size', 0)
                        modified = item.get('lastModifiedDateTime', 'Unknown')
                        
                        print(f"{i}. {name}")
                        print(f"   ID: {item_id}")
                        print(f"   Size: {size:,} bytes")
                        print(f"   Modified: {modified}")
                        print()
                
                return items
            else:
                print("No files found or unable to parse response")
                return None
        else:
            print(f"Could not list files (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"Error listing files: {e}")
        return None

if __name__ == "__main__":
    try:
        print("OneDrive File Downloader - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Download file by ID\n2. List recent files first, then download\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            files = list_recent_files()
            if files:
                print("\nUse the Item ID from above to download a file.")
                print("=" * 60)
        
        result = download_file_from_onedrive()

        if result is None:
            print("\n❌ Failed to download file")
            exit(1)
        else:
            print("\n🎉 File download completed successfully!")

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)