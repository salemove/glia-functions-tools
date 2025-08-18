#!/usr/bin/env python3
"""
Glia Functions MCP Server

An MCP server that exposes Glia Functions CLI operations as tools.
Built using the fastmcp framework.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastmcp import FastMCP

# Import the CLI functions and classes
import importlib.util
import sys

# Load the CLI module with hyphens in filename from parent directory
spec = importlib.util.spec_from_file_location("glia_function_cli", "../glia-function-cli.py")
glia_cli = importlib.util.module_from_spec(spec)
sys.modules["glia_function_cli"] = glia_cli
spec.loader.exec_module(glia_cli)

# Import the needed functions and classes
ConfigManager = glia_cli.ConfigManager
ENVIRONMENTS = glia_cli.ENVIRONMENTS
getToken = glia_cli.getToken
createFunction = glia_cli.createFunction
updateFunction = glia_cli.updateFunction
deployFunction = glia_cli.deployFunction
invokeFunction = glia_cli.invokeFunction
getFunctionInfo = glia_cli.getFunctionInfo
getFunctionVersion = glia_cli.getFunctionVersion
getFunctionGetCode = glia_cli.getFunctionGetCode
getFunctionTask = glia_cli.getFunctionTask
getLogs = glia_cli.getLogs
listFunctions = glia_cli.listFunctions
listFunctionVersions = glia_cli.listFunctionVersions
getFunctionStats = glia_cli.getFunctionStats
updateFunctionMetadata = glia_cli.updateFunctionMetadata
kvStoreBulkOperations = glia_cli.kvStoreBulkOperations
kvStoreList = glia_cli.kvStoreList
selectFunction = glia_cli.selectFunction

# Initialize the MCP server
mcp = FastMCP("Glia Functions")

# Global config manager instance
config_manager = ConfigManager()

def get_credentials_and_environment(environment: Optional[str] = None) -> tuple:
    """Get credentials and environment for API calls"""
    credentials = config_manager.get_credentials()
    if not credentials:
        raise ValueError("No credentials configured. Run configure command first.")
    
    env = environment or config_manager.get_environment()
    return credentials, env

@mcp.tool()
def configure_glia_functions(
    api_key_id: str,
    api_key_secret: str,
    site_id: Optional[str] = None,
    environment: str = "production"
) -> Dict[str, Any]:
    """
    Configure Glia Functions CLI credentials and settings.
    
    Args:
        api_key_id: Your Glia API key ID
        api_key_secret: Your Glia API key secret
        site_id: Default site ID (optional)
        environment: Environment to use (production, beta, production-eu, beta-eu)
    """
    if environment not in ENVIRONMENTS:
        raise ValueError(f"Invalid environment. Must be one of: {list(ENVIRONMENTS.keys())}")
    
    config_manager.config['api_key_id'] = api_key_id
    config_manager.config['api_key_secret'] = api_key_secret
    if site_id:
        config_manager.config['site_id'] = site_id
    config_manager.config['environment'] = environment
    
    success = config_manager.save_config()
    return {
        "success": success,
        "message": "Configuration saved successfully" if success else "Failed to save configuration"
    }

@mcp.tool()
def show_glia_config() -> Dict[str, Any]:
    """Show current Glia Functions configuration (without secrets)"""
    config = config_manager.config
    return {
        "api_key_id": config.get('api_key_id', 'Not set')[:8] + "..." if config.get('api_key_id') else "Not set",
        "api_key_secret": "*****" if config.get('api_key_secret') else "Not set",
        "site_id": config.get('site_id', 'Not set'),
        "environment": config.get('environment', 'production'),
        "current_function": config_manager.get_current_function()
    }

@mcp.tool()
def create_glia_function(
    name: str,
    description: str = "",
    site_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new Glia function.
    
    Args:
        name: Name of the function
        description: Description of the function
        site_id: Site ID (uses configured default if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_site_id = site_id or config_manager.config.get('site_id')
    if not target_site_id:
        raise ValueError("Site ID is required (provide site_id or configure default)")
    
    token = getToken(credentials, env)
    result = createFunction(target_site_id, name, description, token, env)
    return result

@mcp.tool()
def update_glia_function(
    code: str,
    env_variables: Dict[str, str],
    function_id: Optional[str] = None,
    environment: Optional[str] = None,
    auto_deploy: bool = True
) -> Dict[str, Any]:
    """
    Update a Glia function with new code and environment variables.
    
    Args:
        code: JavaScript code for the function
        env_variables: Environment variables as key-value pairs
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
        auto_deploy: Whether to automatically deploy after update
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    
    # Create temporary file for code
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(code)
        temp_file_path = f.name
    
    try:
        # Open the temp file for reading
        with open(temp_file_path, 'r') as code_file:
            result = updateFunction(target_function_id, code_file, env_variables, token, env)
        
        # Wait for processing to complete
        import time
        task_url = result.get("self")
        if task_url:
            status = getFunctionTask(target_function_id, task_url.split('/')[-1], token).get("status")
            while status == "processing":
                time.sleep(2)
                status = getFunctionTask(target_function_id, task_url.split('/')[-1], token).get("status")
            
            if auto_deploy and status == "completed":
                task_result = getFunctionTask(target_function_id, task_url.split('/')[-1], token)
                version_id = task_result.get('entity', {}).get('id')
                if version_id:
                    deploy_result = deployFunction(target_function_id, version_id, token, env)
                    result['deployment'] = deploy_result
        
        return result
    finally:
        # Clean up temp file
        os.unlink(temp_file_path)

@mcp.tool()
def deploy_glia_function(
    version_id: str,
    function_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deploy a specific version of a Glia function.
    
    Args:
        version_id: Version ID to deploy
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    result = deployFunction(target_function_id, version_id, token, env)
    return result

@mcp.tool()
def invoke_glia_function(
    endpoint: str,
    payload: Dict[str, Any],
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Invoke a Glia function.
    
    Args:
        endpoint: Function endpoint path
        payload: JSON payload to send to the function
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    result = invokeFunction(endpoint, payload, token)
    return result

@mcp.tool()
def get_glia_function_info(
    function_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get information about a Glia function.
    
    Args:
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    result = getFunctionInfo(target_function_id, token)
    return result

@mcp.tool()
def get_glia_function_version(
    version_id: str,
    function_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get information about a specific version of a Glia function.
    
    Args:
        version_id: Version ID to get info for
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    result = getFunctionVersion(target_function_id, version_id, token)
    return result

@mcp.tool()
def get_glia_function_code(
    version_id: str,
    function_id: Optional[str] = None,
    environment: Optional[str] = None
) -> str:
    """
    Get the code for a specific version of a Glia function.
    
    Args:
        version_id: Version ID to get code for
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    code = getFunctionGetCode(target_function_id, version_id, token)
    return code

@mcp.tool()
def get_glia_function_logs(
    start_date: str,
    end_date: str,
    function_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get logs for a Glia function within a date range.
    
    Args:
        start_date: Start date (formats: 2024-01-01, 2024-01-01T12:00:00Z)
        end_date: End date (formats: 2024-01-01, 2024-01-01T12:00:00Z)
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    logs, next_page = getLogs(target_function_id, token, start_date, end_date, env)
    return {
        "logs": logs,
        "next_page": next_page,
        "count": len(logs)
    }

@mcp.tool()
def get_glia_function_recent_logs(
    hours: int = 1,
    function_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get recent logs for a Glia function.
    
    Args:
        hours: Number of hours back to get logs (default: 1)
        function_id: Function ID (uses current function if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    import time
    
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    # Calculate time range
    now = time.time()
    start_time = now - (hours * 3600)
    
    start_date = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(start_time))
    end_date = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now))
    
    token = getToken(credentials, env)
    logs, next_page = getLogs(target_function_id, token, start_date, end_date, env)
    return {
        "logs": logs,
        "next_page": next_page,
        "count": len(logs),
        "time_range_hours": hours
    }

@mcp.tool()
def list_glia_functions(
    site_id: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    List all Glia functions for a site.
    
    Args:
        site_id: Site ID (uses configured default if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_site_id = site_id or config_manager.config.get('site_id')
    if not target_site_id:
        raise ValueError("Site ID is required (provide site_id or configure default)")
    
    token = getToken(credentials, env)
    result = listFunctions([target_site_id], token, env)
    return result

@mcp.tool()
def list_glia_function_versions(
    function_id: Optional[str] = None,
    per_page: int = 20,
    order: str = "desc",
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    List all versions of a Glia function.
    
    Args:
        function_id: Function ID (uses current function if not provided)
        per_page: Number of versions per page (default: 20)
        order: Sort order - 'asc' or 'desc' (default: 'desc')
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    target_function_id = function_id or (config_manager.get_current_function() or {}).get('id')
    if not target_function_id:
        raise ValueError("Function ID is required (provide function_id or select a function)")
    
    token = getToken(credentials, env)
    result = listFunctionVersions(target_function_id, token, env, per_page, order)
    return result

@mcp.tool()
def get_glia_function_stats(
    function_ids: Optional[List[str]] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get invocation statistics for Glia functions.
    
    Args:
        function_ids: List of function IDs (optional, gets stats for all if not provided)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    result = getFunctionStats(token, function_ids, env)
    return result

@mcp.tool()
def update_glia_function_metadata(
    function_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update metadata (name/description) for a Glia function.
    
    Args:
        function_id: Function ID to update
        name: New name for the function (optional)
        description: New description for the function (optional)
        environment: Environment to use (uses configured default if not provided)
    """
    if not name and not description:
        raise ValueError("Either name or description must be provided")
    
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    result = updateFunctionMetadata(function_id, name, description, token, env)
    return result

@mcp.tool()
def select_glia_function(
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Interactively select a Glia function to work with.
    Note: This is a simplified version that returns available functions.
    Use set_current_glia_function to actually select one.
    
    Args:
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    
    site_id = config_manager.config.get('site_id')
    if not site_id:
        raise ValueError("No default site ID configured")
    
    token = getToken(credentials, env)
    result = listFunctions([site_id], token, env)
    functions = result.get('functions', [])
    
    return {
        "available_functions": functions,
        "message": "Use set_current_glia_function with a function_id to select one"
    }

@mcp.tool()
def set_current_glia_function(
    function_id: str,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Set the current working function by ID.
    
    Args:
        function_id: Function ID to set as current
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    
    # Get function info to validate and store
    function_info = getFunctionInfo(function_id, token)
    
    success = config_manager.set_current_function(function_info)
    return {
        "success": success,
        "function": function_info,
        "message": f"Set current function to: {function_info.get('name', function_id)}"
    }

@mcp.tool()
def get_current_glia_function() -> Dict[str, Any]:
    """Get the currently selected Glia function."""
    current_function = config_manager.get_current_function()
    return {
        "current_function": current_function,
        "has_selection": current_function is not None
    }

@mcp.tool()
def clear_current_glia_function() -> Dict[str, Any]:
    """Clear the current function selection."""
    success = config_manager.clear_current_function()
    return {
        "success": success,
        "message": "Cleared current function selection" if success else "Failed to clear selection"
    }

# KV Store Tools

@mcp.tool()
def glia_kv_set(
    namespace: str,
    key: str,
    value: str,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Set a key-value pair in Glia KV store.
    
    Args:
        namespace: KV store namespace
        key: Key to set
        value: Value to set
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    
    operations = [{"op": "set", "key": key, "value": value}]
    result = kvStoreBulkOperations(namespace, operations, token, env)
    return result

@mcp.tool()
def glia_kv_get(
    namespace: str,
    key: str,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get a value from Glia KV store.
    
    Args:
        namespace: KV store namespace
        key: Key to get
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    
    operations = [{"op": "get", "key": key}]
    result = kvStoreBulkOperations(namespace, operations, token, env)
    return result

@mcp.tool()
def glia_kv_delete(
    namespace: str,
    key: str,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Delete a key from Glia KV store.
    
    Args:
        namespace: KV store namespace
        key: Key to delete
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    
    operations = [{"op": "delete", "key": key}]
    result = kvStoreBulkOperations(namespace, operations, token, env)
    return result

@mcp.tool()
def glia_kv_list(
    namespace: str,
    max_page_size: int = 100,
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    List all key-value pairs in a Glia KV store namespace.
    
    Args:
        namespace: KV store namespace
        max_page_size: Maximum number of items per page (default: 100)
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    
    result = kvStoreList(namespace, token, env, max_page_size)
    return result

@mcp.tool()
def glia_kv_bulk(
    namespace: str,
    operations: List[Dict[str, Any]],
    environment: Optional[str] = None
) -> Dict[str, Any]:
    """
    Perform bulk operations on Glia KV store.
    
    Args:
        namespace: KV store namespace
        operations: List of operations, each with 'op' (set/get/delete), 'key', and optionally 'value'
        environment: Environment to use (uses configured default if not provided)
    """
    credentials, env = get_credentials_and_environment(environment)
    token = getToken(credentials, env)
    
    result = kvStoreBulkOperations(namespace, operations, token, env)
    return result

def main():
    """Entry point for the MCP server"""
    mcp.run(transport="sse")

if __name__ == "__main__":
    main()