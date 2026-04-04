#!/usr/bin/env bash
set -e

# Resolve this machine's primary LAN IPv4 (macOS + Linux).
detect_lan_ip() {
  local os ip
  os="$(uname -s)"
  if [[ "$os" == "Darwin" ]]; then
    for iface in en0 en1 en2; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      if [[ -n "$ip" && "$ip" != "127.0.0.1" ]]; then
        echo "$ip"
        return 0
      fi
    done
    return 1
  fi
  if command -v ip >/dev/null 2>&1; then
    ip="$(
      ip -4 -o addr show scope global 2>/dev/null \
        | awk '{print $4}' \
        | cut -d/ -f1 \
        | grep -v '^$' \
        | head -1
    )"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  fi
  return 1
}

current_ip="$(detect_lan_ip || true)"
if [[ -z "$current_ip" ]]; then
  echo "Could not detect this machine's LAN IP."
  echo "On macOS, connect to Wi‑Fi/Ethernet; on Linux, install \`iproute2\`."
  exit 1
fi

env_file=apps/mobile/.env
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file — copy from apps/mobile/.env.example and set EXPO_PUBLIC_VISION_API_URL."
  exit 1
fi
if ! grep -qF "$current_ip" "$env_file"; then
  echo "your ip ($current_ip) not in $env_file"
  echo "change EXPO_PUBLIC_VISION_API_URL to http://$current_ip:8000/ (or include this IP)"
  exit 1
fi

venv_path=services/vision-api/.venv
if [[ ! -d "$venv_path" ]]; then
  python3 -m venv "$venv_path"
fi
pip_cmd="$venv_path/bin/pip"
if [[ ! -x "$pip_cmd" ]]; then
  echo "venv is incomplete: $pip_cmd not found"
  exit 1
fi

dependencies=(uvicorn fastapi)
for i in "${dependencies[@]}"; do
  if ! "$pip_cmd" show "$i" &>/dev/null; then
    "$pip_cmd" install "$i"
  fi
done

# if this point was reached, everything should be good

# uvicorn from venv, bind all interfaces so a phone can reach the Mac:
# cd services/vision-api && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
# cd apps/mobile && npx expo start --tunnel -c

# version of commands
# intentionally not called
cmds_as_reference () {
    # assuming you're on top directory of repo
    # make sure to run 'pip install -r services/vision-api/requirements.txt'
    # otherwise modules like cv2 can be missing
    cd services/vision-api && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
    # make sure to run 'npm install'
    # otherwise random dependencies can be missing
    cd ../../
    cd apps/mobile && npx expo start --tunnel -c
}
