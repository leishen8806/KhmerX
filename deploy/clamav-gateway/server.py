import os
import socket
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 10 * 1024 * 1024
CLAMD_HOST = os.getenv("CLAMD_HOST", "clamav")
CLAMD_PORT = int(os.getenv("CLAMD_PORT", "3310"))


def clamd_command(command: bytes, payload: bytes = b"") -> bytes:
    with socket.create_connection((CLAMD_HOST, CLAMD_PORT), timeout=25) as conn:
        conn.settimeout(25)
        conn.sendall(command)
        if command == b"zINSTREAM\0":
            for start in range(0, len(payload), 1024 * 1024):
                chunk = payload[start:start + 1024 * 1024]
                conn.sendall(struct.pack("!I", len(chunk)) + chunk)
            conn.sendall(struct.pack("!I", 0))
        result = bytearray()
        while len(result) < 4096:
            part = conn.recv(1024)
            if not part:
                break
            result.extend(part)
            if b"\0" in part or result.endswith(b"\n"):
                break
        return bytes(result)


class Handler(BaseHTTPRequestHandler):
    server_version = "PayEaseScan/1.0"

    def log_message(self, *_args):
        return

    def send_json(self, code: int, body: bytes):
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/health":
            self.send_json(404, b'{"error":"not_found"}')
            return
        try:
            result = clamd_command(b"zPING\0")
            if b"PONG" not in result:
                raise RuntimeError("clamd did not respond")
            self.send_json(200, b'{"ok":true}')
        except Exception:
            self.send_json(503, b'{"ok":false}')

    def do_POST(self):
        if self.path != "/scan":
            self.send_json(404, b'{"error":"not_found"}')
            return
        try:
            size = int(self.headers.get("content-length", "-1"))
            if size < 1 or size > MAX_BYTES:
                self.send_json(413, b'{"error":"file_too_large"}')
                return
            payload = self.rfile.read(size)
            result = clamd_command(b"zINSTREAM\0", payload)
            text = result.decode("utf-8", "replace")
            if text.endswith("FOUND\0") or " FOUND" in text:
                self.send_json(422, b'{"clean":false,"status":"infected"}')
            elif text.endswith("OK\0") or text.endswith("OK\n"):
                self.send_json(200, b'{"clean":true,"status":"clean"}')
            else:
                self.send_json(503, b'{"clean":false,"status":"scanner_error"}')
        except Exception:
            self.send_json(503, b'{"clean":false,"status":"scanner_error"}')


ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
