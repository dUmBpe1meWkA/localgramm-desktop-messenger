from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        connections = self.active_connections.get(user_id)

        if not connections:
            return

        if websocket in connections:
            connections.remove(websocket)

        if len(connections) == 0:
            del self.active_connections[user_id]

    def is_user_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_to_user(self, user_id: int, data: dict):
        connections = self.active_connections.get(user_id, [])

        disconnected = []

        for websocket in connections:
            try:
                await websocket.send_json(data)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(user_id, websocket)

    async def send_to_users(self, user_ids: list[int], data: dict):
        for user_id in user_ids:
            await self.send_to_user(user_id, data)

    async def broadcast(self, data: dict):
        user_ids = list(self.active_connections.keys())

        for user_id in user_ids:
            await self.send_to_user(user_id, data)


manager = ConnectionManager()