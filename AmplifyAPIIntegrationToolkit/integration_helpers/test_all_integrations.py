#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
import sys

# Load environment variables from .env file
load_dotenv()

class AmplifyIntegrationTester:
    def __init__(self):
        self.API_KEY = os.getenv("AMPLIFY_API_KEY")
        self.base_url = "https://prod-api.vanderbilt.ai/microsoft/integrations"
        self.headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.API_KEY}"}
        self.test_results = {}
    
    def check_api_key(self):
        """Check if API key is available"""
        if not self.API_KEY:
            print("❌ AMPLIFY_API_KEY not found in environment variables")
            return False
        print("✅ API key found")
        return True
    
    def test_email_integration(self):
        """Test email integration capabilities"""
        print("\n📧 Testing Email Integration...")
        print("-" * 40)
        
        tests = []
        
        # Test 1: List messages
        try:
            url = f"{self.base_url}/list_messages"
            payload = {
                "data": {
                    "folder_id": "Inbox",
                    "top": 5,
                    "skip": 0
                }
            }
            
            response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                messages = response.json().get("data", [])
                tests.append({"name": "List Messages", "status": "✅ PASS", "details": f"Found {len(messages)} messages"})
            else:
                tests.append({"name": "List Messages", "status": "❌ FAIL", "details": f"HTTP {response.status_code}"})
        except Exception as e:
            tests.append({"name": "List Messages", "status": "❌ ERROR", "details": str(e)})
        
        # Test 2: List folders
        try:
            url = f"{self.base_url}/list_folders"
            payload = {"data": {}}
            
            response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                folders = response.json().get("data", [])
                tests.append({"name": "List Folders", "status": "✅ PASS", "details": f"Found {len(folders)} folders"})
            else:
                tests.append({"name": "List Folders", "status": "❌ FAIL", "details": f"HTTP {response.status_code}"})
        except Exception as e:
            tests.append({"name": "List Folders", "status": "❌ ERROR", "details": str(e)})
        
        # Display results
        for test in tests:
            print(f"  {test['status']} {test['name']}: {test['details']}")
        
        self.test_results['email'] = tests
        return len([t for t in tests if "PASS" in t['status']]), len(tests)
    
    def test_calendar_integration(self):
        """Test calendar integration capabilities"""
        print("\n📅 Testing Calendar Integration...")
        print("-" * 40)
        
        tests = []
        
        # Test 1: List calendars
        try:
            url = f"{self.base_url}/list_calendars"
            payload = {"data": {"include_shared": True}}
            
            response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                calendars = response.json().get("data", [])
                if isinstance(calendars, dict):
                    calendars = calendars.get("value", [])
                tests.append({"name": "List Calendars", "status": "✅ PASS", "details": f"Found {len(calendars)} calendars"})
            else:
                tests.append({"name": "List Calendars", "status": "❌ FAIL", "details": f"HTTP {response.status_code}"})
        except Exception as e:
            tests.append({"name": "List Calendars", "status": "❌ ERROR", "details": str(e)})
        
        # Test 2: Get events
        try:
            start_date = datetime.now()
            end_date = start_date + timedelta(days=7)
            
            url = f"{self.base_url}/get_events_between_dates"
            payload = {
                "data": {
                    "start_dt": start_date.strftime("%Y-%m-%dT00:00:00.000Z"),
                    "end_dt": end_date.strftime("%Y-%m-%dT23:59:59.999Z"),
                    "page_size": 5
                }
            }
            
            response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                events_data = response.json().get("data", [])
                if isinstance(events_data, dict):
                    events = events_data.get("value", [])
                else:
                    events = events_data
                tests.append({"name": "Get Events", "status": "✅ PASS", "details": f"Found {len(events)} events"})
            else:
                tests.append({"name": "Get Events", "status": "❌ FAIL", "details": f"HTTP {response.status_code}"})
        except Exception as e:
            tests.append({"name": "Get Events", "status": "❌ ERROR", "details": str(e)})
        
        # Display results
        for test in tests:
            print(f"  {test['status']} {test['name']}: {test['details']}")
        
        self.test_results['calendar'] = tests
        return len([t for t in tests if "PASS" in t['status']]), len(tests)
    
    def test_onedrive_integration(self):
        """Test OneDrive integration capabilities"""
        print("\n📁 Testing OneDrive Integration...")
        print("-" * 40)
        
        tests = []
        
        # Test 1: List drive items
        try:
            url = f"{self.base_url}/list_drive_items"
            payload = {
                "data": {
                    "folder_id": "root",
                    "page_size": 10
                }
            }
            
            response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                items = response.json().get("data", [])
                if isinstance(items, dict):
                    items = items.get("value", [])
                tests.append({"name": "List Drive Items", "status": "✅ PASS", "details": f"Found {len(items)} items"})
            else:
                tests.append({"name": "List Drive Items", "status": "❌ FAIL", "details": f"HTTP {response.status_code}"})
        except Exception as e:
            tests.append({"name": "List Drive Items", "status": "❌ ERROR", "details": str(e)})
        
        # Display results
        for test in tests:
            print(f"  {test['status']} {test['name']}: {test['details']}")
        
        self.test_results['onedrive'] = tests
        return len([t for t in tests if "PASS" in t['status']]), len(tests)
    
    def run_all_tests(self):
        """Run all integration tests"""
        print("AmplifyAPI Integration Test Suite")
        print("=" * 60)
        
        if not self.check_api_key():
            return False
        
        # Run individual tests
        email_passed, email_total = self.test_email_integration()
        calendar_passed, calendar_total = self.test_calendar_integration()
        onedrive_passed, onedrive_total = self.test_onedrive_integration()
        
        # Summary
        total_passed = email_passed + calendar_passed + onedrive_passed
        total_tests = email_total + calendar_total + onedrive_total
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("-" * 30)
        print(f"📧 Email Integration:    {email_passed}/{email_total} tests passed")
        print(f"📅 Calendar Integration: {calendar_passed}/{calendar_total} tests passed")
        print(f"📁 OneDrive Integration: {onedrive_passed}/{onedrive_total} tests passed")
        print("-" * 30)
        print(f"🎯 Overall Success Rate: {total_passed}/{total_tests} ({(total_passed/total_tests*100):.1f}%)")
        
        if total_passed == total_tests:
            print("\n🎉 ALL TESTS PASSED! AmplifyAPI integration is working correctly.")
            return True
        elif total_passed > 0:
            print(f"\n⚠️  PARTIAL SUCCESS: {total_passed}/{total_tests} tests passed.")
            print("Some integrations may need attention.")
            return False
        else:
            print("\n❌ ALL TESTS FAILED! Please check your API key and integration settings.")
            return False
    
    def generate_report(self):
        """Generate a detailed test report"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        report = f"""
AmplifyAPI Integration Test Report
Generated: {timestamp}
API Key: {'✅ Valid' if self.API_KEY else '❌ Missing'}

DETAILED RESULTS:
================
"""
        
        for service, tests in self.test_results.items():
            report += f"\n{service.upper()} INTEGRATION:\n"
            report += "-" * 30 + "\n"
            for test in tests:
                report += f"{test['status']} {test['name']}: {test['details']}\n"
        
        # Save report to file
        report_file = "amplify_integration_test_report.txt"
        with open(report_file, 'w') as f:
            f.write(report)
        
        print(f"\n📄 Detailed report saved to: {report_file}")
        return report_file

def main():
    tester = AmplifyIntegrationTester()
    
    print("Choose test mode:")
    print("1. Quick test (basic connectivity)")
    print("2. Full test suite (comprehensive)")
    print("3. Generate report only")
    
    choice = input("Enter choice (1-3): ").strip()
    
    if choice == "3":
        if tester.test_results:
            tester.generate_report()
        else:
            print("No test results available. Run tests first.")
    elif choice == "1":
        print("\n🚀 Running Quick Connectivity Test...")
        success = tester.check_api_key()
        if success:
            # Just test one endpoint from each service
            email_passed, _ = tester.test_email_integration()
            if email_passed > 0:
                print("\n✅ Quick test passed! Basic connectivity is working.")
            else:
                print("\n❌ Quick test failed! Check your configuration.")
    else:
        print("\n🚀 Running Full Integration Test Suite...")
        success = tester.run_all_tests()
        
        # Ask if user wants a report
        if input("\nGenerate detailed report? (y/n): ").lower() == 'y':
            tester.generate_report()
        
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)