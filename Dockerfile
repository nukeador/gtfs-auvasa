FROM node:18.15.0
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
WORKDIR /usr/src/app
COPY ./ /usr/src/app/

# Instalar dependencias
RUN npm install

# Descargar estáticos y reempazar el agency.txt por el que tiene URL
RUN gtfs-export
COPY agency.txt gtfs-export/auvasa/agency.txt

# Exponer el puerto en el que se ejecutará la aplicación
EXPOSE 3333

# Comando para ejecutar la aplicación
CMD ["node", "api.js"]
