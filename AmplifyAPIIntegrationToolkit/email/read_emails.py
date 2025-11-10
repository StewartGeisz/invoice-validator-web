#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os
from datetime import datetime
import re

# Load environment variables from .env file
load_dotenv()

def html_to_text(html_content):
    """
    Convert HTML content to plain text for better readability
    """
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
    text = text.replace('&#39;', "'")
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)  # Replace multiple whitespace with single space
    text = text.strip()
    
    return text

def read_limited_emails():
    """
    Read a limited number of emails from Outlook using AmplifyAPI
    Uses built-in limitations to avoid pulling all emails
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/list_messages"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Data payload with limitations
    payload = {
        "data": {
            "folder_id": "Inbox",  # Only read from Inbox
            "top": 10,             # Limit to 10 emails max
            "skip": 0,             # Start from most recent
            "filter_query": "receivedDateTime ge " + datetime.now().strftime("%Y-%m-%dT00:00:00.000Z")  # Only today's emails
        }
    }

    try:
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=30
        )

        # Check for a successful response
        if response.status_code == 200:
            try:
                # Parse the JSON response
                response_data = response.json()
                messages = response_data.get("data", [])

                if messages:
                    print(f"Found {len(messages)} recent email(s):")
                    print("-" * 60)
                    
                    for i, msg in enumerate(messages, 1):
                        print(f"\n{i}. Subject: {msg.get('subject', 'No Subject')}")
                        
                        # Handle "from" field safely - it might be string or nested dict
                        from_field = msg.get('from', {})
                        if isinstance(from_field, dict):
                            email_addr = from_field.get('emailAddress', {})
                            if isinstance(email_addr, dict):
                                from_address = email_addr.get('address', 'Unknown')
                            else:
                                from_address = str(email_addr) if email_addr else 'Unknown'
                        else:
                            from_address = str(from_field) if from_field else 'Unknown'
                        print(f"   From: {from_address}")
                        
                        print(f"   Received: {msg.get('receivedDateTime', 'Unknown')}")
                        print(f"   Has Attachments: {'Yes' if msg.get('hasAttachments') else 'No'}")
                        
                        # Show email preview if available
                        preview = msg.get('bodyPreview', '')
                        if preview:
                            print(f"   Preview: {preview[:150]}...")
                        
                        # Get full message details for each message (limited to first 3 for performance)
                        if i <= 3:
                            get_message_details(msg.get('id'), API_KEY)
                    
                    return messages
                else:
                    print("No messages found in the specified criteria")
                    return []

            except json.JSONDecodeError as e:
                print(f"Error: Failed to parse JSON response: {e}")
                print(f"Response content: {response.text[:200]}...")
                return None

        elif response.status_code == 401:
            print("Error: Unauthorized - Check your API key")
            return None
        elif response.status_code == 403:
            print("Error: Forbidden - API key may be invalid or expired")
            return None
        elif response.status_code == 429:
            print("Error: Rate limit exceeded - Please wait before making another request")
            return None
        elif response.status_code >= 500:
            print(f"Error: Server error (HTTP {response.status_code}) - Please try again later")
            return None
        else:
            print(f"Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.Timeout:
        print("Error: Request timed out - Please check your internet connection and try again")
        return None
    except requests.exceptions.ConnectionError:
        print("Error: Connection failed - Please check your internet connection")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error: Request failed - {e}")
        return None
    except Exception as e:
        print(f"Error: Unexpected error occurred - {e}")
        return None

def get_message_details(message_id, api_key):
    """
    Get detailed content of a specific message including full body
    """
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/get_message_details"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    
    payload = {
        "data": {
            "message_id": message_id,
            "include_body": True
        }
    }
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            details = response.json().get("data", {})
            
            # Show email body content
            body = details.get('body', {})
            if isinstance(body, dict):
                content_type = body.get('contentType', 'text')
                raw_content = body.get('content', 'No content available')
                
                print(f"   Content Type: {content_type}")
                print(f"   --- EMAIL CONTENT (Plain Text) ---")
                
                # Convert HTML to plain text for better readability
                if content_type.lower() == 'html':
                    plain_content = html_to_text(raw_content)
                else:
                    plain_content = raw_content
                
                # Limit content display to avoid overwhelming output
                if len(plain_content) > 800:
                    print(f"   {plain_content[:800]}...")
                    print(f"   [Content truncated - showing first 800 characters]")
                else:
                    print(f"   {plain_content}")
            else:
                # Handle case where body is a string
                raw_content = str(body) if body else 'No content available'
                print(f"   --- EMAIL CONTENT (Plain Text) ---")
                
                # Try to convert HTML to text even if it's a string
                plain_content = html_to_text(raw_content)
                
                if len(plain_content) > 800:
                    print(f"   {plain_content[:800]}...")
                    print(f"   [Content truncated - showing first 800 characters]")
                else:
                    print(f"   {plain_content}")
            
            print(f"   --- END CONTENT ---")
            
            # Show additional details
            importance = details.get('importance', 'normal')
            if importance != 'normal':
                print(f"   Importance: {importance}")
            
            # Show categories if any
            categories = details.get('categories', [])
            if categories:
                print(f"   Categories: {', '.join(categories)}")
                
            return details
        else:
            print(f"   Could not fetch message details (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"   Error fetching message details: {e}")
        return None

if __name__ == "__main__":
    try:
        print("Reading limited emails from Outlook...")
        print("=" * 60)
        
        result = read_limited_emails()

        if result is None:
            print("Failed to get response from the API")
            exit(1)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"Unexpected error in main execution: {e}")
        exit(1)