#!/usr/bin/env python3
"""
Advanced Email Search Script
Searches emails with filters using AmplifyAPI Microsoft integrations
"""

import requests
import json
import os
from dotenv import load_dotenv
import re
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()


def html_to_text(html_content):
    """Convert HTML content to plain text"""
    if not html_content:
        return "No content available"
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html_content)
    
    # Decode common HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text


def search_emails(search_query="", top=20):
    """
    Search emails with advanced filters
    
    Args:
        search_query (str): Search terms (can include keywords, sender, subject, etc.)
        top (int): Maximum number of emails to return (default: 20, max recommended: 50)
    
    Returns:
        dict: API response with search results
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("❌ Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # API endpoint for searching messages
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/search_messages"
    
    # Headers
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # Request payload
    payload = {
        "data": {
            "search_query": search_query,
            "top": min(top, 50)  # Limit to prevent overwhelming results
        }
    }
    
    try:
        print(f"🔍 Searching emails with query: '{search_query}'...")
        print(f"📊 Requesting up to {top} results...")
        
        # Make the API request
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            try:
                data = response.json()
                messages = data.get("data", [])
                
                if not messages:
                    print("📭 No emails found matching your search criteria")
                    return data
                
                print(f"\n📧 Found {len(messages)} email(s):")
                print("=" * 80)
                
                for i, message in enumerate(messages, 1):
                    # Extract message details safely
                    subject = message.get("subject", "No Subject")
                    sender_info = message.get("from", {})
                    
                    # Handle different sender format structures
                    if isinstance(sender_info, dict):
                        email_address = sender_info.get("emailAddress", {})
                        if isinstance(email_address, dict):
                            sender = f"{email_address.get('name', 'Unknown')} <{email_address.get('address', 'unknown@unknown.com')}>"
                        else:
                            sender = str(sender_info)
                    else:
                        sender = str(sender_info) if sender_info else "Unknown Sender"
                    
                    received_time = message.get("receivedDateTime", "Unknown")
                    has_attachments = message.get("hasAttachments", False)
                    importance = message.get("importance", "normal")
                    
                    # Get message body preview
                    body = message.get("body", {})
                    if isinstance(body, dict):
                        content = body.get("content", "No content")
                        content_type = body.get("contentType", "text")
                        
                        # Convert HTML to plain text if needed
                        if content_type == "html":
                            content = html_to_text(content)
                    else:
                        content = str(body) if body else "No content"
                    
                    # Truncate content for preview
                    content_preview = content[:200] + "..." if len(content) > 200 else content
                    
                    print(f"\n📬 Email #{i}")
                    print(f"   📝 Subject: {subject}")
                    print(f"   👤 From: {sender}")
                    print(f"   📅 Received: {received_time}")
                    print(f"   📎 Attachments: {'Yes' if has_attachments else 'No'}")
                    print(f"   ⚠️  Importance: {importance}")
                    print(f"   💬 Preview: {content_preview}")
                
                return data
                
            except json.JSONDecodeError as e:
                print(f"❌ Error parsing response: {e}")
                return None
                
        elif response.status_code == 401:
            print("❌ Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("❌ Error: Forbidden - Insufficient permissions")
            return None
        elif response.status_code == 429:
            print("❌ Error: Rate limit exceeded - Please wait before trying again")
            return None
        else:
            print(f"❌ Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out - Please try again")
        return None
    except requests.exceptions.ConnectionError:
        print("❌ Error: Connection failed - Check your internet connection")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def interactive_search():
    """Interactive email search with predefined options and custom search"""
    
    print("🔍 Advanced Email Search")
    print("=" * 40)
    print("Choose a search option:")
    print("1. Search by keyword")
    print("2. Search by sender")
    print("3. Search by subject")
    print("4. Search recent emails (today)")
    print("5. Search important emails")
    print("6. Search emails with attachments")
    print("7. Custom search query")
    print("8. Show all recent emails")
    
    try:
        choice = input("\nEnter your choice (1-8): ").strip()
        
        if choice == "1":
            keyword = input("Enter keyword to search for: ").strip()
            if keyword:
                search_emails(search_query=keyword)
            else:
                print("❌ No keyword provided")
                
        elif choice == "2":
            sender = input("Enter sender name or email: ").strip()
            if sender:
                search_emails(search_query=f"from:{sender}")
            else:
                print("❌ No sender provided")
                
        elif choice == "3":
            subject = input("Enter subject keywords: ").strip()
            if subject:
                search_emails(search_query=f"subject:{subject}")
            else:
                print("❌ No subject provided")
                
        elif choice == "4":
            today = datetime.now().strftime("%Y-%m-%d")
            search_emails(search_query=f"received>={today}")
            
        elif choice == "5":
            search_emails(search_query="importance:high")
            
        elif choice == "6":
            search_emails(search_query="hasAttachments:true")
            
        elif choice == "7":
            custom_query = input("Enter custom search query: ").strip()
            if custom_query:
                search_emails(search_query=custom_query)
            else:
                print("❌ No query provided")
                
        elif choice == "8":
            search_emails(search_query="", top=10)
            
        else:
            print("❌ Invalid choice. Please select 1-8.")
            
    except KeyboardInterrupt:
        print("\n🛑 Search cancelled by user")
    except Exception as e:
        print(f"❌ Error during interactive search: {e}")


if __name__ == "__main__":
    print("📧 Email Search Tool")
    print("==================")
    
    try:
        # Check if running in interactive mode
        import sys
        if len(sys.argv) > 1:
            # Command line arguments provided
            search_query = " ".join(sys.argv[1:])
            print(f"Searching for: '{search_query}'")
            search_emails(search_query=search_query)
        else:
            # Interactive mode
            interactive_search()
            
    except KeyboardInterrupt:
        print("\n🛑 Program interrupted by user")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")