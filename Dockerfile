FROM node:18.15.0
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
WORKDIR /usr/src/app
COPY ./ /usr/src/app/

# Instalar dependencias
RUN npm install

# Iniciar datos GTFS
RUN npm install gtfs -g
RUN gtfs-import

# Inicia app
CMD ["node", "api.js"]