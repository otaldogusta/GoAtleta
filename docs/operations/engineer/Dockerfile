FROM python:3.12-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e AS python-runtime
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
COPY --from=python-runtime /usr/local/ /usr/local/
RUN apt-get update && apt-get install --yes --no-install-recommends ca-certificates git ripgrep \
    libexpat1 libsqlite3-0 libbz2-1.0 libffi8 liblzma5 libgdbm6 libreadline8 libncursesw6 libuuid1 \
    && ldconfig && python --version && node --version \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global --ignore-scripts @openai/codex@0.161.0-alpha.11 \
    && npm cache clean --force \
    && codex --version \
    && codex exec-server --help >/dev/null
USER 1000:1000
WORKDIR /workspace
ENV HOME=/home/node CODEX_HOME=/home/node
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["codex"]
