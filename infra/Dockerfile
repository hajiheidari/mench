FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY . .
RUN --mount=type=secret,id=ca if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; npm_config_https_proxy="$HTTPS_PROXY" npm_config_proxy="$HTTP_PROXY" npm ci --no-fund --no-audit --fetch-retries=1 --fetch-timeout=30000
EXPOSE 3001 5173
CMD ["npm", "run", "dev:api"]
