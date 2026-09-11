"""
Servidor HTTP multi-hilo con charset=utf-8 en Content-Type
Soporta peticiones concurrentes para tiles y GeoJSON sin bloqueos.
"""
import http.server
import os
import sys

PORT = 8000
DIR = r"F:\geoportal_chapultepec\visor_web_export"

class UTF8Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith(('.html', '.js', '.css', '.json', '.geojson', '.txt')):
            self._charset_added = True
        super().end_headers()

    def guess_type(self, path):
        result = super().guess_type(path)
        if path.endswith(('.html', '.js', '.css', '.json', '.geojson', '.txt', '.xml')):
            if result.startswith('text/'):
                return result + '; charset=utf-8'
            return 'text/plain; charset=utf-8'
        return result

    def log_message(self, format, *args):
        # Silenciar logs excesivos de 404 para tiles fuera de extent
        if len(args) >= 2 and str(args[1]) == '404' and '/tiles/' in str(args[0]):
            return
        super().log_message(format, *args)

os.chdir(DIR)
http.server.ThreadingHTTPServer.allow_reuse_address = True
print(f"Serving {DIR} at http://127.0.0.1:{PORT}/ (multithreaded)")
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), UTF8Handler) as httpd:
    httpd.serve_forever()
