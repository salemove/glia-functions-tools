#!/bin/zsh
export site_id=0
export api_key_secret=0
export api_key_id=0
alias gf='python3 glia-function-cli.py'
alias gf-update='python3 glia-function-cli.py update --code function-out.js --function_id $function_id'
alias gf-code='gf get-code --function_id $function_id --version_id $version_id'
alias gf-logs='python3 glia-function-cli.py  get-logs  --function_id $function_id  --start_date "2023-11-28" --end_date "2023-12-01"'

echo "You can call updating a function as:  gf-update --env_file credentials.json"
echo "You can invoke a function as: gf-invoke --payload payload.json"
