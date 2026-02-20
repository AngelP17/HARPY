FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY services/harpy-detect/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/harpy-detect/app.py ./app.py

EXPOSE 8085

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8085"]
