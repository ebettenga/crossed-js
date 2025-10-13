FROM nginx:alpine

# Copy the privacy policy HTML and assets
COPY index.html /usr/share/nginx/html/privacy-policy/index.html
COPY assets /usr/share/nginx/html/privacy-policy/assets

# Create nginx configuration
RUN echo 'server { \
  listen 80; \
  server_name localhost; \
  \
  location / { \
  root /usr/share/nginx/html; \
  index index.html; \
  } \
  \
  location /privacy-policy { \
  alias /usr/share/nginx/html/privacy-policy; \
  index index.html; \
  try_files $uri $uri/ /privacy-policy/index.html; \
  } \
  \
  # Enable gzip compression \
  gzip on; \
  gzip_vary on; \
  gzip_min_length 1024; \
  gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
  }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
