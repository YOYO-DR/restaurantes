# Binario oficial de Traefik (estático): el paquete de Alpine va atrasado (la 3.20
# traía Traefik 3.0.0, de julio de 2024, sin los avisos de seguridad posteriores).
FROM docker.io/traefik:v3.7.19 AS traefik

FROM alpine:3.24

# envsubst (parte del paquete gettext)
RUN apk add --no-cache gettext

COPY --from=traefik /usr/local/bin/traefik /usr/local/bin/traefik

# Crea carpeta para certificados
RUN mkdir -p /etc/traefik/acme \
    && touch /etc/traefik/acme/acme.json \
    && chmod 600 /etc/traefik/acme/acme.json

# Copia la plantilla del archivo traefik
COPY ./compose/production/traefik/traefik.template.yml /etc/traefik/traefik.template.yml

# Comando de inicio:
# 1. Usa envsubst para reemplazar las variables en la plantilla.
# 2. Ejecuta traefik con el archivo generado.
CMD envsubst < /etc/traefik/traefik.template.yml > /etc/traefik/traefik.yml && \
    traefik --configFile=/etc/traefik/traefik.yml
