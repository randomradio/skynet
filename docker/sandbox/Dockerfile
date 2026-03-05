FROM ghcr.io/agent-infra/sandbox:latest

# Install OpenCode CLI via direct binary download
# The install script (curl -fsSL https://opencode.ai/install | bash) also works
# but direct download is more predictable in CI.
ARG OPENCODE_VERSION=1.2.17
RUN curl -fsSL -o /tmp/opencode.tar.gz \
      "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
    && tar xzf /tmp/opencode.tar.gz -C /tmp \
    && mv /tmp/opencode /usr/local/bin/opencode \
    && chmod +x /usr/local/bin/opencode \
    && rm -f /tmp/opencode.tar.gz

# Verify installation
RUN opencode --version
