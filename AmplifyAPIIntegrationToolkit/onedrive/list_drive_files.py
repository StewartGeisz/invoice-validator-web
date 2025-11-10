#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

def list_drive_items(folder_id="root", page_size=25):
    """
    List OneDrive items with folder navigation using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/list_drive_items"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Data payload
    payload = {
        "data": {
            "folder_id": folder_id,
            "page_size": page_size
        }
    }

    try:
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=30
        )

        if response.status_code == 200:
            response_data = response.json()
            items = response_data.get("data", [])

            # Handle both list and dict responses
            if isinstance(items, dict):
                items = items.get("value", [])
            
            if not isinstance(items, list):
                items = []

            return items

        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("❌ Error: Forbidden - API key may be invalid or expired")
            return None
        elif response.status_code == 404:
            print("❌ Error: Folder not found")
            return None
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out")
        return None
    except Exception as e:
        print(f"❌ Error: Unexpected error occurred - {e}")
        return None

def format_size(size_bytes):
    """
    Format file size in human-readable format
    """
    if size_bytes == 0:
        return "0 B"
    
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"

def display_items(items, current_folder="root"):
    """
    Display OneDrive items in a formatted list
    """
    if not items:
        print("📁 Folder is empty")
        return
    
    # Separate folders and files
    folders = []
    files = []
    
    for item in items:
        if isinstance(item, dict):
            if item.get('folder'):  # It's a folder
                folders.append(item)
            else:  # It's a file
                files.append(item)
    
    print(f"\n📂 Current Location: {current_folder}")
    print("=" * 80)
    
    # Display folders first
    if folders:
        print("📁 FOLDERS:")
        print("-" * 40)
        for i, folder in enumerate(folders, 1):
            name = folder.get('name', 'Unknown Folder')
            folder_id = folder.get('id', 'Unknown')
            created = folder.get('createdDateTime', 'Unknown')[:10] if folder.get('createdDateTime') else 'Unknown'
            child_count = folder.get('folder', {}).get('childCount', 0)
            
            print(f"{i:2d}. 📁 {name}")
            print(f"     ID: {folder_id}")
            print(f"     Created: {created}")
            print(f"     Items: {child_count}")
            print()
    
    # Display files
    if files:
        print("📄 FILES:")
        print("-" * 40)
        start_num = len(folders) + 1
        for i, file_item in enumerate(files, start_num):
            name = file_item.get('name', 'Unknown File')
            file_id = file_item.get('id', 'Unknown')
            size = file_item.get('size', 0)
            modified = file_item.get('lastModifiedDateTime', 'Unknown')[:10] if file_item.get('lastModifiedDateTime') else 'Unknown'
            
            # Get file extension for icon
            ext = os.path.splitext(name)[1].lower()
            if ext in ['.jpg', '.png', '.gif', '.bmp']:
                icon = '🖼️'
            elif ext in ['.pdf']:
                icon = '📕'
            elif ext in ['.doc', '.docx']:
                icon = '📄'
            elif ext in ['.xls', '.xlsx']:
                icon = '📊'
            elif ext in ['.ppt', '.pptx']:
                icon = '📋'
            elif ext in ['.txt', '.md']:
                icon = '📝'
            elif ext in ['.zip', '.rar']:
                icon = '🗜️'
            else:
                icon = '📄'
            
            print(f"{i:2d}. {icon} {name}")
            print(f"     ID: {file_id}")
            print(f"     Size: {format_size(size)}")
            print(f"     Modified: {modified}")
            print()

def interactive_browser():
    """
    Interactive OneDrive browser with folder navigation
    """
    current_folder = "root"
    folder_path = ["📁 OneDrive Root"]
    
    print("OneDrive Browser - AmplifyAPI Integration")
    print("=" * 60)
    print("Commands: 'q' to quit, 'back' to go up one level, number to enter folder")
    print()
    
    while True:
        print(f"\n📍 Path: {' > '.join(folder_path)}")
        
        # List current folder contents
        items = list_drive_items(current_folder)
        
        if items is None:
            print("❌ Failed to load folder contents")
            break
        
        if not items:
            print("📁 This folder is empty")
        else:
            display_items(items, current_folder)
        
        print("\n" + "=" * 60)
        choice = input("Enter command (folder number, 'back', or 'q' to quit): ").strip().lower()
        
        if choice == 'q':
            print("👋 Goodbye!")
            break
        elif choice == 'back':
            if len(folder_path) > 1:
                folder_path.pop()
                # For simplicity, we'll go back to root - in a full implementation,
                # you'd maintain a folder ID history
                current_folder = "root"
                print("⬆️ Going back...")
            else:
                print("📁 Already at root folder")
        else:
            try:
                # Try to parse as folder number
                folder_num = int(choice)
                
                # Get folders only (files can't be navigated into)
                folders = [item for item in items if isinstance(item, dict) and item.get('folder')]
                
                if 1 <= folder_num <= len(folders):
                    selected_folder = folders[folder_num - 1]
                    current_folder = selected_folder.get('id', 'root')
                    folder_name = selected_folder.get('name', 'Unknown')
                    folder_path.append(f"📁 {folder_name}")
                    print(f"📂 Entering folder: {folder_name}")
                else:
                    print("❌ Invalid folder number")
                    
            except ValueError:
                print("❌ Invalid command. Use folder number, 'back', or 'q'")

def quick_list():
    """
    Quick list of root folder contents
    """
    print("OneDrive Quick List - Root Folder")
    print("=" * 50)
    
    items = list_drive_items("root", 20)
    
    if items is None:
        print("❌ Failed to list OneDrive contents")
        return
    
    if not items:
        print("📁 OneDrive is empty")
        return
    
    display_items(items, "root")
    
    print(f"\n📊 Total items: {len(items)}")

if __name__ == "__main__":
    try:
        print("OneDrive File Browser - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Interactive browser (navigate folders)\n2. Quick list (root folder only)\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            quick_list()
        else:
            interactive_browser()

    except KeyboardInterrupt:
        print("\n\n👋 Operation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)