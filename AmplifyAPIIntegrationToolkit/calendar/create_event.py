#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

def create_calendar_event():
    """
    Create a calendar event using AmplifyAPI
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/create_event"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Get event details from user
    print("Creating a calendar event...")
    print("=" * 50)
    
    title = input("Enter event title: ").strip()
    if not title:
        title = "AmplifyAPI Test Event"
    
    description = input("Enter event description (optional): ").strip()
    if not description:
        description = "Event created via AmplifyAPI integration test"
    
    location = input("Enter event location (optional): ").strip()
    if not location:
        location = "Virtual Meeting"
    
    # Get date and time
    print("\nEvent Scheduling:")
    print("Format: YYYY-MM-DD HH:MM (24-hour format)")
    
    # Default to tomorrow at 2 PM
    default_start = (datetime.now() + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
    default_end = default_start + timedelta(hours=1)
    
    start_input = input(f"Enter start date/time [{default_start.strftime('%Y-%m-%d %H:%M')}]: ").strip()
    if not start_input:
        start_time = default_start
    else:
        try:
            start_time = datetime.strptime(start_input, "%Y-%m-%d %H:%M")
        except ValueError:
            print("❌ Invalid date format. Using default.")
            start_time = default_start
    
    end_input = input(f"Enter end date/time [{default_end.strftime('%Y-%m-%d %H:%M')}]: ").strip()
    if not end_input:
        end_time = default_end
    else:
        try:
            end_time = datetime.strptime(end_input, "%Y-%m-%d %H:%M")
        except ValueError:
            print("❌ Invalid date format. Using default (1 hour after start).")
            end_time = start_time + timedelta(hours=1)
    
    # Ensure end time is after start time
    if end_time <= start_time:
        print("❌ End time must be after start time. Adding 1 hour to start time.")
        end_time = start_time + timedelta(hours=1)
    
    # Get attendees
    attendees_input = input("\nEnter attendee emails (comma-separated, optional): ").strip()
    attendees = []
    if attendees_input:
        emails = [email.strip() for email in attendees_input.split(",") if email.strip()]
        for email in emails:
            attendees.append({
                "email": email,
                "type": "required"
            })
    
    # Additional options
    is_online = input("Make this an online meeting? (y/n) [n]: ").strip().lower() == 'y'
    
    reminder_input = input("Reminder before start (minutes) [15]: ").strip()
    try:
        reminder_minutes = int(reminder_input) if reminder_input else 15
    except ValueError:
        reminder_minutes = 15
    
    time_zone = "Central Standard Time"  # You can make this configurable if needed

    # Convert to ISO format
    start_iso = start_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso = end_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    # Data payload for event creation
    payload = {
        "data": {
            "title": title,
            "start_time": start_iso,
            "end_time": end_iso,
            "description": description,
            "location": location,
            "attendees": attendees,
            "is_online_meeting": is_online,
            "reminder_minutes_before_start": reminder_minutes,
            "send_invitations": "auto",
            "time_zone": time_zone
        }
    }

    try:
        # Show event summary
        print(f"\nCreating calendar event...")
        print(f"Title: {title}")
        print(f"Start: {start_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"End: {end_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"Location: {location}")
        if attendees:
            print(f"Attendees: {', '.join([att['email'] for att in attendees])}")
        print(f"Online Meeting: {'Yes' if is_online else 'No'}")
        print(f"Reminder: {reminder_minutes} minutes before")
        print("-" * 50)
        
        # Confirm before creating
        confirm = input("Create this event? (yes/y to confirm): ").strip().lower()
        if confirm not in ["yes", "y"]:
            print("❌ Event creation cancelled by user")
            return None
        
        # Make the POST request with timeout
        response = requests.post(
            url, headers=headers, data=json.dumps(payload), timeout=30
        )

        # Check for a successful response
        if response.status_code == 200:
            try:
                # Parse the JSON response
                response_data = response.json()
                event_data = response_data.get("data", {})

                print("✅ Calendar event created successfully!")
                
                if isinstance(event_data, dict):
                    event_id = event_data.get('id', 'Unknown')
                    created_time = event_data.get('createdDateTime', 'Unknown')
                    
                    print(f"Event ID: {event_id}")
                    print(f"Created: {created_time}")
                    
                    # Show web link if available
                    web_link = event_data.get('webLink', '')
                    if web_link:
                        print(f"Web Link: {web_link}")
                    
                    # Show online meeting info if created
                    if is_online:
                        online_meeting = event_data.get('onlineMeeting', {})
                        if isinstance(online_meeting, dict):
                            join_url = online_meeting.get('joinUrl', '')
                            if join_url:
                                print(f"📹 Meeting Join URL: {join_url}")
                
                return event_data

            except json.JSONDecodeError as e:
                print(f"✅ Event likely created successfully (response parsing issue)")
                print(f"Server response: {response.text[:200]}...")
                return {"status": "created"}

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

def create_test_event():
    """
    Create a quick test event with predefined content
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        return None

    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/create_event"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Create test event for tomorrow
    start_time = (datetime.now() + timedelta(days=1)).replace(hour=15, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(hours=1)

    # Predefined test event content
    payload = {
        "data": {
            "title": "AmplifyAPI Integration Test - Calendar Event",
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "end_time": end_time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "description": "This is a test calendar event created through the AmplifyAPI integration.\n\nFeatures tested:\n- Event creation\n- Date/time scheduling\n- Description and location\n- API connectivity",
            "location": "Virtual Meeting - AmplifyAPI Test",
            "attendees": [],
            "is_online_meeting": True,
            "reminder_minutes_before_start": 15,
            "send_invitations": "auto",
            "time_zone": "Central Standard Time"
        }
    }

    try:
        print("Creating predefined test event...")
        print(f"Event: AmplifyAPI Integration Test")
        print(f"Time: {start_time.strftime('%Y-%m-%d %H:%M')} - {end_time.strftime('%H:%M')}")
        
        confirm = input("Create test event? (yes/y to confirm): ").strip().lower()
        if confirm not in ["yes", "y"]:
            print("❌ Test event creation cancelled")
            return None
        
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            print("✅ Test event created successfully!")
            event_data = response.json().get("data", {})
            if isinstance(event_data, dict):
                event_id = event_data.get('id', 'Unknown')
                print(f"Event ID: {event_id}")
            return event_data
        else:
            print(f"❌ Failed to create test event (HTTP {response.status_code})")
            print(f"Response: {response.text[:200]}...")
            return None
            
    except Exception as e:
        print(f"❌ Error creating test event: {e}")
        return None

if __name__ == "__main__":
    try:
        print("Calendar Event Creator - AmplifyAPI Integration")
        print("=" * 60)
        
        choice = input("Choose option:\n1. Create custom event (interactive)\n2. Create test event (predefined)\nEnter choice (1 or 2): ").strip()
        
        if choice == "2":
            result = create_test_event()
        else:
            result = create_calendar_event()

        if result is None:
            print("\n❌ Failed to create calendar event")
            exit(1)
        else:
            print("\n🎉 Event creation completed successfully!")
            print("📅 Check your calendar to see the new event!")

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error in main execution: {e}")
        exit(1)