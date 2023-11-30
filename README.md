# API Endpoints

La aplicación proporciona los siguientes endpoints para interactuar con los datos:

## Obtener Tiempo Programado para una Parada y Línea Específica

- **URL**: `/parada/:parada/:linea`
- **Método**: `GET`
- **Parámetros URL**:
  - `parada`: ID de la parada
  - `linea`: ID de la línea
- **Descripción**: Devuelve el tiempo programado para una parada y línea específica.

## Obtener Tiempo Programado para una Parada

- **URL**: `/parada/:parada`
- **Método**: `GET`
- **Parámetros URL**:
  - `parada`: ID de la parada
- **Descripción**: Devuelve el tiempo programado para una parada específica.

## Listar Todas las Paradas

- **URL**: `/paradas`
- **Método**: `GET`
- **Descripción**: Devuelve una lista de todas las paradas.

## Obtener Tiempos de Llegada en Tiempo Real para una Parada

- **URL**: `/realtime/:parada`
- **Método**: `GET`
- **Parámetros URL**:
  - `parada`: ID de la parada
- **Descripción**: Devuelve los tiempos de llegada en tiempo real para una parada específica.

## Listar Todas las Líneas

- **URL**: `/lineas`
- **Método**: `GET`
- **Descripción**: Devuelve una lista de todas las líneas de transporte.

## Actualizar Datos

- **URL**: `/actualizardatos`
- **Método**: `GET`
- **Descripción**: Actualiza los datos utilizados por la aplicación.