FROM ollama/ollama:0.40.12

# Set the Ollama storage directory (this is where it downloads models natively)
ENV OLLAMA_MODELS=/root/.ollama/models

# Pull models through a dedicated build-time server and verify their manifests.
COPY packages/deploy/containers/ollama/src/preload-models.sh /tmp/preload-models.sh
RUN bash /tmp/preload-models.sh && rm /tmp/preload-models.sh

# Expose the default port
EXPOSE 11434

# Set the standard entrypoint
ENTRYPOINT ["ollama", "serve"]
