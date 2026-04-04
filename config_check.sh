#!/usr/bin/env bash

# I don't think windows would have nmcli, but mac might
current_ip="$( \
    ip -c=never addr \
        | grep --color -o 'inet\b [0-9.]\+' \
        | grep -v '127.0.0.1' \
        | awk -F' ' '{print $2}'
)"

# check env file has current computer's ip address
env_file=apps/mobile/.env
if ! grep -q "$current_ip" "$env_file"; then
    echo "your ip ($current_ip) not in $env_file"
    echo "change EXPO_PUBLIC_VISION_API_URL to http://your-ip:8000/"
    exit 1
fi

venv_path=services/vision-api/.venv
handle_venv () {
    # ensure venv exists
    if [[ ! -d "$venv_path" ]]; then
        python3 -m venv "$venv_path"
    fi
    # i guess sourcing inside bash script doesn't work?
    if ! echo "$VIRTUAL_ENV" | grep -q "services/vision-api/.venv"; then
        printf "please activate venv using \'source %s/bin/activate\'\n" \
            "$venv_path"
        exit 1
    fi
    # ensure uvicorn and dependency is installed
    dependencies=( uvicorn fastapi )
    for i in "${dependencies[@]}"; do
        # res variable avoids broken pipe in grep check
        res=$(pip list | grep "$i")
        if [[ -z "$res" ]]; then
            pip install "$i"
        fi
    done
}

handle_venv

# if this point was reached, everything should be good

# uvicorn services.vision-api.main:app --reload --host 127.0.0.1 --port 8000
# cd apps/mobile && npx expo start --tunnel -c
