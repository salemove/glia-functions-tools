import os
import json
import requests
import argparse
import time

ENVIRONMENTS = {
  "production": {
      "api_url": "https://api.glia.com"
  },
  "beta": {
      "api_url": "https://api.beta.glia.com"
  }
}

credentials = userTokenPayload = {
  "api_key_secret": os.environ.get('api_key_secret'),
  "api_key_id": os.environ.get('api_key_id'),
  "site_ids": [os.environ.get('site_id')]
}

def getToken(credentials):
  url = ENVIRONMENTS.get("production").get("api_url") + "/operator_authentication/tokens"

  payload = {
      "api_key_secret": credentials.get('api_key_secret'),
      "api_key_id": credentials.get('api_key_id'),
      "site_ids": credentials.get('site_ids')
  }
  
  headers = {
      "Accept": "application/vnd.salemove.v1+json",
      "Content-Type": "application/json"
  }
  
  response = requests.post(url, json=payload, headers=headers)
  return response.json()["token"]

def createFunction(site_id, fnName, fnDescription, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/"
  
  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }

  payload = {
    "site_id": site_id, 
    "name": fnName, 
    "description": fnDescription
  }

  response = requests.post(url, json=payload, headers=headers)
  return response.json()

def createFunctionVers(site_id, fnName, fnDescription, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/"
  
  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }

  payload = {
    "site_id": site_id, 
    "name": fnName, 
    "description": fnDescription
  }

  response = requests.post(url, json=payload, headers=headers)
  return response.json()

def updateFunction(functionId, code, env_variables, token): 
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId + "/versions"

  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }
  
  payload = {
    "code": code.read(),
    "environment_variables": env_variables,
    "compatibility_date": "2023-11-21"
  }
  
  response = requests.post(url, json=payload, headers=headers)
  return response.json()

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

def deployFunction(functionId, versionId, token):
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId + "/deployments"

  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }

  payload = {
    "version_id": versionId
  }

  response = requests.post(url, json=payload, headers=headers)
  return response.json()
  return response.json()

def invokeFunction(endpoint, payload, token):
  url = ENVIRONMENTS.get("production").get("api_url") + endpoint
  headers = {
    "Content-Type": "application/json",
    "authorization": "Bearer " + token
  }

  response = requests.post(url, json=payload, headers=headers)
  return response.json()

def getLogs(functionId, token, startDate, endDate):
  ENTER = '\n'
  url = ENVIRONMENTS.get("production").get("api_url") + "/functions/" + functionId + "/logs?\?from\="+ startDate+ "\&to\="+ endDate
  
  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }
  response = requests.get(url, headers=headers)
  return response.json().get("logs")

def printLogs(logs):
  for log in logs:
    print(log)

parser = argparse.ArgumentParser(description='Glia Functions naiive CLI')

parser.add_argument('operation', choices=['create', 'update', 'task-status', 'deploy', 'invoke', 'get-logs', 'get-info', 'get-code', 'get-version'],
                    help='The operation you want to execute on the function.')
parser.add_argument('--name',
                    help='The name of the new function.')
parser.add_argument('--description',
                    help='The description of the function')
parser.add_argument('--site_id',
                    help='The site id of the function.')
parser.add_argument('--function_id',
                    help='The id of the function')
parser.add_argument('--code',
                    help='The code of the function.', type=argparse.FileType('r', encoding='UTF-8'))
parser.add_argument('--endpoint',
                    help='The endpoint of the function.')
parser.add_argument('--version_id',
                    help='Function\'s version id.')
parser.add_argument('--start_date',
                    help='Starting date of the logs.')
parser.add_argument('--end_date',
                    help='Ending date of the logs.')
parser.add_argument('--task_id',
                    help='Task ID after updating.')
parser.add_argument('--env',
                    help='Environment variables of the function.')
parser.add_argument('--payload',
                    help='Payload to send along the request.', type=argparse.FileType('r', encoding='UTF-8'))
parser.add_argument('--env_file',
                    help='Read environment variables from a file.', type=argparse.FileType('r', encoding='UTF-8'))

def checkTaskStatus(task_url, token):
  url = ENVIRONMENTS.get("production").get("api_url") + task_url
  
  headers = {
    "accept": "application/vnd.salemove.v1+json",
    "authorization": "Bearer " + token
  }
  response = requests.get(url, headers=headers)
  return response.json()

args = parser.parse_args()
match args.operation:
  case 'create':
    site_id = args.site_id
    name = args.name
    description = args.description
    print(createFunction(site_id, name, description, getToken(credentials)))
  case 'update':
    token = getToken(credentials)
    code = args.code
    functionId = args.function_id
    env_variables = json.load(args.env_file)
    updatedFunction = updateFunction(functionId, code, env_variables, token)

    task_url = updatedFunction.get("self")        
    status = checkTaskStatus(task_url, token).get("status")

    while status == "processing":
      time.sleep(5)
      status = checkTaskStatus(task_url, token).get("status")
      print(status)

    versionId = checkTaskStatus(task_url, token).get('entity').get('id')
    print("Deploying " + versionId) 
    print(deployFunction(functionId, versionId, token))
  case 'task-status':
    functionId = args.function_id
    taskId = args.task_id
    print(getFunctionTask(functionId, taskId, getToken(credentials)))
  case 'deploy':
    functionId = args.function_id
    versionId = args.version_id
    print(deployFunction(functionId, versionId, getToken(credentials)))
  case 'invoke':
    endpoint = args.endpoint
    payload = json.load(args.payload)

    print(invokeFunction(endpoint, payload, getToken(credentials)))
  case 'get-logs':  
    functionId = args.function_id
    startDate = args.start_date
    endDate = args.end_date
    logs = getLogs(functionId, getToken(credentials), startDate, endDate)
    json_list = list(logs)
    for json_str in json_list:
        print(json_str)

  case 'get-info':
    functionId = args.function_id
    print(getFunctionInfo(functionId, getToken(credentials)))
  case 'get-version':
    functionId = args.function_id
    versionId = args.version_id
    print(getFunctionVersion(functionId, versionId, getToken(credentials)))
  case 'get-code':
    functionId = args.function_id
    versionId = args.version_id
    print(getFunctionGetCode(functionId, versionId, getToken(credentials)))
