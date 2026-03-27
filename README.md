# awg-control

Minimal REST API to manage AmneziaWG 2.0 clients: create, enable, disable, delete.
Authentication via single `X-API-Key` header.

## Setup

```bash
git clone https://github.com/trigger-maker/awg-control.git
cd awg-control
# Edit API_KEY in docker-compose.yml
docker compose up -d
```

## Endpoints

```
POST   /users              - Create user {"id": "user123"}
POST   /users/:id/enable   - Enable user
POST   /users/:id/disable  - Disable user
DELETE /users/:id          - Delete user
GET    /users              - List users
```

## Auth

All requests require header:
```
X-API-Key: your_key_here
```

## Example

```bash
KEY="your_api_key"
IP="your_server_ip"

curl -H "X-API-Key: $KEY" -X POST http://$IP:3000/users -d '{"id":"user1"}'
curl -H "X-API-Key: $KEY" -X POST http://$IP:3000/users/user1/enable
curl -H "X-API-Key: $KEY" -X POST http://$IP:3000/users/user1/disable
curl -H "X-API-Key: $KEY" -X DELETE http://$IP:3000/users/user1
curl -H "X-API-Key: $KEY" http://$IP:3000/users
```
