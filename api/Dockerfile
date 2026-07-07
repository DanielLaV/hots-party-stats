# Single worker deliberately -- storage.py's write lock only protects
# concurrent threads within one process, not across multiple gunicorn
# workers. Fine for this traffic level; see storage.py if that changes.
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check --root-user-action=ignore -r requirements.txt
COPY . .
# Runs as a fixed non-root UID rather than the image's default root, so a
# future code-execution bug in this app or a dependency doesn't hand an
# attacker root inside the container. UID/GID 1000 is arbitrary but fixed,
# so ../deploy/api-data on the host can be chowned to match -- see
# deploy/README.md.
RUN groupadd -g 1000 appuser && useradd -u 1000 -g appuser -M appuser
USER appuser
EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "--workers", "1", "app:app"]
