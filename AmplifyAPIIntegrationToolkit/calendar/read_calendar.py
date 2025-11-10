#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

def read_limited_calendar_events():
    """
    Read a limited number of calendar events using AmplifyAPI
    Uses date range and page size limitations to avoid pulling all calendar data
    """
    
    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/get_events_between_dates"

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Calculate date range - next 7 days only to limit results
    start_date = datetime.now()
    end_date = start_date + timedelta(days=7)

    # Data payload with limitations
    payload = {
        "data": {
            "start_dt": start_date.strftime("%Y-%m-%dT00:00:00.000Z"),
            "end_dt": end_date.strftime("%Y-%m-%dT23:59:59.999Z"),
            "page_size": 15  # Limit to 15 events max
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
                data = response_data.get("data", [])
                # Handle both list and dict responses
                if isinstance(data, list):
                    events = data
                else:
                    events = data.get("value", [])

                if events:
                    print(f"Found {len(events)} upcoming event(s) in the next 7 days:")
                    print("-" * 70)
                    
                    for i, event in enumerate(events, 1):
                        print(f"\n{i}. Subject: {event.get('subject', 'No Subject')}")
                        
                        # Parse start time - handle both string and dict formats
                        start_time = event.get('start', {})
                        if isinstance(start_time, dict):
                            start_dt = start_time.get('dateTime', 'Unknown')
                        else:
                            start_dt = str(start_time) if start_time else 'Unknown'
                        
                        if start_dt != 'Unknown':
                            try:
                                formatted_start = datetime.fromisoformat(start_dt.replace('Z', '+00:00')).strftime("%Y-%m-%d %H:%M")
                                print(f"   Start: {formatted_start}")
                            except:
                                print(f"   Start: {start_dt}")
                        
                        # Parse end time - handle both string and dict formats
                        end_time = event.get('end', {})
                        if isinstance(end_time, dict):
                            end_dt = end_time.get('dateTime', 'Unknown')
                        else:
                            end_dt = str(end_time) if end_time else 'Unknown'
                        
                        if end_dt != 'Unknown':
                            try:
                                formatted_end = datetime.fromisoformat(end_dt.replace('Z', '+00:00')).strftime("%Y-%m-%d %H:%M")
                                print(f"   End: {formatted_end}")
                            except:
                                print(f"   End: {end_dt}")
                        
                        # Location - handle both string and dict formats
                        location = event.get('location', {})
                        if isinstance(location, dict):
                            location_name = location.get('displayName', 'No location')
                        else:
                            location_name = str(location) if location else 'No location'
                        print(f"   Location: {location_name}")
                        
                        # Organizer - handle nested dict structure safely
                        organizer = event.get('organizer', {})
                        if isinstance(organizer, dict):
                            email_addr = organizer.get('emailAddress', {})
                            if isinstance(email_addr, dict):
                                organizer_address = email_addr.get('address', 'Unknown')
                            else:
                                organizer_address = str(email_addr) if email_addr else 'Unknown'
                        else:
                            organizer_address = str(organizer) if organizer else 'Unknown'
                        print(f"   Organizer: {organizer_address}")
                        
                        # Attendees count
                        attendees = event.get('attendees', [])
                        if isinstance(attendees, list):
                            print(f"   Attendees: {len(attendees)}")
                        else:
                            print(f"   Attendees: Unknown")
                        
                        # Show if it's an online meeting
                        is_online = event.get('isOnlineMeeting', False)
                        print(f"   Online Meeting: {'Yes' if is_online else 'No'}")
                        
                        # Optionally get event details for first event
                        if i == 1:
                            get_event_details(event.get('id'), API_KEY)
                    
                    return events
                else:
                    print("No events found in the next 7 days")
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

def get_event_details(event_id, api_key):
    """
    Get detailed information about a specific event
    """
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/get_event_details"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    
    payload = {
        "data": {
            "event_id": event_id
        }
    }
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            details = response.json().get("data", {})
            body_preview = details.get('bodyPreview', 'No description available')
            print(f"   Description: {body_preview[:100]}...")
            return details
        else:
            print(f"   Could not fetch event details (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"   Error fetching event details: {e}")
        return None

def list_all_calendars():
    """
    List available calendars to understand what calendars we have access to
    """
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        return None
        
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/list_calendars"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    
    payload = {
        "data": {
            "include_shared": True
        }
    }
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            response_data = response.json().get("data", [])
            # Handle both list and dict responses
            if isinstance(response_data, list):
                calendars = response_data
            else:
                calendars = response_data.get("value", [])
            
            print("\nAvailable Calendars:")
            print("-" * 30)
            for i, cal in enumerate(calendars, 1):
                print(f"{i}. {cal.get('name', 'Unknown Calendar')}")
                print(f"   ID: {cal.get('id', 'No ID')}")
                # Handle owner field which might be string or dict
                owner = cal.get('owner', 'Unknown')
                if isinstance(owner, dict):
                    owner_address = owner.get('address', 'Unknown')
                else:
                    owner_address = str(owner)
                print(f"   Owner: {owner_address}")
            return calendars
        else:
            print(f"Could not fetch calendars (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"Error fetching calendars: {e}")
        return None

if __name__ == "__main__":
    try:
        print("Reading limited calendar events...")
        print("=" * 70)
        
        # First, show available calendars
        list_all_calendars()
        
        print("\n" + "=" * 70)
        
        # Then read limited events
        result = read_limited_calendar_events()

        if result is None:
            print("Failed to get response from the API")
            exit(1)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"Unexpected error in main execution: {e}")
        exit(1)