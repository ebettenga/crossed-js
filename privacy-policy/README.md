# Crossed Privacy Policy

This directory contains a standalone privacy policy webpage for the Crossed app.

## Structure

```
privacy-policy/
├── index.html           # Privacy policy webpage
├── assets/
│   ├── images/         # Logo and favicon
│   └── fonts/          # Rubik font family
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
└── README.md          # This file
```

## Quick Start

### Using Docker Compose (Recommended)

1. Make sure Docker and Docker Compose are installed on your system
2. Navigate to the project root directory (parent of privacy-policy):
   ```bash
   cd ..
   ```
3. Start the web server:
   ```bash
   docker-compose up -d
   ```
4. Access the privacy policy at:
   - Main page: http://localhost:8080/privacy-policy
   - Direct access: http://localhost:8080/privacy-policy/index.html

### Stopping the Server

```bash
docker-compose down
```

### Rebuilding After Changes

```bash
docker-compose up -d --build
```

**Note:** The docker-compose.yml file is located in the project root directory, not in the privacy-policy directory.

## Accessing the Privacy Policy

Once the server is running, you can access the privacy policy at:
- **URL:** http://localhost:8080/privacy-policy

## Customization

### Changing the Port

Edit the `docker-compose.yml` file and change the port mapping:
```yaml
ports:
  - "YOUR_PORT:80"  # Change YOUR_PORT to your desired port
```

### Updating Content

1. Edit the `index.html` file
2. Rebuild and restart the container:
   ```bash
   docker-compose up -d --build
   ```

## Branding

The privacy policy page uses the Crossed brand colors and styling:
- Primary color: #8B0000 (dark red)
- Font: Rubik family
- Logo and favicon from the main app

## Production Deployment

For production deployment, consider:
1. Using a reverse proxy (nginx, Caddy, Traefik)
2. Adding SSL/TLS certificates
3. Setting up a custom domain
4. Configuring proper security headers
5. Setting up monitoring and logging

## Support

For questions or issues, contact: privacy@crossed.app
