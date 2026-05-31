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

# npm i swaps in puppeteer ^24.6.0 whose executablePath() points to a versioned
# cache dir that the base image never populated, so Chrome is "not found" and
# every CDP connect fails with code=1005. The base image also sets
# PUPPETEER_SKIP_DOWNLOAD=true, which makes `puppeteer browsers install` no-op
# (it returned in ~2s downloading nothing). Clear the skip flags and force a
# real download via @puppeteer/browsers into puppeteer's own cache dir, pinned
# to the exact buildId puppeteer expects. Single line: no continuations.
RUN rm -rf /home/pptruser/.cache/puppeteer/chrome; BUILDID=$(node -e "const p=require('puppeteer');console.log(require('puppeteer-core/lib/cjs/puppeteer/revisions.js').PUPPETEER_REVISIONS.chrome)"); echo "Installing chrome@${BUILDID}"; env -u PUPPETEER_SKIP_DOWNLOAD -u PUPPETEER_SKIP_CHROMIUM_DOWNLOAD npx --yes @puppeteer/browsers install "chrome@${BUILDID}" --path /home/pptruser/.cache/puppeteer
# Fail the BUILD (not silently at runtime) if Chrome is missing or won't exec.
# BlitzBrowser launches with executablePath=process.env.BROWSER_EXECUTABLE_PATH;
# when unset, puppeteer uses executablePath() — the path we assert here.
RUN node -e "const {execFileSync}=require('child_process');const p=require('puppeteer');const ep=p.executablePath();const fs=require('fs');if(!fs.existsSync(ep)){console.error('Chrome missing at '+ep);process.exit(1)}execFileSync(ep,['--version'],{stdio:'inherit'});console.log('Chrome verified at '+ep)"

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json

RUN npm run build

ENTRYPOINT ["tini", "--"]

CMD ["node", "./dist/main.js"]