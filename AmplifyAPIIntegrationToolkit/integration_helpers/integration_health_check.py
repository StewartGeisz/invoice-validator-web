#!/usr/bin/env python3

import requests
import json
from dotenv import load_dotenv
import os
import time
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

def check_api_connectivity():
    """
    Quick health check for AmplifyAPI connectivity
    """
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        return {
            "status": "❌ FAILED",
            "error": "AMPLIFY_API_KEY not found in environment variables",
            "response_time": None
        }
    
    # Test with a simple endpoint
    url = "https://prod-api.vanderbilt.ai/microsoft/integrations/list_folders"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    payload = {"data": {}}
    
    try:
        start_time = time.time()
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        if response.status_code == 200:
            return {
                "status": "✅ HEALTHY",
                "response_time": f"{response_time:.0f}ms",
                "error": None
            }
        elif response.status_code == 401:
            return {
                "status": "❌ FAILED",
                "error": "Unauthorized - Invalid API key",
                "response_time": f"{response_time:.0f}ms"
            }
        elif response.status_code == 403:
            return {
                "status": "⚠️  WARNING", 
                "error": "Forbidden - Integration may not be enabled",
                "response_time": f"{response_time:.0f}ms"
            }
        else:
            return {
                "status": "❌ FAILED",
                "error": f"HTTP {response.status_code}",
                "response_time": f"{response_time:.0f}ms"
            }
    
    except requests.exceptions.Timeout:
        return {
            "status": "❌ FAILED",
            "error": "Request timeout (>10s)",
            "response_time": ">10000ms"
        }
    except requests.exceptions.ConnectionError:
        return {
            "status": "❌ FAILED", 
            "error": "Connection failed - Check internet",
            "response_time": None
        }
    except Exception as e:
        return {
            "status": "❌ FAILED",
            "error": f"Unexpected error: {str(e)}",
            "response_time": None
        }

def check_service_endpoints():
    """
    Check connectivity to different service endpoints
    """
    
    API_KEY = os.getenv("AMPLIFY_API_KEY")
    if not API_KEY:
        return {}
    
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    base_url = "https://prod-api.vanderbilt.ai/microsoft/integrations"
    
    endpoints = {
        "Email": {
            "url": f"{base_url}/list_folders",
            "payload": {"data": {}}
        },
        "Calendar": {
            "url": f"{base_url}/list_calendars", 
            "payload": {"data": {"include_shared": True}}
        },
        "OneDrive": {
            "url": f"{base_url}/list_drive_items",
            "payload": {"data": {"folder_id": "root", "page_size": 5}}
        }
    }
    
    results = {}
    
    for service, config in endpoints.items():
        try:
            start_time = time.time()
            response = requests.post(
                config["url"], 
                headers=headers, 
                data=json.dumps(config["payload"]), 
                timeout=8
            )
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                # Try to get data count
                data = response.json().get("data", [])
                if isinstance(data, dict):
                    data = data.get("value", [])
                
                results[service] = {
                    "status": "✅ HEALTHY",
                    "response_time": f"{response_time:.0f}ms",
                    "data_count": len(data) if isinstance(data, list) else "Unknown"
                }
            elif response.status_code == 401:
                results[service] = {
                    "status": "❌ FAILED",
                    "response_time": f"{response_time:.0f}ms", 
                    "error": "Unauthorized"
                }
            elif response.status_code == 403:
                results[service] = {
                    "status": "⚠️  WARNING",
                    "response_time": f"{response_time:.0f}ms",
                    "error": "Forbidden - Check integration settings"
                }
            else:
                results[service] = {
                    "status": "❌ FAILED",
                    "response_time": f"{response_time:.0f}ms",
                    "error": f"HTTP {response.status_code}"
                }
                
        except requests.exceptions.Timeout:
            results[service] = {
                "status": "❌ FAILED",
                "response_time": ">8000ms",
                "error": "Timeout"
            }
        except Exception as e:
            results[service] = {
                "status": "❌ FAILED", 
                "response_time": "N/A",
                "error": str(e)[:50]
            }
    
    return results

def display_health_status():
    """
    Display comprehensive health check results
    """
    
    print("AmplifyAPI Integration Health Check")
    print("=" * 60)
    
    # API Key check
    api_key = os.getenv("AMPLIFY_API_KEY")
    print("🔑 API Key Status:")
    if api_key:
        masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
        print(f"   ✅ Found: {masked_key}")
    else:
        print("   ❌ Not found in environment variables")
        print("\n⚠️  Cannot proceed without API key!")
        return False
    
    # Basic connectivity
    print("\n🌐 API Connectivity:")
    connectivity = check_api_connectivity()
    status_icon = "✅" if "HEALTHY" in connectivity["status"] else "❌" if "FAILED" in connectivity["status"] else "⚠️"
    print(f"   {connectivity['status']}")
    if connectivity["response_time"]:
        print(f"   ⏱️  Response Time: {connectivity['response_time']}")
    if connectivity["error"]:
        print(f"   📝 Details: {connectivity['error']}")
    
    # Service endpoints
    print("\n🔧 Service Endpoints:")
    services = check_service_endpoints()
    
    if not services:
        print("   ❌ Unable to test services")
        return False
    
    all_healthy = True
    
    for service, result in services.items():
        status = result["status"]
        response_time = result.get("response_time", "N/A")
        
        print(f"\n   📊 {service} Service:")
        print(f"      Status: {status}")
        print(f"      Response Time: {response_time}")
        
        if "data_count" in result:
            print(f"      Data Items: {result['data_count']}")
        
        if "error" in result:
            print(f"      Error: {result['error']}")
        
        if "FAILED" in status or "WARNING" in status:
            all_healthy = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 HEALTH CHECK SUMMARY:")
    
    if all_healthy and "HEALTHY" in connectivity["status"]:
        print("   🎉 ALL SYSTEMS HEALTHY - Integration is working correctly!")
    elif "HEALTHY" in connectivity["status"]:
        print("   ⚠️  PARTIAL HEALTH - Some services need attention")
    else:
        print("   ❌ UNHEALTHY - Integration has critical issues")
    
    # Recommendations
    print("\n💡 RECOMMENDATIONS:")
    
    if not all_healthy or "FAILED" in connectivity["status"]:
        print("   1. Verify your Amplify API key is correct")
        print("   2. Ensure Microsoft 365 integration is enabled in Amplify")
        print("   3. Check if you've completed the OAuth authorization flow")
        print("   4. Verify you have appropriate permissions in Microsoft 365")
    
    if any("WARNING" in services[s]["status"] for s in services):
        print("   5. Review integration permissions in Amplify dashboard")
        print("   6. Re-authenticate with Microsoft 365 if needed")
    
    return all_healthy

def quick_health_check():
    """
    Quick health check with minimal output
    """
    
    api_key = os.getenv("AMPLIFY_API_KEY")
    if not api_key:
        print("❌ No API key found")
        return False
    
    connectivity = check_api_connectivity()
    
    if "HEALTHY" in connectivity["status"]:
        print(f"✅ AmplifyAPI is healthy ({connectivity['response_time']})")
        return True
    else:
        print(f"❌ AmplifyAPI issue: {connectivity['error']}")
        return False

def continuous_monitoring(interval_minutes=5):
    """
    Continuous health monitoring
    """
    
    print(f"🔄 Starting continuous monitoring (every {interval_minutes} minutes)")
    print("Press Ctrl+C to stop")
    print("-" * 60)
    
    try:
        while True:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"\n[{timestamp}] Running health check...")
            
            is_healthy = quick_health_check()
            
            if not is_healthy:
                print("⚠️  Issues detected! Run full health check for details.")
            
            print(f"💤 Sleeping for {interval_minutes} minutes...")
            time.sleep(interval_minutes * 60)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Monitoring stopped by user")

def main():
    print("AmplifyAPI Integration Health Monitor")
    print("=" * 60)
    
    choice = input(
        "Choose monitoring mode:\n"
        "1. Full health check (detailed)\n"
        "2. Quick health check (basic)\n"
        "3. Continuous monitoring\n"
        "Enter choice (1-3): "
    ).strip()
    
    if choice == "2":
        print("\n🚀 Running Quick Health Check...")
        quick_health_check()
    elif choice == "3":
        interval = input("Enter monitoring interval in minutes [5]: ").strip()
        try:
            interval = int(interval) if interval else 5
        except ValueError:
            interval = 5
        continuous_monitoring(interval)
    else:
        print("\n🚀 Running Full Health Check...")
        display_health_status()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nHealth check cancelled by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")