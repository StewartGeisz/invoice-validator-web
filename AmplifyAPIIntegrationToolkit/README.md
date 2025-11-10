# AmplifyAPI Microsoft 365 Integration Scripts

A comprehensive collection of Python scripts for testing and implementing Microsoft 365 integrations through the Amplify API. These scripts provide read and write capabilities for Email, Calendar, and OneDrive services.

## 🚨 Important Prerequisites

### 1. Amplify API Key Required
All scripts require a valid **Amplify API key** set as an environment variable:
```bash
export AMPLIFY_API_KEY="your-api-key-here"
```

Or create a `.env` file in the script directory:
```
AMPLIFY_API_KEY=your-api-key-here
```

### 2. Integration Setup Required
**Before using these scripts**, the user who created the Amplify API key must **Enable Microsoft 365 Integrations** in Amplify at www.vanderbilt.ai

⚠️ **This setup process must currently be done manually through Amplify.**

### 3. Personal Data Access Only
**Important Limitation**: The AmplifyAPI key will only provide access to the **personal Microsoft 365 data** of the user who created the key. It cannot access other users' data.

## 👥 Usage Recommendations

### For Students/Developers
- Use your own AmplifyAPI key for testing
- Use these scripts to learn the integration patterns
- Test with your own email, calendar, and OneDrive data

### For Production Testing
- Have your **staff sponsor** create the AmplifyAPI key
- The sponsor must enable integrations in their Amplify account  
- The sponsor's Microsoft 365 data will be accessible through the integration
- Implement these patterns in your production systems

## 📁 Script Organization

### 📧 Email Operations (`/email/`)

#### `read_emails.py`
- **Purpose**: Read recent emails with content preview
- **Features**: 
  - Limits to 10 recent emails from today
  - Shows plain text content (HTML converted)
  - Displays sender, subject, attachments
  - Gets full content for first 3 emails
- **Usage**: `python3 email/read_emails.py`

#### `draft_email.py` 
- **Purpose**: Create email drafts
- **Features**:
  - Interactive mode: Custom subject, body, recipients
  - Test mode: Predefined draft creation
  - Supports CC recipients and importance levels
  - Safe draft creation without sending
- **Usage**: `python3 email/draft_email.py`

#### `send_email.py`
- **Purpose**: Send emails directly
- **Features**:
  - Interactive composition with confirmation step
  - Test mode: Send predefined test email
  - Supports TO, CC, BCC recipients
  - HTML formatting and importance levels
  - **Safety**: Requires explicit confirmation before sending
- **Usage**: `python3 email/send_email.py`

#### `search_emails.py`
- **Purpose**: Advanced email search with filters
- **Features**:
  - Interactive search with predefined options
  - Search by keyword, sender, subject, date, importance
  - Search for emails with attachments
  - Command-line support: `python3 email/search_emails.py "search terms"`
  - HTML to plain text conversion for previews
  - Limits results to prevent overwhelming output (max 50)
- **Usage**: `python3 email/search_emails.py` (interactive) or `python3 email/search_emails.py "search query"`

#### `manage_attachments.py`
- **Purpose**: Download and add email attachments
- **Features**:
  - List recent messages with attachments
  - View all attachments for a specific message
  - Download individual attachments or bulk download all
  - Add attachments to draft messages
  - Automatic content type detection
  - Custom download directories and filenames
  - Base64 encoding/decoding for file transfers
- **Usage**: `python3 email/manage_attachments.py`

### 📅 Calendar Operations (`/calendar/`)

#### `read_calendar.py`
- **Purpose**: Browse calendar events and calendars
- **Features**:
  - Lists available calendars with owners
  - Shows upcoming events (next 7 days, max 15 events)
  - Displays event details: time, location, attendees
  - Handles both online and in-person meetings
- **Usage**: `python3 calendar/read_calendar.py`

#### `create_event.py`
- **Purpose**: Create calendar events
- **Features**:
  - Interactive mode: Full event scheduling
  - Test mode: Creates sample event for tomorrow
  - Smart date/time parsing with validation
  - Attendee management and online meeting options
  - Reminder settings and time zone handling
- **Usage**: `python3 calendar/create_event.py`

### 📁 OneDrive Operations (`/onedrive/`)

#### `upload_file.py`
- **Purpose**: Upload files to OneDrive
- **Features**:
  - Upload existing local files
  - Create and upload test files
  - Folder destination selection
  - File size validation (4MB demo limit)
  - Base64 encoding for safe transfer
- **Usage**: `python3 onedrive/upload_file.py`

#### `download_file.py`
- **Purpose**: Download files from OneDrive
- **Features**:
  - Download by OneDrive item ID
  - Lists recent files to help find IDs
  - Saves to custom local paths
  - Handles binary file content properly
- **Usage**: `python3 onedrive/download_file.py`

#### `list_drive_files.py`
- **Purpose**: Browse OneDrive contents
- **Features**:
  - Interactive folder navigation
  - Quick root folder listing
  - File type icons and size formatting
  - Shows folders, files, creation dates
  - Breadcrumb navigation path
- **Usage**: `python3 onedrive/list_drive_files.py`

#### `create_folder.py`
- **Purpose**: Create OneDrive folders
- **Features**:
  - Create single folders
  - Create project structures (folder + subfolders)
  - Parent folder selection
  - Name validation and conflict handling
- **Usage**: `python3 onedrive/create_folder.py`

### 🔧 Integration Helpers (`/integration_helpers/`)

#### `test_all_integrations.py`
- **Purpose**: Comprehensive integration testing
- **Features**:
  - Tests Email, Calendar, and OneDrive APIs
  - Quick connectivity test mode
  - Full test suite with detailed results
  - Generates test reports with pass/fail rates
  - Validates API key and integration setup
- **Usage**: `python3 integration_helpers/test_all_integrations.py`

#### `integration_health_check.py`
- **Purpose**: Real-time integration monitoring
- **Features**:
  - Quick health status checks
  - Full health reports with response times
  - Continuous monitoring mode
  - Service-specific endpoint testing
  - Troubleshooting recommendations
- **Usage**: `python3 integration_helpers/integration_health_check.py`

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
pip install requests python-dotenv
```

### 2. Configure Environment
Create a `.env` file with your API key:
```
AMPLIFY_API_KEY=your-amplify-api-key-here
```

### 3. Test Your Setup
```bash
# Quick connectivity test
python3 integration_helpers/integration_health_check.py

# Full integration test
python3 integration_helpers/test_all_integrations.py
```

### 4. Start Using Scripts
```bash
# Read your recent emails
python3 email/read_emails.py

# Browse your calendar
python3 calendar/read_calendar.py

# Explore your OneDrive
python3 onedrive/list_drive_files.py
```

## 🔒 Security & Limitations

### Data Access Scope
- Scripts only access data from the **API key creator's** Microsoft 365 account
- Cannot read other users' emails, calendars, or files
- Respects Microsoft 365 permissions and sharing settings

### Rate Limiting
- All scripts implement reasonable limits to avoid API abuse
- Email: Max 10 recent messages
- Calendar: Max 15 events, 7-day window  
- OneDrive: Configurable page sizes

### Error Handling
- Comprehensive error handling for network issues
- Timeout protection (30-60 seconds)
- Clear error messages with troubleshooting hints
- Graceful handling of missing permissions

## 🚀 Integration Patterns

### API Request Structure
All scripts follow the AmplifyAPI pattern:
```python
url = "https://prod-api.vanderbilt.ai/microsoft/integrations/{endpoint}"
headers = {
    "Content-Type": "application/json", 
    "Authorization": f"Bearer {API_KEY}"
}
payload = {"data": {/* endpoint-specific data */}}
response = requests.post(url, headers=headers, data=json.dumps(payload))
```

### Response Handling
Scripts handle various response formats:
- Direct arrays: `response.json().get("data", [])`
- Microsoft Graph format: `response.json().get("data", {}).get("value", [])`
- Robust type checking for strings vs dictionaries

### Safety Features
- **Confirmation prompts** for destructive operations
- **Test modes** with predefined safe data
- **Input validation** and sanitization
- **Graceful degradation** when services are unavailable

## 🐛 Troubleshooting

### Common Issues

**❌ "API key not found"**
- Solution: Set `AMPLIFY_API_KEY` environment variable or create `.env` file

**❌ "Unauthorized" (HTTP 401)**
- Solution: Check your API key is correct and active

**❌ "Forbidden" (HTTP 403)** 
- Solution: Enable Microsoft 365 integrations in your Amplify account
- Complete OAuth authorization flow

**❌ "No data returned"**
- Solution: Verify you have data in your Microsoft 365 account
- Check if date ranges or filters are too restrictive

### Getting Help
1. Run the health check: `python3 integration_helpers/integration_health_check.py`
2. Run full tests: `python3 integration_helpers/test_all_integrations.py`  
3. Check the Amplify dashboard for integration status
4. Verify Microsoft 365 permissions and data availability

## 📋 Development Notes

### Extending the Scripts
- All scripts follow consistent patterns for easy modification
- Add new endpoints by following existing request/response handling
- Implement similar error handling and user interaction patterns

### Production Considerations
- Increase timeout values for large data operations
- Implement proper logging for production use
- Add retry logic for transient failures
- Consider caching for frequently accessed data
- Implement proper secret management (beyond `.env` files)

---

**Ready to get started?** Run the health check and begin exploring your Microsoft 365 data through AmplifyAPI! 🚀