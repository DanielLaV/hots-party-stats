"""Small Flask API behind SWAG at yourdomain.example.com/api/ -- currently just
the Fearless draft tracker, but structured as one blueprint per feature so a
future endpoint (e.g. replay uploads) is a new blueprint file plus one
registration line here, not a rewrite."""
from flask import Flask

from fearless import fearless_bp


def create_app():
    app = Flask(__name__)
    app.register_blueprint(fearless_bp)
    return app


app = create_app()
