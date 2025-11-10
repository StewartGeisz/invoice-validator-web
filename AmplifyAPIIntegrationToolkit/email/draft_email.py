#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

def create_email_draft():
    """
    Create an email draft using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/create_draft"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get draft content from user
    print("Creating an email draft...")
    print("=" * 50)
    
    subject = input("Enter email subject: ").strip()
    if not subject:
        subject = "Test Draft Email"
    
    print("\nEnter email body (press Enter twice to finish):")
    body_lines = []
    while True:
        line = input()
        if line == "" and len(body_lines) > 0 and body_lines[-1] == "":
            break
        body_lines.append(line)
    
    # Remove the last empty line
    if body_lines and body_lines[-1] == "":
        body_lines.pop()
    
    body = "\n".join(body_lines)
    if not body:
        body = "This is a test draft email created via AmplifyAPI integration."
    
    to_recipients = input("\nEnter recipient email(s) (comma-separated): ").strip()
    if not to_recipients:
        to_recipients = "test@example.com"
    
    # Convert comma-separated emails to list
    to_list = [email.strip() for email in to_recipients.split(",") if email.strip()]
    
    cc_recipients = input("Enter CC email(s) (comma-separated, optional): ").strip()
    cc_list = [email.strip() for email in cc_recipients.split(",") if email.strip()] if cc_recipients else []
    
    importance = input("Enter importance (normal/low/high) [normal]: ").strip().lower()
    if importance not in ["low", "normal", "high"]:
        importance = "normal"

    # Data payload for draft creation
    payload = {
        "data": {
            "subject": subject,
            "body": body,
            "to_recipients": to_list,
            "cc_recipients": cc_list,
            "importance": importance
        }
    }

    try:
        print(f"\nCreating draft email...")
        print(f"Subject: {subject}")
        print(f"To: {', '.join(to_list)}")
        if cc_list:
            print(f"CC: {', '.join(cc_list)}")
        print(f"Importance: {importance}")
        print("-" * 50)
        
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=30
        )

        # Check for a successful response
        if response.status_code == 200:
            try:
                # Parse the JSON response
                response_data = response.json()
                draft_data = response_data.get("data", {})

                print("✅ Email draft created successfully!")
                print(f"Draft ID: {draft_data.get('id', 'Unknown')}")
                
                # Show draft details if available
                if isinstance(draft_data, dict):
                    created_time = draft_data.get('createdDateTime', 'Unknown')
                    print(f"Created: {created_time}")
                    
                    # Show if it's in drafts folder
                    parent_folder = draft_data.get('parentFolderId', '')
                    if 'drafts' in parent_folder.lower():
                        print("📂 Saved to Drafts folder")
                
                return draft_data

            except json.JSONDecodeError as e:
                print(f"Error: Failed to parse JSON response: {e}")
                print(f"Response content: {response.text[:200]}...")
                return None

        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("❌ Error: Forbidden - API key may be invalid or expired")
            return None
        elif response.status_code == 429:
            print("❌ Error: Rate limit exceeded - Please wait before making another request")
            return None
        elif response.status_code >= 500:
            print(f"❌ Error: Server error (HTTP {response.status_code}) - Please try again later")
            return None
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out - Please check your internet connection and try again")
        return None
    except requests.exceptions.ConnectionError:
        print("❌ Error: Connection failed - Please check your internet connection")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: Request failed - {e}")
        return None
    except Exception as e:
        print(f"❌ Error: Unexpected error occurred - {e}")
        return None

def create_predefined_draft():
    """
    Create a quick test draft with predefined content
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/create_draft"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Predefined draft content
    payload = {
        "data": {
            "subject": "AmplifyAPI Integration Test - Draft Email",
            "body": "Hello!\n\nThis is a test draft email created through the AmplifyAPI integration.\n\nKey features tested:\n- Email draft creation\n- Subject and body content\n- Recipient management\n- API connectivity\n\nBest regards,\nAmplifyAPI Test Script",
            "to_recipients": ["test@example.com"],
            "cc_recipients": [],
            "importance": "normal"
        }
    }

    try:
        print("Creating predefined test draft...")
        
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            draft_data = response.json().get("data", {})
            print("✅ Test draft created successfully!")
            print(f"Draft ID: {draft_data.get('id', 'Unknown')}")
            return draft_data
        else:
            print(f"❌ Failed to create test draft (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"❌ Error creating test draft: {e}")
        return None

if __name__ == "__main__":
    try:
        print("Email Draft Creator - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Create custom draft (interactive)\n2. Create test draft (predefined)\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            result = create_predefined_draft()
        else:
            result = create_email_draft()

        if result is None:
            print("\n❌ Failed to create email draft")
            exit(1)
        else:
            print("\n🎉 Draft creation completed successfully!")

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)