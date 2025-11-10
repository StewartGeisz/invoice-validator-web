#!/usr/bin/env python3
"""
Email Attachment Management Script
Download and add email attachments using AmplifyAPI Microsoft integrations
"""

import requests
import json
import os
import base64
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()


def get_message_attachments(message_id):
    """
    Get list of attachments for a specific message
    
    Args:
        message_id (str): The ID of the email message
    
    Returns:
        list: List of attachments or None if error
    """
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("❌ Error: AMPLIFY_API_KEY not found in environment variables")
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/get_attachments"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "data": {
            "message_id": message_id
        }
    }
    
    try:
        print(f"📎 Getting attachments for message: {message_id}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            attachments = data.get("data", [])
            
            if not attachments:
                print("📭 No attachments found for this message")
                return []
            
            print(f"📎 Found {len(attachments)} attachment(s):")
            for i, attachment in enumerate(attachments, 1):
                name = attachment.get("name", "Unknown")
                size = attachment.get("size", 0)
                content_type = attachment.get("contentType", "Unknown")
                print(f"   {i}. {name} ({size} bytes, {content_type})")
            
            return attachments
            
        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 404:
            print("❌ Error: Message not found")
            return None
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error getting attachments: {e}")
        return None


def download_attachment(message_id, attachment_id, filename=None, download_dir="./downloads"):
    """
    Download a specific attachment from an email
    
    Args:
        message_id (str): The ID of the email message
        attachment_id (str): The ID of the attachment
        filename (str): Optional custom filename
        download_dir (str): Directory to save the file (default: ./downloads)
    
    Returns:
        str: Path to downloaded file or None if error
    """
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("❌ Error: AMPLIFY_API_KEY not found in environment variables")
        return None

    # Use the correct download_attachment endpoint
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/download_attachment"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "data": {
            "message_id": message_id,
            "attachment_id": attachment_id
        }
    }
    
    try:
        print(f"⬇️  Downloading attachment: {attachment_id}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            attachment_data = data.get("data", {})
            
            # Get attachment content and metadata
            content_bytes = attachment_data.get("contentBytes")
            attachment_name = attachment_data.get("name", f"attachment_{attachment_id}")
            
            if not content_bytes:
                print("❌ Error: No content available for this attachment")
                return None
            
            # Determine filename
            if not filename:
                filename = attachment_name
            
            # Save the attachment
            return save_attachment_content(content_bytes, filename, download_dir)
            
        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 404:
            print("❌ Error: Attachment or message not found")
            return None
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error downloading attachment: {e}")
        return None


def save_attachment_content(content_bytes, filename, download_dir):
    """
    Save base64 encoded content to file
    """
    try:
        # Create download directory if it doesn't exist
        os.makedirs(download_dir, exist_ok=True)
        
        # Full file path
        file_path = os.path.join(download_dir, filename)
        
        # Decode base64 content and save file
        file_content = base64.b64decode(content_bytes)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        file_size = len(file_content)
        print(f"✅ Successfully downloaded: {file_path} ({file_size} bytes)")
        return file_path
        
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return None


def add_attachment_to_message(message_id, file_path, is_inline=False):
    """
    Add an attachment to an existing email message (draft)
    
    Args:
        message_id (str): The ID of the email message (must be a draft)
        file_path (str): Path to the file to attach
        is_inline (bool): Whether the attachment is inline (default: False)
    
    Returns:
        bool: True if successful, False otherwise
    """
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("❌ Error: AMPLIFY_API_KEY not found in environment variables")
        return False

    # Check if file exists
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        return False

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/add_attachment"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    try:
        # Read file content
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        # Encode file content to base64
        content_bytes = base64.b64encode(file_content).decode('utf-8')
        
        # Get file info
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        # Determine content type based on file extension
        content_type_map = {
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.zip': 'application/zip'
        }
        
        file_ext = os.path.splitext(filename)[1].lower()
        content_type = content_type_map.get(file_ext, 'application/octet-stream')
        
        payload = {
            "data": {
                "message_id": message_id,
                "name": filename,
                "content_type": content_type,
                "content_bytes": content_bytes,
                "is_inline": is_inline
            }
        }
        
        print(f"📎 Adding attachment: {filename} ({file_size} bytes)")
        
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        
        if response.status_code == 200:
            print(f"✅ Successfully added attachment: {filename}")
            return True
        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return False
        elif response.status_code == 404:
            print("❌ Error: Message not found or not a draft")
            return False
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error adding attachment: {e}")
        return False


def list_recent_messages_with_attachments(limit=10):
    """
    List recent messages that have attachments
    
    Args:
        limit (int): Number of messages to retrieve (default: 10)
    
    Returns:
        list: List of messages with attachments
    """
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("❌ Error: AMPLIFY_API_KEY not found in environment variables")
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/list_messages"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "data": {
            "folder_id": "Inbox",
            "top": limit,
            "skip": 0,
            "filter_query": "hasAttachments eq true"
        }
    }
    
    try:
        print(f"📧 Looking for recent messages with attachments...")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get("data", [])
            
            if not messages:
                print("📭 No messages with attachments found")
                return []
            
            print(f"\n📧 Found {len(messages)} message(s) with attachments:")
            print("=" * 80)
            
            for i, message in enumerate(messages, 1):
                subject = message.get("subject", "No Subject")
                message_id = message.get("id", "No ID")
                sender_info = message.get("from", {})
                
                # Handle different sender formats
                if isinstance(sender_info, dict):
                    email_address = sender_info.get("emailAddress", {})
                    if isinstance(email_address, dict):
                        sender = email_address.get("name", "Unknown")
                    else:
                        sender = str(sender_info)
                else:
                    sender = str(sender_info) if sender_info else "Unknown"
                
                received_time = message.get("receivedDateTime", "Unknown")
                
                print(f"\n📬 Message #{i}")
                print(f"   ID: {message_id}")
                print(f"   📝 Subject: {subject}")
                print(f"   👤 From: {sender}")
                print(f"   📅 Received: {received_time}")
            
            return messages
            
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error listing messages: {e}")
        return None


def interactive_attachment_manager():
    """Interactive attachment management interface"""
    
    print("📎 Email Attachment Manager")
    print("=" * 40)
    print("Choose an option:")
    print("1. List recent messages with attachments")
    print("2. View attachments for a specific message")
    print("3. Download attachment from message")
    print("4. Add attachment to draft message")
    print("5. Bulk download all attachments from message")
    
    try:
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == "1":
            limit = input("Number of messages to check (default 10): ").strip()
            limit = int(limit) if limit.isdigit() else 10
            list_recent_messages_with_attachments(limit)
            
        elif choice == "2":
            message_id = input("Enter message ID: ").strip()
            if message_id:
                get_message_attachments(message_id)
            else:
                print("❌ No message ID provided")
                
        elif choice == "3":
            message_id = input("Enter message ID: ").strip()
            attachment_id = input("Enter attachment ID: ").strip()
            filename = input("Custom filename (optional): ").strip() or None
            download_dir = input("Download directory (default: ./downloads): ").strip() or "./downloads"
            
            if message_id and attachment_id:
                download_attachment(message_id, attachment_id, filename, download_dir)
            else:
                print("❌ Message ID and attachment ID are required")
                
        elif choice == "4":
            message_id = input("Enter draft message ID: ").strip()
            file_path = input("Enter file path to attach: ").strip()
            is_inline = input("Is this an inline attachment? (y/n): ").strip().lower() == 'y'
            
            if message_id and file_path:
                add_attachment_to_message(message_id, file_path, is_inline)
            else:
                print("❌ Message ID and file path are required")
                
        elif choice == "5":
            message_id = input("Enter message ID: ").strip()
            download_dir = input("Download directory (default: ./downloads): ").strip() or "./downloads"
            
            if message_id:
                attachments = get_message_attachments(message_id)
                if attachments:
                    print(f"\n⬇️  Downloading {len(attachments)} attachment(s)...")
                    success_count = 0
                    for attachment in attachments:
                        attachment_id = attachment.get("id")
                        filename = attachment.get("name")
                        if attachment_id:
                            result = download_attachment(message_id, attachment_id, filename, download_dir)
                            if result:
                                success_count += 1
                    
                    print(f"\n✅ Successfully downloaded {success_count}/{len(attachments)} attachments")
            else:
                print("❌ Message ID is required")
                
        else:
            print("❌ Invalid choice. Please select 1-5.")
            
    except KeyboardInterrupt:
        print("\n🛑 Operation cancelled by user")
    except Exception as e:
        print(f"❌ Error during operation: {e}")


if __name__ == "__main__":
    print("📎 Email Attachment Management Tool")
    print("==================================")
    
    try:
        interactive_attachment_manager()
            
    except KeyboardInterrupt:
        print("\n🛑 Program interrupted by user")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")