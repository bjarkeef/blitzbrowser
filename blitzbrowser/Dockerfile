FROM ghcr.io/puppeteer/puppeteer:latest

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

COPY ./package.json ./package.json

RUN npm i

# Download the Chrome build THIS puppeteer version expects. The base image
# bundles a Chrome, but npm i may install a puppeteer whose required Chrome
# revision differs, leaving Chrome "not found at executablePath" and every CDP
# connect failing with code=1005. Installing explicitly keeps them in lockstep.
RUN npx puppeteer browsers install chrome

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json

RUN npm run build

ENTRYPOINT ["tini", "--"]

CMD ["node", "./dist/main.js"]