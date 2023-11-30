FROM node:18.15.0
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
WORKDIR /usr/src/app
COPY ./ /usr/src/app/

ENV NODE_PATH=/usr/local/lib/node_modules

# Instalar dependencias
RUN npm install

# Descargar estáticos y reempazar el agency.txt por el que tiene URL
RUN npm install gtfs -g
RUN gtfs-import

# Exponer el puerto en el que se ejecutará la aplicación
EXPOSE 3333

# Comando para ejecutar la aplicación
CMD ["node", "api.js"]