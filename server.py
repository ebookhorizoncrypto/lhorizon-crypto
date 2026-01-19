import http.server
import socketserver
import os

PORT = 3000

class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # If the path doesn't have an extension and isn't a directory, try adding .html
        if '.' not in self.path and not self.path.endswith('/'):
            if os.path.exists(self.path[1:] + '.html'):
                self.path += '.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

Handler = CleanUrlHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT} with Clean URLs support (auto .html)")
    httpd.serve_forever()
