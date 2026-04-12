# Mythonos Engine — autonomous vuln research agent for the BlackWolf SOC.
FROM node:20-bookworm-slim

# Pentesting toolset the agent can call from inside the sandbox.
# Keep this list deliberate — every binary added here is a capability
# the AI pentester can use during an authorized engagement.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      # ── HTTP / network basics ──
      curl wget openssl \
      dnsutils iputils-ping net-tools \
      # ── Recon / fingerprinting ──
      nmap \
      whatweb \
      # ── Web vuln scanners ──
      sqlmap \
      # ── Fuzzing / dir busting ──
      wfuzz \
      # ── Brute force ──
      hydra \
      # ── Wordlists (dirb ships its own) ──
      dirb \
      # ── Generic tooling ──
      git file binutils python3 python3-pip \
      ripgrep jq unzip xxd \
    && rm -rf /var/lib/apt/lists/* \
    # ── nikto (not in bookworm repos — clone from git) ──
    && git clone --depth 1 https://github.com/sullo/nikto.git /opt/nikto \
    && ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto \
    && chmod +x /opt/nikto/program/nikto.pl \
    # ── ffuf + gobuster (not in bookworm — install via release binaries) ──
    && curl -fsSL https://github.com/ffuf/ffuf/releases/download/v2.1.0/ffuf_2.1.0_linux_amd64.tar.gz | tar xz -C /usr/local/bin ffuf \
    && curl -fsSL https://github.com/OJ/gobuster/releases/download/v3.8.2/gobuster_Linux_x86_64.tar.gz | tar xz -C /usr/local/bin gobuster \
    && chmod +x /usr/local/bin/ffuf /usr/local/bin/gobuster

# nuclei (template-based vuln scanner) — pulled from official release.
# Pin a known-good version; bump deliberately.
ARG NUCLEI_VERSION=3.3.7
RUN curl -fsSL "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip" -o /tmp/nuclei.zip \
    && unzip -q /tmp/nuclei.zip -d /usr/local/bin nuclei \
    && rm /tmp/nuclei.zip \
    && chmod +x /usr/local/bin/nuclei \
    && nuclei -update-templates -silent || true

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production \
    MYTHONOS_TARGETS_DIR=/app/targets \
    MYTHONOS_DATA_DIR=/app/data \
    PORT=3900 \
    HOST=0.0.0.0

RUN mkdir -p /app/targets /app/data

EXPOSE 3900

CMD ["node", "src/index.js"]
