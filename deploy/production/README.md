# HeyForm Production Deploy

This setup keeps HeyForm exactly on the existing production path:

- public access through Traefik at `https://form.herancadigitalag.com`
- web-facing service attached to Docker network `proxy`
- no direct host port for HeyForm
- no WireGuard network attached to the HeyForm container

GitHub Actions builds and publishes the Docker image to GHCR. The production
server pulls that image locally and updates the existing Compose service.

## Flow

1. Push or manually dispatch `.github/workflows/deploy-production.yml` on `next`.
2. GitHub-hosted runner builds `linux/amd64` and pushes
   `ghcr.io/ghmfreitas/heyform:production`.
3. A local server-side job runs `/home/gustavo/bin/deploy-latest-heyform-production`.
4. The server pulls the `production` tag, compares it to the running container,
   and only deploys when the image changed.
5. `/home/gustavo/bin/deploy-heyform-production` migrates uploads into
   `/srv/data/heyform/assets`, updates only the HeyForm image and upload bind
   path, recreates the `heyform` service, checks `/health/ready`, and rolls
   back on failure.

## GitHub Setup

The workflow only needs the default `GITHUB_TOKEN` permissions:

- `contents: read`
- `packages: write`

No SSH or WireGuard secrets are required because GitHub Actions does not connect
to the server.

## Server Setup

Install the deploy scripts on the server:

```sh
install -d -m 700 /home/gustavo/bin
install -m 700 deploy/production/deploy-heyform-production /home/gustavo/bin/deploy-heyform-production
install -m 700 deploy/production/deploy-latest-heyform-production /home/gustavo/bin/deploy-latest-heyform-production
```

Make the GHCR package public after the first image publish, or log Docker in on
the server with a read-only GitHub Packages token:

```sh
docker login ghcr.io -u ghmfreitas
```

To enable automatic local deploys, add a server-side cron entry or systemd timer
that runs:

```sh
/home/gustavo/bin/deploy-latest-heyform-production
```

Do not attach HeyForm to WireGuard and do not publish its app port on the host.
The Compose service should continue using Traefik labels and `expose: "9157"`.
