from collections import deque


class SessionManager:
    def __init__(self, max_history: int = 5) -> None:
        self.max_history = max_history
        self.sessions: dict[str, deque[tuple[str, str]]] = {}

    def get_history(self, session_id: str) -> list[tuple[str, str]]:
        return list(self.sessions.get(session_id, deque(maxlen=self.max_history)))

    def append(self, session_id: str, question: str, answer: str) -> None:
        if session_id not in self.sessions:
            self.sessions[session_id] = deque(maxlen=self.max_history)
        self.sessions[session_id].append((question, answer))
