"""Small Flask API behind SWAG at yourdomain.example.com/api/ -- currently just
the Fearless draft tracker, but structured as one blueprint per feature so a
future endpoint (e.g. replay uploads) is a new blueprint file plus one
registration line here, not a rewrite."""
from flask import Flask

from fearless import fearless_bp


def create_app():
    app = Flask(__name__)
    # Defense in depth alongside nginx's client_max_body_size (see
    # deploy/hots.subdomain.conf) -- caps how much of a request body Flask
    # will buffer into memory even if something ever proxies to this app
    # without that nginx limit in front of it.
    app.config["MAX_CONTENT_LENGTH"] = 100_000
    app.register_blueprint(fearless_bp)
    return app


app = create_app()
