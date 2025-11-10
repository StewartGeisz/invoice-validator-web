import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()


def make_llm_request(messages):
    # Validate input
    if not messages:
        print("Error: Messages list cannot be empty")
        return None

    if not isinstance(messages, list):
        print("Error: Messages must be a list")
        return None

    # URL for the Amplify API
    url = "https://prod-api.vanderbilt.ai/chat"

    # Check for API key
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
        print("Please set your API key in a .env file or environment variable")
        return None

    # Headers
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    # Data payload
    payload = {
        "data": {
            "temperature": 0.5,
            "max_tokens": 4096,
            "dataSources": [],
            "messages": messages,
            "options": {
                "ragOnly": False,
                "skipRag": True,
                "model": {"id": "gpt-4.1-mini"},
                "prompt": messages[0]["content"] if messages else "",
            },
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
                txt = response_data.get("data", "")

                if txt:
                    print(txt)
                    return txt
                else:
                    print("Warning: Empty response received from API")
                    return None

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
            print(
                "Error: Rate limit exceeded - Please wait before making another request"
            )
            return None
        elif response.status_code >= 500:
            print(
                f"Error: Server error (HTTP {response.status_code}) - Please try again later"
            )
            return None
        else:
            print(f"Error: Request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.Timeout:
        print(
            "Error: Request timed out - Please check your internet connection and try again"
        )
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


if __name__ == "__main__":
    try:
        msg = [
            {
                "role": "user",
                "content": "Please provide 1 sentence brief explanation of quantum mechanics and its applications.",  # INSERT YOUR PROMPT HERE
            }
        ]
        result = make_llm_request(msg)

        if result is None:
            print("Failed to get response from the API")
            exit(1)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        exit(0)
    except Exception as e:
        print(f"Unexpected error in main execution: {e}")
        exit(1)
