FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bunfig.toml ./
COPY chobble-template/packages/js-toolkit ./chobble-template/packages/js-toolkit
RUN bun install --production

COPY src ./src
COPY bin ./bin

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "bin/serve.js"]
