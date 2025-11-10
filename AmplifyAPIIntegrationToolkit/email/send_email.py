#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

def send_email():
    """
    Send an email directly using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/send_mail"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get email content from user
    print("Sending an email...")
    print("=" * 50)
    
    subject = input("Enter email subject: ").strip()
    if not subject:
        subject = "AmplifyAPI Test Email"
    
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
        body = "This is a test email sent via AmplifyAPI integration."
    
    # Convert plain text to HTML for better email formatting
    html_body = f"<p>{body.replace(chr(10), '</p><p>')}</p>"
    
    to_recipients = input("\nEnter recipient email(s) (comma-separated): ").strip()
    if not to_recipients:
        print("❌ Error: At least one recipient email is required")
        return None
    
    # Convert comma-separated emails to list
    to_list = [email.strip() for email in to_recipients.split(",") if email.strip()]
    
    cc_recipients = input("Enter CC email(s) (comma-separated, optional): ").strip()
    cc_list = [email.strip() for email in cc_recipients.split(",") if email.strip()] if cc_recipients else []
    
    bcc_recipients = input("Enter BCC email(s) (comma-separated, optional): ").strip()
    bcc_list = [email.strip() for email in bcc_recipients.split(",") if email.strip()] if bcc_recipients else []
    
    importance = input("Enter importance (normal/low/high) [normal]: ").strip().lower()
    if importance not in ["low", "normal", "high"]:
        importance = "normal"

    # Data payload for sending email
    payload = {
        "data": {
            "subject": subject,
            "body": html_body,
            "to_recipients": to_list,
            "cc_recipients": cc_list,
            "bcc_recipients": bcc_list,
            "importance": importance
        }
    }

    # Confirm before sending
    print("\n" + "⚠️  CONFIRMATION" + "⚠️ ")
    print("-" * 50)
    print(f"Subject: {subject}")
    print(f"To: {', '.join(to_list)}")
    if cc_list:
        print(f"CC: {', '.join(cc_list)}")
    if bcc_list:
        print(f"BCC: {', '.join(bcc_list)}")
    print(f"Importance: {importance}")
    print(f"Body preview: {body[:100]}{'...' if len(body) > 100 else ''}")
    print("-" * 50)
    
    confirm = input("Send this email? (yes/y to confirm): ").strip().lower()
    if confirm not in ["yes", "y"]:
        print("❌ Email sending cancelled by user")
        return None

    try:
        print(f"\n📧 Sending email...")
        
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=30
        )

        # Check for a successful response
        if response.status_code == 200:
            try:
                # Parse the JSON response
                response_data = response.json()
                
                print("✅ Email sent successfully!")
                
                # The send_mail API might return different response structures
                if "data" in response_data:
                    email_data = response_data.get("data", {})
                    if isinstance(email_data, dict):
                        sent_time = email_data.get('sentDateTime', 'Unknown')
                        message_id = email_data.get('id', 'Unknown')
                        print(f"Message ID: {message_id}")
                        print(f"Sent at: {sent_time}")
                
                return response_data

            except json.JSONDecodeError as e:
                print(f"✅ Email likely sent successfully (response parsing issue)")
                print(f"Server response: {response.text[:100]}...")
                return {"status": "sent"}

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

def send_test_email():
    """
    Send a quick test email with predefined content
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/send_mail"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get recipient email for test
    recipient = input("Enter recipient email for test: ").strip()
    if not recipient:
        print("❌ Error: Recipient email is required for test")
        return None

    # Predefined test email content
    payload = {
        "data": {
            "subject": "AmplifyAPI Integration Test - Email Sent Successfully",
            "body": "<p>Hello!</p><p>This is a test email sent directly through the AmplifyAPI integration.</p><p><strong>Integration Test Results:</strong></p><ul><li>✅ API Connection: Success</li><li>✅ Authentication: Valid</li><li>✅ Email Delivery: Working</li></ul><p>If you receive this email, the Microsoft 365 integration is functioning correctly!</p><p>Best regards,<br/>AmplifyAPI Test Script</p>",
            "to_recipients": [recipient],
            "cc_recipients": [],
            "bcc_recipients": [],
            "importance": "normal"
        }
    }

    # Confirm before sending
    print(f"\n⚠️  Sending test email to: {recipient}")
    confirm = input("Proceed? (yes/y to confirm): ").strip().lower()
    if confirm not in ["yes", "y"]:
        print("❌ Test email cancelled")
        return None

    try:
        print("📧 Sending test email...")
        
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            print("✅ Test email sent successfully!")
            return {"status": "sent", "recipient": recipient}
        else:
            print(f"❌ Failed to send test email (HTTP {response.status_code})")
            print(f"Response: {response.text[:200]}...")
            return None
            
    except Exception as e:
        print(f"❌ Error sending test email: {e}")
        return None

if __name__ == "__main__":
    try:
        print("Email Sender - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Send custom email (interactive)\n2. Send test email (predefined)\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            result = send_test_email()
        else:
            result = send_email()

        if result is None:
            print("\n❌ Failed to send email")
            exit(1)
        else:
            print("\n🎉 Email sending completed successfully!")

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)