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

# Ensure a usable Chrome exists at puppeteer.executablePath(). The base image
# ships a complete Chrome for ITS pinned puppeteer, but `npm i` may install a
# different puppeteer whose expected buildId differs, and re-installing that
# buildId can extract incompletely (binary missing) -> code=1005 at runtime.
# Strategy: try a clean install of the expected buildId; if the binary still
# isn't present, fall back to ANY complete chrome already in the cache by
# symlinking the expected dir to it. Diagnostics are printed throughout.
RUN set -eux; \
    EP=$(node -e "console.log(require('puppeteer').executablePath())"); echo "want=$EP"; \
    WANT_REV_DIR=$(dirname "$(dirname "$EP")"); echo "wantRevDir=$WANT_REV_DIR"; \
    BUILDID=$(basename "$WANT_REV_DIR" | sed 's/^linux-//'); echo "buildId=$BUILDID"; \
    rm -rf /home/pptruser/.cache/puppeteer/chrome/linux-"$BUILDID" /home/pptruser/.cache/puppeteer/chrome/*.zip; \
    (npx --yes @puppeteer/browsers install "chrome@${BUILDID}" --path /home/pptruser/.cache/puppeteer 2>&1 || echo "install-cmd-failed"); \
    rm -f /home/pptruser/.cache/puppeteer/chrome/*.zip; \
    if [ ! -x "$EP" ]; then \
      echo "expected binary missing; searching cache for any complete chrome"; \
      ALT=$(find /home/pptruser/.cache/puppeteer -type f -name chrome -path '*chrome-linux64/chrome' | head -1); \
      echo "alt=$ALT"; \
      if [ -n "$ALT" ] && [ "$ALT" != "$EP" ]; then \
        ALT_REV_DIR=$(dirname "$(dirname "$ALT")"); \
        echo "symlinking $WANT_REV_DIR -> $ALT_REV_DIR"; \
        rm -rf "$WANT_REV_DIR"; ln -s "$ALT_REV_DIR" "$WANT_REV_DIR"; \
      fi; \
    fi; \
    echo '--- final cache tree ---'; find /home/pptruser/.cache/puppeteer/chrome -maxdepth 3 \( -type d -o -name chrome \) | sort
# Fail the BUILD (not silently at runtime) if Chrome is missing or won't exec.
# BlitzBrowser launches with executablePath=process.env.BROWSER_EXECUTABLE_PATH;
# when unset, puppeteer uses executablePath() — the path we assert here.
RUN node -e "const {execFileSync}=require('child_process');const p=require('puppeteer');const ep=p.executablePath();const fs=require('fs');if(!fs.existsSync(ep)){console.error('Chrome missing at '+ep);process.exit(1)}execFileSync(ep,['--version'],{stdio:'inherit'});console.log('Chrome verified at '+ep)"

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json

RUN npm run build

ENTRYPOINT ["tini", "--"]

CMD ["node", "./dist/main.js"]