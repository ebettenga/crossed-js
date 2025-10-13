FROM nginx:alpine

# Copy the privacy policy HTML and assets
COPY index.html /usr/share/nginx/html/privacy-policy/index.html
COPY assets /usr/share/nginx/html/privacy-policy/assets

# Remove all default nginx configurations and copy our custom configuration
RUN rm -f /etc/nginx/conf.d/*.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
