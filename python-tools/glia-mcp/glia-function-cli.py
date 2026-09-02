import os
import json
import requests
import argparse
import time
import sys
from pathlib import Path
import getpass

ENVIRONMENTS = {
    "production": {
        "api_url": "https://api.glia.com"
    },
    "beta": {
        "api_url": "https://api.beta.glia.com"
    },
    "production-eu": {
        "api_url": "https://api.glia.eu"
    },
    "beta-eu": {
        "api_url": "https://api.beta.glia.eu"
    }
}

CONFIG_DIR = Path.home() / '.glia'
CONFIG_FILE = CONFIG_DIR / 'config.json'

class ConfigManager:
    def __init__(self):
        self.config = self.load_config()
    
    def load_config(self):
        """Load configuration from file or environment variables"""
        config = {}
        
        # Try to load from config file first
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r') as f:
                    config = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not load config file: {e}")
        
        # Fall back to environment variables if config file doesn't exist or is incomplete
        if not config.get('api_key_id') or not config.get('api_key_secret'):
            env_config = {
                'api_key_id': os.environ.get('api_key_id'),
                'api_key_secret': os.environ.get('api_key_secret'),
                'site_id': os.environ.get('site_id'),
                'environment': os.environ.get('GLIA_ENV', 'production')
            }
            
            # Only use env vars if they exist
            for key, value in env_config.items():
                if value and not config.get(key):
                    config[key] = value
        
        return config
    
    def save_config(self):
        """Save current configuration to file"""
        CONFIG_DIR.mkdir(exist_ok=True)
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(self.config, f, indent=2)
            print(f"Configuration saved to {CONFIG_FILE}")
        except IOError as e:
            print(f"Error saving configuration: {e}")
            return False
        return True
    
    def setup_interactive(self):
        """Interactive setup for first-time users"""
        print("🚀 Welcome to Glia Functions CLI!")
        print("Let's set up your configuration...\n")
        
        # API Key ID
        current_key_id = self.config.get('api_key_id', '')
        prompt = f"API Key ID{f' (current: {current_key_id[:8]}...)' if current_key_id else ''}: "
        api_key_id = input(prompt).strip()
        if api_key_id:
            self.config['api_key_id'] = api_key_id
        elif not current_key_id:
            print("API Key ID is required!")
            return False
        
        # API Key Secret
        current_secret = self.config.get('api_key_secret', '')
        prompt = f"API Key Secret{' (current: *****)' if current_secret else ''}: "
        api_key_secret = getpass.getpass(prompt).strip()
        if api_key_secret:
            self.config['api_key_secret'] = api_key_secret
        elif not current_secret:
            print("API Key Secret is required!")
            return False
        
        # Site ID
        current_site_id = self.config.get('site_id', '')
        prompt = f"Default Site ID{f' (current: {current_site_id})' if current_site_id else ''}: "
        site_id = input(prompt).strip()
        if site_id:
            self.config['site_id'] = site_id
        
        # Environment
        current_env = self.config.get('environment', 'production')
        print(f"\nAvailable environments:")
        print("  • production (US) - https://api.glia.com")
        print("  • beta (US) - https://api.beta.glia.com") 
        print("  • production-eu (EU) - https://api.glia.eu")
        print("  • beta-eu (EU) - https://api.beta.glia.eu")
        prompt = f"Environment (current: {current_env}): "
        environment = input(prompt).strip()
        if environment and environment in ENVIRONMENTS:
            self.config['environment'] = environment
        elif environment and environment not in ENVIRONMENTS:
            print(f"Warning: Unknown environment '{environment}', using '{current_env}'")
        
        return self.save_config()
    
    def get_credentials(self):
        """Get credentials for API calls"""
        if not self.config.get('api_key_id') or not self.config.get('api_key_secret'):
            print("❌ Missing API credentials!")
            print("Run 'python glia-function-cli.py configure' to set up your credentials.")
            return None
        
        return {
            'api_key_id': self.config['api_key_id'],
            'api_key_secret': self.config['api_key_secret'],
            'site_ids': [self.config.get('site_id')] if self.config.get('site_id') else []
        }
    
    def get_environment(self):
        """Get current environment setting"""
        return self.config.get('environment', 'production')
    
    def show_config(self):
        """Display current configuration (without secrets)"""
        print("📋 Current Configuration:")
        print(f"  API Key ID: {self.config.get('api_key_id', 'Not set')[:8]}..." if self.config.get('api_key_id') else "  API Key ID: Not set")
        print(f"  API Key Secret: {'*****' if self.config.get('api_key_secret') else 'Not set'}")
        print(f"  Default Site ID: {self.config.get('site_id', 'Not set')}")
        print(f"  Environment: {self.config.get('environment', 'production')}")
        print(f"  Config file: {CONFIG_FILE}")
        
        # Show current function context
        current_function = self.get_current_function()
        if current_function:
            print(f"\n🎯 Current Working Function:")
            print(f"  Function ID: {current_function['id']}")
            print(f"  Name: {current_function['name']}")
            if current_function.get('description'):
                print(f"  Description: {current_function['description']}")
            if current_function.get('current_version_id'):
                print(f"  Current Version: {current_function['current_version_id']}")
        else:
            print(f"\n🎯 Current Working Function: None (use 'select' command to choose)")
    
    def set_current_function(self, function_data):
        """Set the current working function"""
        self.config['current_function'] = {
            'id': function_data['id'],
            'name': function_data['name'],
            'description': function_data.get('description', ''),
            'current_version_id': function_data.get('current_version_id'),
            'site_id': function_data.get('site_id'),
            'selected_at': time.time()
        }
        return self.save_config()
    
    def get_current_function(self):
        """Get the current working function"""
        return self.config.get('current_function')
    
    def clear_current_function(self):
        """Clear the current working function"""
        if 'current_function' in self.config:
            del self.config['current_function']
            return self.save_config()
        return True

def get_function_id_from_context(args):
    """Get function ID from command line args or current context"""
    if args.function_id:
        return args.function_id
    
    current_function = config_manager.get_current_function()
    if current_function:
        return current_function['id']
    
    return None

def selectFunction(credentials, environment='production'):
    """Interactive function selection"""
    print("🔍 Loading available functions...")
    
    # Get site ID
    site_id = config_manager.config.get('site_id')
    if not site_id:
        print("❌ No default site ID configured. Run 'configure' first.")
        return None
    
    try:
        token = getToken(credentials, environment)
        result = listFunctions([site_id], token, environment)
        functions = result.get('functions', [])
        
        if not functions:
            print("❌ No functions found in this site.")
            return None
        
        print(f"\n📋 Available Functions ({len(functions)} found):")
        print("=" * 60)
        
        for i, func in enumerate(functions, 1):
            status = "🟢 Deployed" if func.get('current_version_id') else "🔴 Not deployed"
            print(f"{i:2d}. {func['name']} ({func['id'][:8]}...)")
            print(f"     Status: {status}")
            if func.get('description'):
                print(f"     Description: {func['description']}")
            if func.get('current_version_id'):
                print(f"     Current Version: {func['current_version_id'][:8]}...")
            print()
        
        while True:
            try:
                choice = input("Select function number (or 'q' to quit): ").strip()
                if choice.lower() == 'q':
                    return None
                
                choice_num = int(choice)
                if 1 <= choice_num <= len(functions):
                    selected_function = functions[choice_num - 1]
                    print(f"\n✅ Selected function: {selected_function['name']}")
                    return selected_function
                else:
                    print(f"❌ Please enter a number between 1 and {len(functions)}")
            except ValueError:
                print("❌ Please enter a valid number or 'q' to quit")
    
    except Exception as e:
        print(f"❌ Failed to load functions: {e}")
        return None

# Initialize config manager
config_manager = ConfigManager()

def getToken(credentials, environment='production', debug=False):
    """Get authentication token with better error handling"""
    if not credentials:
        print("❌ No credentials available. Run 'configure' command first.")
        sys.exit(1)
    
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + "/operator_authentication/tokens"

    payload = {
        "api_key_secret": credentials.get('api_key_secret'),
        "api_key_id": credentials.get('api_key_id'),
        "site_ids": credentials.get('site_ids')
    }
    
    headers = {
        "Accept": "application/vnd.salemove.v1+json",
        "Content-Type": "application/json"
    }
    
    if debug:
        print(f"🔍 Debug - Authentication URL: {url}")
        print(f"🔍 Debug - API Key ID: {credentials.get('api_key_id')[:8]}..." if credentials.get('api_key_id') else "🔍 Debug - API Key ID: None")
        print(f"🔍 Debug - Site IDs: {credentials.get('site_ids')}")
        print(f"🔍 Debug - Environment: {environment}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        
        if debug:
            print(f"🔍 Debug - Response Status: {response.status_code}")
            print(f"🔍 Debug - Response Headers: {dict(response.headers)}")
        
        response.raise_for_status()
        
        result = response.json()
        if "token" not in result:
            print("❌ Authentication failed: Invalid response from server")
            if "error" in result:
                print(f"   Error: {result['error']}")
            if debug:
                print(f"🔍 Debug - Full response: {result}")
            sys.exit(1)
        
        if debug:
            print("✅ Authentication successful!")
            print(f"🔍 Debug - Token length: {len(result['token'])}")
        
        return result["token"]
    except requests.exceptions.RequestException as e:
        print(f"❌ Authentication failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Status Code: {e.response.status_code}")
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)
    except json.JSONDecodeError:
        print("❌ Authentication failed: Invalid response format")
        sys.exit(1)

def debugAuthentication(credentials, environment='production'):
    """Debug authentication process"""
    print("🔍 Debugging Authentication Process...")
    print("=" * 50)
    
    # Check credentials
    print("📋 Credential Check:")
    if not credentials:
        print("❌ No credentials found")
        return
    
    print(f"✅ API Key ID: {credentials.get('api_key_id')[:8]}..." if credentials.get('api_key_id') else "❌ API Key ID: Missing")
    print(f"✅ API Key Secret: {'Present' if credentials.get('api_key_secret') else '❌ Missing'}")
    print(f"✅ Site IDs: {credentials.get('site_ids')}")
    print()
    
    # Test authentication
    print("🔐 Testing Authentication:")
    try:
        token = getToken(credentials, environment, debug=True)
        print(f"✅ Token obtained successfully!")
        print()
        
        # Test a simple API call
        print("🧪 Testing API Call (list functions):")
        try:
            result = listFunctions(credentials.get('site_ids', []), token, environment, debug=True)
            print("✅ API call successful!")
            print(f"   Found {len(result.get('functions', []))} functions")
        except Exception as e:
            print(f"❌ API call failed: {e}")
            
    except SystemExit:
        print("❌ Authentication failed - see details above")

def createFunction(site_id, fnName, fnDescription, token, environment='production'):
    """Create a new function with error handling"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + "/functions/"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }

    payload = {
        "site_id": site_id, 
        "name": fnName, 
        "description": fnDescription
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to create function: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)



def updateFunction(functionId, code, env_variables, token, environment='production'): 
    """Update function with new code and environment variables"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + "/functions/" + functionId + "/versions"

    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    payload = {
        "code": code.read(),
        "environment_variables": env_variables,
        "compatibility_date": "2023-11-21"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to update function: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def getFunctionInfo(functionId, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId

  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }

  response = requests.get(url, headers=headers)
  return response.json()

def getFunctionVersion(functionId, versionId, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId + "/versions/" + versionId

  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }

  response = requests.get(url, headers=headers)
  return response.json()

def getFunctionGetCode(functionId, versionId, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId + "/versions/" + versionId + "/code"

  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }
  
  response = requests.get(url, headers=headers)
  # print(response.text)
  return response.text


def getFunctionTask(functionId, taskId, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId + "/tasks/" + taskId

  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }

  response = requests.get(url, headers=headers)
  return response.json()

def deployFunction(functionId, versionId, token, environment='production'):
    """Deploy a function version"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + "/functions/" + functionId + "/deployments"

    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }

    payload = {
        "version_id": versionId
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to deploy function: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def invokeFunction(endpoint, payload, token):
  url = ENVIRONMENTS.get("production").get("api_url") + endpoint
  headers = {
    "Content-Type": "application/json",
    "authorization": "Bearer " + token
  }

  response = requests.post(url, json=payload, headers=headers)
  return response.json()

def parse_date_to_iso8601(date_str):
    """Convert various date formats to ISO-8601 format"""
    if not date_str:
        return None
    
    # If already in ISO-8601 format, return as is
    if 'T' in date_str and ('Z' in date_str or '+' in date_str or date_str.endswith('00')):
        return date_str
    
    try:
        # Try parsing common date formats
        formats_to_try = [
            '%Y-%m-%d',           # 2024-01-01
            '%Y-%m-%d %H:%M:%S',  # 2024-01-01 12:00:00
            '%Y-%m-%d %H:%M',     # 2024-01-01 12:00
            '%Y/%m/%d',           # 2024/01/01
            '%Y/%m/%d %H:%M:%S',  # 2024/01/01 12:00:00
            '%m/%d/%Y',           # 01/01/2024
            '%m/%d/%Y %H:%M:%S',  # 01/01/2024 12:00:00
        ]
        
        parsed_date = None
        for fmt in formats_to_try:
            try:
                parsed_date = time.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        
        if parsed_date is None:
            raise ValueError(f"Unable to parse date: {date_str}")
        
        # Convert to ISO-8601 format
        # If no time specified, use start of day for 'from' and end of day for 'to'
        dt = time.mktime(parsed_date)
        return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(dt))
        
    except Exception as e:
        print(f"❌ Invalid date format: {date_str}")
        print("💡 Supported formats:")
        print("   • 2024-01-01")
        print("   • 2024-01-01 12:00:00")
        print("   • 2024-01-01T12:00:00Z (ISO-8601)")
        print("   • 2024/01/01")
        print("   • 01/01/2024")
        sys.exit(1)

def getLogs(functionId, token, startDate, endDate, environment='production'):
    """Get function logs with better error handling and pagination support"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + f"/functions/{functionId}/logs"
    
    params = {}
    if startDate:
        # Convert to ISO-8601 format, defaulting to start of day
        iso_start = parse_date_to_iso8601(startDate)
        if iso_start and not ('T' in startDate):
            # If original didn't have time, set to start of day
            iso_start = iso_start.replace('T00:00:00Z', 'T00:00:00Z')
        params['from'] = iso_start
        
    if endDate:
        # Convert to ISO-8601 format, defaulting to end of day
        iso_end = parse_date_to_iso8601(endDate)
        if iso_end and not ('T' in endDate):
            # If original didn't have time, set to end of day
            iso_end = iso_end.replace('T00:00:00Z', 'T23:59:59Z')
        params['to'] = iso_end
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        result = response.json()
        return result.get("logs", []), result.get("next_page")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to get logs: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
                
                # Special handling for date format errors
                if 'from' in str(error_detail) or 'to' in str(error_detail):
                    print("\n💡 Date Format Help:")
                    print("   The API requires ISO-8601 format dates.")
                    print("   Supported input formats:")
                    print("   • 2024-01-01 (converts to 2024-01-01T00:00:00Z)")
                    print("   • 2024-01-01 12:30:00 (converts to 2024-01-01T12:30:00Z)")
                    print("   • 2024-01-01T12:30:00Z (ISO-8601, used as-is)")
                    
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def listFunctions(site_ids, token, environment='production', debug=False):
    """List all functions for given site IDs"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + "/functions"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    # Handle site_ids parameter - API expects site_ids[] format
    params = {}
    if site_ids:
        if isinstance(site_ids, list):
            params['site_ids[]'] = site_ids
        else:
            params['site_ids[]'] = [site_ids]
    
    if debug:
        print(f"🔍 Debug - List Functions URL: {url}")
        print(f"🔍 Debug - Parameters: {params}")
        print(f"🔍 Debug - Headers: {headers}")
    
    try:
        response = requests.get(url, params=params, headers=headers)
        
        if debug:
            print(f"🔍 Debug - Response Status: {response.status_code}")
            print(f"🔍 Debug - Response Headers: {dict(response.headers)}")
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to list functions: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Status Code: {e.response.status_code}")
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
            
            # Special handling for 401 errors
            if e.response.status_code == 401:
                print("\n💡 Troubleshooting 401 Unauthorized:")
                print("   1. Check if your API key has 'functions:read' permission")
                print("   2. Verify your site ID is correct")
                print("   3. Ensure you're using the right environment")
                print("   4. Try running 'debug-auth' command for detailed diagnostics")
        sys.exit(1)

def listFunctionVersions(functionId, token, environment='production', per_page=20, order='desc'):
    """List all versions of a function"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + f"/functions/{functionId}/versions"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    params = {
        "per_page": per_page,
        "order": order,
        "order_by": "created_at"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to list function versions: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def getFunctionStats(token, function_ids=None, environment='production'):
    """Get function invocation statistics"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + "/functions/stats"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    payload = {}
    if function_ids:
        payload["function_ids"] = function_ids
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to get function stats: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def updateFunctionMetadata(functionId, name=None, description=None, token=None, environment='production'):
    """Update function metadata (name/description)"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + f"/functions/{functionId}"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    payload = {}
    if name:
        payload["name"] = name
    if description:
        payload["description"] = description
    
    if not payload:
        print("❌ No updates provided (name or description required)")
        return None
    
    try:
        response = requests.patch(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to update function: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

# KV Store Functions
def kvStoreBulkOperations(namespace, operations, token, environment='production'):
    """Perform bulk operations on KV store"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + f"/api/v2/functions/storage/kv/namespaces/{namespace}"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    payload = {"operations": operations}
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to perform KV store operations: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def kvStoreList(namespace, token, environment='production', max_page_size=100):
    """List all key-value pairs in a namespace"""
    url = ENVIRONMENTS.get(environment, ENVIRONMENTS['production']).get("api_url") + f"/api/v2/functions/storage/kv/namespaces/{namespace}"
    
    headers = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": "Bearer " + token
    }
    
    params = {"maxpagesize": max_page_size}
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to list KV store items: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Server error: {error_detail}")
            except:
                print(f"   Server response: {e.response.text}")
        sys.exit(1)

def printLogs(logs):
    """Print logs in a readable format"""
    for log in logs:
        print(log)

parser = argparse.ArgumentParser(
    description='🚀 Glia Functions CLI - Manage your Glia functions with ease',
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog="""
Examples:
  # Configuration
  python glia-function-cli.py configure                    # Interactive setup
  python glia-function-cli.py show-config                  # Show current config
  python glia-function-cli.py debug-auth                   # Debug authentication issues
  
  # Function Context (NEW!)
  python glia-function-cli.py select                       # Select function to work on
  python glia-function-cli.py current                      # Show current function
  python glia-function-cli.py clear                        # Clear function selection
  
  # Function Management
  python glia-function-cli.py create --name my-function --description "My awesome function"
  python glia-function-cli.py list                         # List all functions
  python glia-function-cli.py get-info                     # Info for current function
  python glia-function-cli.py get-info --function_id abc123  # Info for specific function
  
  # Version Management (works with current function!)
  python glia-function-cli.py update --code function.js --env_file env.json  # Update current function
  python glia-function-cli.py list-versions                # List versions of current function
  python glia-function-cli.py deploy --version_id v1.0.0   # Deploy current function
  
  # Monitoring & Logs
  python glia-function-cli.py get-logs --start_date 2024-01-01 --end_date 2024-01-02  # Current function
  python glia-function-cli.py recent-logs                  # Last hour of logs
  python glia-function-cli.py recent-logs --hours 6        # Last 6 hours
  python glia-function-cli.py recent-logs --minutes 30     # Last 30 minutes
  python glia-function-cli.py get-stats                    # All functions stats
  
  # Function Invocation
  python glia-function-cli.py invoke --endpoint "/integrations/xyz/endpoint" --payload payload.json
  
  # KV Store Operations
  python glia-function-cli.py kv-set --namespace my_app --key user_id --value "12345"
  python glia-function-cli.py kv-get --namespace my_app --key user_id
  python glia-function-cli.py kv-list --namespace my_app
  python glia-function-cli.py kv-bulk --namespace my_app --kv_operations operations.json
  
  # Environment Options
  python glia-function-cli.py list --environment production-eu  # Use EU region
  python glia-function-cli.py create --name test --environment beta  # Use beta environment
"""
)

parser.add_argument('operation', 
                    choices=[
                        'configure', 'show-config', 'debug-auth',
                        'create', 'list', 'select', 'current', 'clear',
                        'update', 'update-metadata', 'task-status', 'deploy', 'invoke', 
                        'get-logs', 'recent-logs', 'get-info', 'get-code', 'get-version', 'list-versions', 'get-stats',
                        'kv-get', 'kv-set', 'kv-delete', 'kv-list', 'kv-bulk'
                    ],
                    help='The operation to execute')

# Configuration arguments
parser.add_argument('--environment', '-e',
                    choices=list(ENVIRONMENTS.keys()),
                    help='Environment to use: production, beta, production-eu, beta-eu (overrides config file)')

# Function management arguments
parser.add_argument('--name',
                    help='Name of the function')
parser.add_argument('--description',
                    help='Description of the function')
parser.add_argument('--site_id',
                    help='Site ID (overrides config file default)')
parser.add_argument('--function_id',
                    help='Function ID')
parser.add_argument('--code',
                    help='JavaScript code file for the function', 
                    type=argparse.FileType('r', encoding='UTF-8'))
parser.add_argument('--endpoint',
                    help='Function endpoint for invocation')
parser.add_argument('--version_id',
                    help='Function version ID')
parser.add_argument('--task_id',
                    help='Task ID for status checking')

# Date arguments for logs
parser.add_argument('--start_date',
                    help='Start date for logs (formats: 2024-01-01, 2024-01-01 12:00:00, 2024-01-01T12:00:00Z)')
parser.add_argument('--end_date',
                    help='End date for logs (formats: 2024-01-01, 2024-01-01 12:00:00, 2024-01-01T12:00:00Z)')
parser.add_argument('--hours',
                    type=int,
                    help='Get logs from last N hours (for recent-logs command)')
parser.add_argument('--minutes',
                    type=int,
                    help='Get logs from last N minutes (for recent-logs command)')

# File arguments
parser.add_argument('--payload',
                    help='JSON payload file for function invocation', 
                    type=argparse.FileType('r', encoding='UTF-8'))
parser.add_argument('--env_file',
                    help='JSON file containing environment variables', 
                    type=argparse.FileType('r', encoding='UTF-8'))

# KV Store arguments
parser.add_argument('--namespace',
                    help='KV Store namespace')
parser.add_argument('--key',
                    help='KV Store key')
parser.add_argument('--value',
                    help='KV Store value')
parser.add_argument('--kv_operations',
                    help='JSON file containing KV Store bulk operations',
                    type=argparse.FileType('r', encoding='UTF-8'))

# List and pagination arguments
parser.add_argument('--per_page',
                    type=int,
                    default=20,
                    help='Number of items per page (default: 20)')
parser.add_argument('--order',
                    choices=['asc', 'desc'],
                    default='desc',
                    help='Sort order (default: desc)')

# Function statistics
parser.add_argument('--function_ids',
                    nargs='+',
                    help='List of function IDs for statistics')

# Legacy support
parser.add_argument('--env',
                    help='Environment variables (deprecated, use --env_file instead)')

# Global options
parser.add_argument('--verbose', '-v',
                    action='store_true',
                    help='Enable verbose output')

def checkTaskStatus(task_url, token):
  url = ENVIRONMENTS.get("production").get("api_url") + task_url
  
  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }
  response = requests.get(url, headers=headers)
  return response.json()

def main():
    args = parser.parse_args()
    
    # Handle configuration commands first
    if args.operation == 'configure':
        if config_manager.setup_interactive():
            print("✅ Configuration completed successfully!")
        else:
            print("❌ Configuration failed!")
            sys.exit(1)
        return
    
    if args.operation == 'show-config':
        config_manager.show_config()
        return
    
    if args.operation == 'debug-auth':
        credentials = config_manager.get_credentials()
        environment = args.environment or config_manager.get_environment()
        debugAuthentication(credentials, environment)
        return
    
    # Function context commands
    if args.operation == 'select':
        credentials = config_manager.get_credentials()
        if not credentials:
            return
        environment = args.environment or config_manager.get_environment()
        
        selected_function = selectFunction(credentials, environment)
        if selected_function:
            if config_manager.set_current_function(selected_function):
                print(f"🎯 Now working on: {selected_function['name']}")
                print("💡 You can now use commands without --function_id:")
                print("   python glia-function-cli.py get-info")
                print("   python glia-function-cli.py list-versions")
                print("   python glia-function-cli.py update --code function.js --env_file env.json")
            else:
                print("❌ Failed to save function selection")
        return
    
    if args.operation == 'current':
        current_function = config_manager.get_current_function()
        if current_function:
            print(f"🎯 Currently working on:")
            print(f"   Function: {current_function['name']} ({current_function['id']})")
            if current_function.get('description'):
                print(f"   Description: {current_function['description']}")
            if current_function.get('current_version_id'):
                print(f"   Current Version: {current_function['current_version_id']}")
            
            # Show when it was selected
            selected_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(current_function.get('selected_at', 0)))
            print(f"   Selected: {selected_time}")
        else:
            print("🎯 No function currently selected")
            print("💡 Use 'select' command to choose a function to work on")
        return
    
    if args.operation == 'clear':
        if config_manager.clear_current_function():
            print("✅ Cleared current function selection")
        else:
            print("❌ Failed to clear function selection")
        return
    
    # Get environment (command line overrides config file)
    environment = args.environment or config_manager.get_environment()
    
    # Get credentials
    credentials = config_manager.get_credentials()
    if not credentials:
        return
    
    # Get site_id (command line overrides config file)
    site_id = args.site_id or config_manager.config.get('site_id')
    
    if args.verbose:
        print(f"🔧 Using environment: {environment}")
        if site_id:
            print(f"🏢 Using site ID: {site_id}")
    
    try:
        match args.operation:
            case 'create':
                if not args.name:
                    print("❌ Function name is required (--name)")
                    sys.exit(1)
                if not site_id:
                    print("❌ Site ID is required (--site_id or configure default)")
                    sys.exit(1)
                
                print(f"🔨 Creating function '{args.name}'...")
                token = getToken(credentials, environment)
                result = createFunction(site_id, args.name, args.description or "", token, environment)
                print("✅ Function created successfully!")
                print(json.dumps(result, indent=2))
            
            case 'update':
                function_id = get_function_id_from_context(args)
                if not function_id:
                    print("❌ Function ID is required")
                    print("💡 Either use --function_id or select a function with 'select' command")
                    sys.exit(1)
                if not args.code:
                    print("❌ Code file is required (--code)")
                    sys.exit(1)
                if not args.env_file:
                    print("❌ Environment file is required (--env_file)")
                    sys.exit(1)
                
                current_function = config_manager.get_current_function()
                function_name = current_function['name'] if current_function and not args.function_id else function_id[:8] + "..."
                print(f"🔄 Updating function {function_name}...")
                token = getToken(credentials, environment)
                env_variables = json.load(args.env_file)
                updatedFunction = updateFunction(function_id, args.code, env_variables, token, environment)

                task_url = updatedFunction.get("self")        
                status = checkTaskStatus(task_url, token).get("status")
                
                print("⏳ Processing update...")
                while status == "processing":
                    time.sleep(5)
                    status = checkTaskStatus(task_url, token).get("status")
                    if args.verbose:
                        print(f"   Status: {status}")

                versionId = checkTaskStatus(task_url, token).get('entity').get('id')
                print(f"🚀 Deploying version {versionId}...")
                deploy_result = deployFunction(function_id, versionId, token, environment)
                print("✅ Function updated and deployed successfully!")
                print(json.dumps(deploy_result, indent=2))
            
            case 'task-status':
                if not args.function_id or not args.task_id:
                    print("❌ Both function ID and task ID are required")
                    sys.exit(1)
                
                result = getFunctionTask(args.function_id, args.task_id, getToken(credentials, environment))
                print(json.dumps(result, indent=2))
            
            case 'deploy':
                function_id = get_function_id_from_context(args)
                if not function_id:
                    print("❌ Function ID is required")
                    print("💡 Either use --function_id or select a function with 'select' command")
                    sys.exit(1)
                if not args.version_id:
                    print("❌ Version ID is required (--version_id)")
                    sys.exit(1)
                
                current_function = config_manager.get_current_function()
                function_name = current_function['name'] if current_function and not args.function_id else function_id[:8] + "..."
                print(f"🚀 Deploying function {function_name} version {args.version_id}...")
                token = getToken(credentials, environment)
                result = deployFunction(function_id, args.version_id, token, environment)
                print("✅ Function deployed successfully!")
                print(json.dumps(result, indent=2))
            
            case 'invoke':
                if not args.endpoint or not args.payload:
                    print("❌ Both endpoint and payload file are required")
                    sys.exit(1)
                
                payload = json.load(args.payload)
                print(f"🎯 Invoking function at {args.endpoint}...")
                result = invokeFunction(args.endpoint, payload, getToken(credentials, environment))
                print("✅ Function invoked successfully!")
                print(json.dumps(result, indent=2))
            
            case 'get-logs':  
                function_id = get_function_id_from_context(args)
                if not function_id:
                    print("❌ Function ID is required")
                    print("💡 Either use --function_id or select a function with 'select' command")
                    sys.exit(1)
                if not args.start_date or not args.end_date:
                    print("❌ Both start date and end date are required")
                    sys.exit(1)
                
                current_function = config_manager.get_current_function()
                function_name = current_function['name'] if current_function and not args.function_id else function_id[:8] + "..."
                print(f"📋 Fetching logs for function {function_name}...")
                token = getToken(credentials, environment)
                logs, next_page = getLogs(function_id, token, args.start_date, args.end_date, environment)
                if logs:
                    print(f"✅ Found {len(logs)} log entries:")
                    for log_entry in logs:
                        print(log_entry)
                    if next_page:
                        print(f"ℹ️  More logs available (use pagination to fetch more)")
                else:
                    print("ℹ️  No logs found for the specified time range")
            
            case 'recent-logs':
                function_id = get_function_id_from_context(args)
                if not function_id:
                    print("❌ Function ID is required")
                    print("💡 Either use --function_id or select a function with 'select' command")
                    sys.exit(1)
                
                # Calculate time range
                now = time.time()
                if args.hours:
                    start_time = now - (args.hours * 3600)
                    time_desc = f"last {args.hours} hour(s)"
                elif args.minutes:
                    start_time = now - (args.minutes * 60)
                    time_desc = f"last {args.minutes} minute(s)"
                else:
                    # Default to last 1 hour
                    start_time = now - 3600
                    time_desc = "last 1 hour"
                
                start_date = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(start_time))
                end_date = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now))
                
                current_function = config_manager.get_current_function()
                function_name = current_function['name'] if current_function and not args.function_id else function_id[:8] + "..."
                print(f"📋 Fetching logs for function {function_name} ({time_desc})...")
                
                token = getToken(credentials, environment)
                logs, next_page = getLogs(function_id, token, start_date, end_date, environment)
                if logs:
                    print(f"✅ Found {len(logs)} log entries:")
                    for log_entry in logs:
                        print(log_entry)
                    if next_page:
                        print(f"ℹ️  More logs available (use pagination to fetch more)")
                else:
                    print(f"ℹ️  No logs found for the {time_desc}")

            case 'get-info':
                function_id = get_function_id_from_context(args)
                if not function_id:
                    print("❌ Function ID is required")
                    print("💡 Either use --function_id or select a function with 'select' command")
                    sys.exit(1)
                
                result = getFunctionInfo(function_id, getToken(credentials, environment))
                print(json.dumps(result, indent=2))
            
            case 'get-version':
                if not args.function_id or not args.version_id:
                    print("❌ Both function ID and version ID are required")
                    sys.exit(1)
                
                result = getFunctionVersion(args.function_id, args.version_id, getToken(credentials, environment))
                print(json.dumps(result, indent=2))
            
            case 'get-code':
                if not args.function_id or not args.version_id:
                    print("❌ Both function ID and version ID are required")
                    sys.exit(1)
                
                code = getFunctionGetCode(args.function_id, args.version_id, getToken(credentials, environment))
                print(code)
            
            case 'list':
                if not site_id:
                    print("❌ Site ID is required (--site_id or configure default)")
                    sys.exit(1)
                
                print(f"📋 Listing functions for site {site_id}...")
                token = getToken(credentials, environment, debug=args.verbose)
                result = listFunctions([site_id], token, environment, debug=args.verbose)
                
                functions = result.get('functions', [])
                if functions:
                    print(f"✅ Found {len(functions)} function(s):")
                    for func in functions:
                        status = "🟢 Deployed" if func.get('current_version_id') else "🔴 Not deployed"
                        print(f"  • {func['name']} ({func['id']}) - {status}")
                        if func.get('description'):
                            print(f"    Description: {func['description']}")
                        if func.get('current_version_id'):
                            print(f"    Current version: {func['current_version_id']}")
                        print()
                else:
                    print("ℹ️  No functions found")
            
            case 'list-versions':
                function_id = get_function_id_from_context(args)
                if not function_id:
                    print("❌ Function ID is required")
                    print("💡 Either use --function_id or select a function with 'select' command")
                    sys.exit(1)
                
                current_function = config_manager.get_current_function()
                function_name = current_function['name'] if current_function and not args.function_id else function_id[:8] + "..."
                print(f"📋 Listing versions for function {function_name}...")
                result = listFunctionVersions(function_id, getToken(credentials, environment), environment, args.per_page, args.order)
                
                versions = result.get('versions', [])
                if versions:
                    print(f"✅ Found {len(versions)} version(s):")
                    for version in versions:
                        created_at = version.get('created_at', 'Unknown')
                        compatibility_date = version.get('compatibility_date', 'Unknown')
                        print(f"  • Version {version['id']}")
                        print(f"    Created: {created_at}")
                        print(f"    Compatibility: {compatibility_date}")
                        if version.get('environment_variables'):
                            print(f"    Env vars: {len(version['environment_variables'])} defined")
                        print()
                else:
                    print("ℹ️  No versions found")
            
            case 'get-stats':
                print("📊 Fetching function statistics...")
                token = getToken(credentials, environment)
                result = getFunctionStats(token, args.function_ids, environment)
                
                stats = result.get('statistics', [])
                if stats:
                    print("✅ Function invocation statistics:")
                    for stat in stats:
                        print(f"  Function: {stat.get('function_id', 'Unknown')}")
                        invocations = stat.get('invocations', [])
                        total = sum(inv.get('count', 0) for inv in invocations)
                        print(f"  Total invocations this month: {total}")
                        if invocations:
                            print("  Daily breakdown:")
                            for inv in invocations[-7:]:  # Show last 7 days
                                print(f"    {inv.get('date')}: {inv.get('count', 0)} invocations")
                        print()
                else:
                    print("ℹ️  No statistics available")
            
            case 'update-metadata':
                if not args.function_id:
                    print("❌ Function ID is required")
                    sys.exit(1)
                if not args.name and not args.description:
                    print("❌ Either name or description must be provided")
                    sys.exit(1)
                
                print(f"🔄 Updating function metadata...")
                token = getToken(credentials, environment)
                result = updateFunctionMetadata(args.function_id, args.name, args.description, token, environment)
                if result:
                    print("✅ Function metadata updated successfully!")
                    print(json.dumps(result, indent=2))
            
            # KV Store operations
            case 'kv-set':
                if not args.namespace or not args.key or args.value is None:
                    print("❌ Namespace, key, and value are required for KV set")
                    sys.exit(1)
                
                operations = [{"op": "set", "key": args.key, "value": args.value}]
                print(f"💾 Setting KV pair {args.key} in namespace {args.namespace}...")
                token = getToken(credentials, environment)
                result = kvStoreBulkOperations(args.namespace, operations, token, environment)
                
                if result.get('results'):
                    item = result['results'][0]
                    if item.get('value') is not None:
                        print(f"✅ Successfully set {args.key} = {item['value']}")
                        print(f"   Expires: {item.get('expires', 'Unknown')}")
                    else:
                        print("❌ Failed to set value")
            
            case 'kv-get':
                if not args.namespace or not args.key:
                    print("❌ Namespace and key are required for KV get")
                    sys.exit(1)
                
                operations = [{"op": "get", "key": args.key}]
                print(f"🔍 Getting KV pair {args.key} from namespace {args.namespace}...")
                token = getToken(credentials, environment)
                result = kvStoreBulkOperations(args.namespace, operations, token, environment)
                
                if result.get('results'):
                    item = result['results'][0]
                    if item.get('value') is not None:
                        print(f"✅ {args.key} = {item['value']}")
                        print(f"   Expires: {item.get('expires', 'Unknown')}")
                    else:
                        print(f"ℹ️  Key '{args.key}' not found")
            
            case 'kv-delete':
                if not args.namespace or not args.key:
                    print("❌ Namespace and key are required for KV delete")
                    sys.exit(1)
                
                operations = [{"op": "delete", "key": args.key}]
                print(f"🗑️  Deleting KV pair {args.key} from namespace {args.namespace}...")
                token = getToken(credentials, environment)
                result = kvStoreBulkOperations(args.namespace, operations, token, environment)
                
                if result.get('results'):
                    item = result['results'][0]
                    print(f"✅ Successfully deleted {args.key}")
                    if item.get('value'):
                        print(f"   Previous value was: {item['value']}")
            
            case 'kv-list':
                if not args.namespace:
                    print("❌ Namespace is required for KV list")
                    sys.exit(1)
                
                print(f"📋 Listing KV pairs in namespace {args.namespace}...")
                token = getToken(credentials, environment)
                result = kvStoreList(args.namespace, token, environment)
                
                items = result.get('items', [])
                if items:
                    print(f"✅ Found {len(items)} item(s):")
                    for item in items:
                        print(f"  • {item['key']} = {item['value']}")
                        print(f"    Expires: {item.get('expires', 'Unknown')}")
                else:
                    print("ℹ️  No items found in namespace")
            
            case 'kv-bulk':
                if not args.namespace or not args.kv_operations:
                    print("❌ Namespace and operations file are required for KV bulk")
                    sys.exit(1)
                
                try:
                    operations = json.load(args.kv_operations)
                    if not isinstance(operations, list):
                        print("❌ Operations file must contain a JSON array")
                        sys.exit(1)
                except json.JSONDecodeError as e:
                    print(f"❌ Invalid JSON in operations file: {e}")
                    sys.exit(1)
                
                print(f"⚡ Performing {len(operations)} bulk operations in namespace {args.namespace}...")
                token = getToken(credentials, environment)
                result = kvStoreBulkOperations(args.namespace, operations, token, environment)
                
                if result.get('results'):
                    print(f"✅ Completed {len(result['results'])} operations:")
                    for i, item in enumerate(result['results']):
                        op = operations[i]
                        print(f"  {i+1}. {op['op']} {op['key']}: {item.get('value', 'null')}")
                else:
                    print("❌ No results returned")
    
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
