# Prepared recipe only. Build explicitly with an immutable core image ID/digest.
# Example: docker build --build-arg CORE_IMAGE=goatleta-engineer-runtime@sha256:... ...
ARG CORE_IMAGE
FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS ui_node
FROM ${CORE_IMAGE}
USER root
COPY --from=ui_node /usr/local/bin/node /usr/local/bin/node
COPY --from=ui_node /usr/local/lib/node_modules/npm /opt/node24-npm
RUN ln -sf /opt/node24-npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /opt/node24-npm/bin/npx-cli.js /usr/local/bin/npx
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN mkdir -p /opt/engineer-ui && cd /opt/engineer-ui \
    && npm install --ignore-scripts --save-exact playwright@1.56.1 --loglevel verbose \
    && ./node_modules/.bin/playwright install --with-deps chromium \
    && chmod -R a+rX /opt/playwright-browsers /opt/engineer-ui
ENV ENGINEER_PLAYWRIGHT_MODULE=/opt/engineer-ui/node_modules/playwright/index.mjs
USER 1000:1000
WORKDIR /workspace
ENTRYPOINT ["node", "/harness/engineer_ui_evidence.mjs"]
# Expo must come from the application's existing lockfile/dependencies, never a new global Expo version.
# No Android/iOS/emulator, credentials, browser session, Docker socket or app source baked into image.
