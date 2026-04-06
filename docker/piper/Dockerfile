FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install piper binary
RUN wget -q https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar xf piper_linux_x86_64.tar.gz \
    && rm piper_linux_x86_64.tar.gz \
    && chmod +x piper/piper

# Python REST wrapper deps
RUN pip install --no-cache-dir fastapi uvicorn httpx

# Download Polish voice model
RUN mkdir -p /voices && \
    wget -q -O /voices/pl_PL-darkman-medium.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx && \
    wget -q -O /voices/pl_PL-darkman-medium.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx.json

COPY server.py .

EXPOSE 5500
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5500"]
