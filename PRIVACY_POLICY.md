# Crossed Privacy Policy Server

This document explains how to run the privacy policy webpage for the Crossed app.

## Overview

The privacy policy is a standalone static webpage served via nginx in a Docker container. It uses the Crossed brand colors, fonts, and styling.

## Quick Start

### Prerequisites
- Docker
- Docker Compose

### Running the Privacy Policy Server

1. From the project root directory, start the server:
   ```bash
   docker-compose up -d
   ```

2. Access the privacy policy at:
   - **URL:** http://localhost:8080/privacy-policy

### Stopping the Server

```bash
docker-compose down
```

### Rebuilding After Changes

If you make changes to the privacy policy content or styling:

```bash
docker-compose up -d --build
```

## File Structure

```
privacy-policy/
├── index.html           # Privacy policy webpage
├── assets/
│   ├── images/         # Logo and favicon
│   └── fonts/          # Rubik font family
├── Dockerfile          # Docker configuration
└── README.md          # Detailed documentation
```

## Customization

### Changing the Port

Edit [`docker-compose.yml`](docker-compose.yml:10) and modify the port mapping:

```yaml
ports:
  - "YOUR_PORT:80"  # Change YOUR_PORT to your desired port
```

### Updating Content

1. Edit [`privacy-policy/index.html`](privacy-policy/index.html:1)
2. Rebuild and restart:
   ```bash
   docker-compose up -d --build
   ```

## Branding

The privacy policy uses Crossed brand styling:
- **Primary Color:** #8B0000 (dark red)
- **Font:** Rubik family
- **Logo:** From [`assets/images/icon.png`](assets/images/icon.png:1)

## Production Deployment

For production, consider:
- Using a reverse proxy (nginx, Caddy, Traefik)
- Adding SSL/TLS certificates
- Setting up a custom domain
- Configuring security headers
- Setting up monitoring and logging

## Support

For questions or issues, contact: privacy@crossed.app
