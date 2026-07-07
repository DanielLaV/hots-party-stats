# Single worker deliberately -- storage.py's write lock only protects
# concurrent threads within one process, not across multiple gunicorn
# workers. Fine for this traffic level; see storage.py if that changes.
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check --root-user-action=ignore -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "--workers", "1", "app:app"]
