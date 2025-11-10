#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

def create_onedrive_folder():
    """
    Create a new folder in OneDrive using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/create_folder"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get folder details from user
    print("Creating OneDrive folder...")
    print("=" * 50)
    
    folder_name = input("Enter folder name: ").strip()
    if not folder_name:
        print("❌ Error: Folder name is required")
        return None
    
    # Validate folder name (basic checks)
    invalid_chars = ['<', '>', ':', '"', '|', '?', '*', '/', '\\']
    if any(char in folder_name for char in invalid_chars):
        print(f"❌ Error: Folder name contains invalid characters: {invalid_chars}")
        return None
    
    # Get parent folder
    parent_folder = input("Enter parent folder ID (or 'root' for root folder) [root]: ").strip()
    if not parent_folder:
        parent_folder = "root"

    # Data payload
    payload = {
        "data": {
            "folder_name": folder_name,
            "parent_folder_id": parent_folder
        }
    }

    try:
        print(f"\nCreating folder...")
        print(f"Name: {folder_name}")
        print(f"Parent: {parent_folder}")
        print("-" * 50)
        
        # Confirm creation
        confirm = input("Create this folder? (yes/y to confirm): ").strip().lower()
        if confirm not in ["yes", "y"]:
            print("❌ Folder creation cancelled")
            return None
        
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=30
        )

        if response.status_code == 200:
            response_data = response.json()
            folder_data = response_data.get("data", {})

            print("✅ Folder created successfully!")
            
            if isinstance(folder_data, dict):
                folder_id = folder_data.get('id', 'Unknown')
                web_url = folder_data.get('webUrl', '')
                created_time = folder_data.get('createdDateTime', 'Unknown')
                
                print(f"Folder ID: {folder_id}")
                print(f"Created: {created_time}")
                if web_url:
                    print(f"Web URL: {web_url}")
                
                # Show folder location
                parent_ref = folder_data.get('parentReference', {})
                if isinstance(parent_ref, dict):
                    parent_path = parent_ref.get('path', '')
                    if parent_path:
                        print(f"Full Path: {parent_path}/{folder_name}")
            
            return folder_data

        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("❌ Error: Forbidden - API key may be invalid or expired")
            return None
        elif response.status_code == 404:
            print("❌ Error: Parent folder not found")
            return None
        elif response.status_code == 409:
            print("❌ Error: Folder with this name already exists")
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

def create_project_structure():
    """
    Create a predefined project folder structure
    """
    
    print("Creating project folder structure...")
    
    # Base project folder
    project_name = input("Enter project name: ").strip()
    if not project_name:
        project_name = "AmplifyAPI_Test_Project"
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("❌ Error: API key not found")
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/create_folder"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    folders_to_create = [
        {"name": project_name, "parent": "root"},
        {"name": "Documents", "parent": None},  # Will be set after main folder is created
        {"name": "Images", "parent": None},
        {"name": "Data", "parent": None},
        {"name": "Archive", "parent": None}
    ]

    try:
        print(f"\nCreating project structure for: {project_name}")
        print("-" * 50)
        
        # Create main project folder first
        main_payload = {
            "data": {
                "folder_name": project_name,
                "parent_folder_id": "root"
            }
        }
        
        response = requests.post(url, headers=headers, data=json.dumps(main_payload), timeout=30)
        
        if response.status_code == 200:
            main_folder = response.json().get("data", {})
            main_folder_id = main_folder.get('id', '')
            
            print(f"✅ Created main folder: {project_name}")
            
            # Create subfolders
            subfolders = ["Documents", "Images", "Data", "Archive"]
            created_folders = [project_name]
            
            for subfolder in subfolders:
                subfolder_payload = {
                    "data": {
                        "folder_name": subfolder,
                        "parent_folder_id": main_folder_id
                    }
                }
                
                sub_response = requests.post(url, headers=headers, data=json.dumps(subfolder_payload), timeout=30)
                
                if sub_response.status_code == 200:
                    print(f"✅ Created subfolder: {project_name}/{subfolder}")
                    created_folders.append(f"{project_name}/{subfolder}")
                else:
                    print(f"❌ Failed to create subfolder: {subfolder}")
            
            print(f"\n🎉 Project structure created successfully!")
            print("📁 Created folders:")
            for folder in created_folders:
                print(f"   📂 {folder}")
            
            return {"main_folder_id": main_folder_id, "created_folders": created_folders}
        
        else:
            print(f"❌ Failed to create main project folder (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"❌ Error creating project structure: {e}")
        return None

if __name__ == "__main__":
    try:
        print("OneDrive Folder Creator - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Create single folder\n2. Create project structure (folder with subfolders)\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            result = create_project_structure()
        else:
            result = create_onedrive_folder()

        if result is None:
            print("\n❌ Failed to create folder(s)")
            exit(1)
        else:
            print("\n🎉 Folder creation completed successfully!")

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)