FROM ghcr.io/puppeteer/puppeteer:25.16.0

USER root

RUN apt-get update && apt-get install -y xvfb x11vnc fluxbox tini fonts-recommended fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*
RUN fc-cache -f -v

RUN mkdir -p /var/cache/fontconfig
RUN chmod -R 777 /var/cache/fontconfig

RUN mkdir -p /.cache/fontconfig
RUN chmod -R 777 /.cache/fontconfig

RUN mkdir -p /blitzbrowser/user-data
RUN chmod -R 777 /blitzbrowser/user-data

RUN mkdir -p /blitzbrowser/browsers
RUN chmod -R 777 /blitzbrowser/browsers

USER $PPTRUSER_UID

RUN mkdir /home/pptruser/user-data

COPY ./package.json ./package-lock.json ./

# Exact versions from the lockfile; the base image's tag must match the
# puppeteer version in it (its Chrome is the one puppeteer expects).
RUN npm ci

# Chrome is pinned on its own, to the current Chrome for Testing *stable*, so a
# Chrome security release doesn't wait for a puppeteer release (puppeteer
# 25.16.0 bundles 156.0.8078.47). Bump this with each stable update:
# https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json
ARG CHROME_VERSION=157.0.8103.38
RUN npx --no-install @puppeteer/browsers install chrome@${CHROME_VERSION} --path /home/pptruser/.cache/puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/home/pptruser/.cache/puppeteer/chrome/linux-${CHROME_VERSION}/chrome-linux64/chrome

# Fail the build if the Chrome puppeteer launches isn't there, and log its version.
RUN node -e "require('puppeteer').executablePath().then(p => { require('fs').accessSync(p); console.log('Chrome:', p) })" \
 && "$(node -e "require('puppeteer').executablePath().then(p => console.log(p))")" --version

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json

RUN npm run build

ENTRYPOINT ["tini", "--"]

CMD ["node", "./dist/main.js"]
