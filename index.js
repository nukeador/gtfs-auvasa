let gtfs;
import('gtfs').then(module => {
  gtfs = module;
});

let getStoptimes;
let getStoptimesUpdates;
let getRoutes;
let getStops;

import('gtfs').then(module => {
  getStoptimes = module.getStoptimes;
  getStoptimesUpdates = module.getStopTimesUpdates;
  getRoutes = module.getRoutes;
  getStops = module.getStops;
});

const { readFile } = require('fs').promises;
const moment = require('moment');
const config = require('./config.json');
const path = require('path');
const { get } = require('http');

async function main(argv) {
  let gtfs;
  await import('gtfs').then(module => {
    gtfs = module;
  });

  const config = JSON.parse(
    await readFile(path.join(__dirname, './config.json'), 'utf-8')
  );
  const db = gtfs.openDb(config);
}

async function mostrarParadas() {
  const stops = await gtfs.getStops();
  const stopRoutes = await Promise.all(stops.map(async stop => {
    const routes = await gtfs.getRoutes({ stop_id: stop.stop_id });
    return {
      stop: stop,
      routes: routes.map(route => route.route_short_name || route.route_long_name)
    };
  }));

  let result = stopRoutes.map(stopRoute => {
    return {
      parada: stopRoute.stop.stop_name,
      codigo: stopRoute.stop.stop_code,
      lineas: stopRoute.routes.join(', ')
    };
  });
  
  return result;
}

async function mostrarLineas() {
  const routes = await gtfs.getRoutes();
  const lineas = routes.map(route => ({
    numero: route.route_short_name,
    nombre: route.route_long_name
  }));
  return lineas;
}

// Tiempos en realtime
async function mostrarTiemposDeLlegadaParaParada(stopCode) {
  // Obtener todas las paradas con el código especificado
  const stops = await gtfs.getStops({ stop_code: stopCode });

  // Si no se encuentran paradas, mostrar mensaje y terminar la función
  if (stops.length === 0) {
    return `No se encontró la parada con código: ${stop.stopCode}`;
  }

  // Obtener el ID de la parada encontrada
  const stopId = stops[0].stop_id;
  const stopTimes = await getStoptimes({ stop_id: stopId });

  // Obtener todas las actualizaciones de tiempo real de paradas
  const stopTimesUpdates = await obtenerDatosRTCacheados();

  // Obtenemos el nombre del bus
  const routes = await getRoutes();
  const routeNames = routes.reduce((acc, route) => {
    acc[route.route_id] = route.route_short_name;
    return acc;
  }, {});

  const updatesByRouteName = {};

  // Filtrar las actualizaciones en tiempo real que corresponden a la parada con trip_id y stop_sequence
  stopTimesUpdates.forEach(update => {
    const matchingStopTime = stopTimes.find(st => st.trip_id === update.trip_id && st.stop_sequence === update.stop_sequence);
    if (matchingStopTime) {
      const routeName = routeNames[update.route_id] || update.route_id;
      updatesByRouteName[routeName] = updatesByRouteName[routeName] || [];
      updatesByRouteName[routeName].push({trip_id: update.trip_id, arrival_time: new Date(update.arrival_timestamp).toLocaleTimeString()});
    }
  });

  // Mostrar los tiempos de llegada agrupados por línea de autobús
  const salida = {
    parada: {
      nombre: stops[0].stop_name,
      numero: stopCode
    },
    buses: []
  };

  // Llenar la matriz de buses
  for (const [routeName, times] of Object.entries(updatesByRouteName)) {
    const sortedTimes = times.sort((a, b) => a.arrival_time - b.arrival_time);
    sortedTimes.forEach(time => {
      // Calcular el día y la hora con moment y timezone de Madrid
      const moment = require('moment-timezone');
      const now = moment().tz("Europe/Madrid");
      const nowFormatted = now.format('YYYY-MM-DD HH:mm:ss');
      const fechaLlegada = `${nowFormatted.split(' ')[0]} ${moment(time.arrival_time, 'hh:mm:ss A').format('HH:mm:ss')}`;
      const llegada = moment.tz(fechaLlegada, "YYYY-MM-DD HH:mm:ss", "Europe/Madrid");
      const ahora = moment().tz("Europe/Madrid");
      const tiempoRestante = Math.round((llegada - ahora) / 60000);

      // Solo mostrar los tiempos de llegada que sean en el futuro
      if (tiempoRestante >= 0) {
      salida.buses.push({
        trip_id: time.trip_id,
        linea: routeName,
        llegada: llegada.format('HH:mm:ss'), // Formatear la hora en formato 24H
        tiempoRestante: tiempoRestante
      });
      }
    });
  }

  // Ordenar los buses por tiempoRestante de menos a más
  salida.buses.sort((a, b) => a.tiempoRestante - b.tiempoRestante);

  // Devolver el objeto de salida
  return salida;
}

async function getRouteIdFromShortName(routeShortName) {
  const routes = await gtfs.getRoutes({ route_short_name: routeShortName });
  if (routes.length > 0) {
    return routes[0].route_id;
  } else {
    return null;
  }
}

async function getStopIdFromCode(stopCode) {
  const stops = await gtfs.getStops({ stop_code: stopCode });
  if (stops.length > 0) {
    return stops[0].stop_id;
  } else {
    return null;
  }
}

async function getRouteShortNameFromTripId(tripId) {
  const trip = await gtfs.getTrips({ trip_id: tripId });
  const route = await gtfs.getRoutes({ route_id: trip[0].route_id });
  return route[0].route_short_name;
}

async function mostrarTiempoProgramado(stopCode, routeShortName) {
  const currentDate = parseInt(moment().format('YYYYMMDD'));
  const calendarDates = await gtfs.getCalendarDates();
  let activeServiceIds = calendarDates
    .filter(calendarDate => calendarDate.date === currentDate && calendarDate.exception_type === 1)
    .map(calendarDate => calendarDate.service_id);

  const stopId = await getStopIdFromCode(stopCode);
  let routeId;
  if (routeShortName) {
    routeId = await getRouteIdFromShortName(routeShortName);
  }

  // Obtener `trip_id` para los servicios activos que corresponden a la ruta deseada
  const trips = routeId ? await gtfs.getTrips({ route_id: routeId }) : await gtfs.getTrips();
  const activeTripIds = trips
    .filter(trip => activeServiceIds.includes(trip.service_id))
    .map(trip => trip.trip_id);

  // Obtén la información de la parada
  const stopInfo = await gtfs.getStops({ stop_id: stopId });

  // Filtrar `stoptimes` por `trip_id` y `stop_id`
  let buses = {};
  for (const tripId of activeTripIds) {
    const tripStoptimes = await gtfs.getStoptimes({ trip_id: tripId, stop_id: stopId });
    if (tripStoptimes.length > 0) { // Solo agregar la línea si tiene horarios
      const routeShortName = await getRouteShortNameFromTripId(tripId);
      const tripInfo = await gtfs.getTrips({ trip_id: tripId });
      const routeInfo = await gtfs.getRoutes({ route_id: tripInfo[0].route_id });
      const horarios = tripStoptimes
        .filter(stoptime => stoptime.trip_id && stoptime.stop_id === stopId)
        .sort((a, b) => a.departure_time.localeCompare(b.departure_time))
        .map(stoptime => ({ llegada: stoptime.departure_time, trip_id: stoptime.trip_id }));
      if (!buses[routeShortName]) {
        buses[routeShortName] = {
          destino: tripInfo[0].trip_headsign,
          linea: routeShortName,
          horarios: [],
        };
      }
      buses[routeShortName].horarios.push(...horarios);
      // Ordenar los horarios de más temprano a más tarde
      buses[routeShortName].horarios.sort((a, b) => a.llegada.localeCompare(b.llegada));
      // Importa la biblioteca moment-timezone
      const moment = require('moment-timezone');

      // Obtén la hora actual en la zona horaria de Madrid
      const now = moment().tz("Europe/Madrid");
      const nowFormatted = now.format('HH:mm:ss');

      // Calcular el tiempo restante hasta el próximo horario
      // TODO: Calcular también cuando el proximo horario es al día siguiente
      const nextHorario = buses[routeShortName].horarios.find(horario => horario.llegada > nowFormatted);
      if (nextHorario && nextHorario.llegada) {
        const nowHoursMinutesSeconds = nowFormatted.split(':').map(Number);
        const nextHorarioHoursMinutesSeconds = nextHorario.llegada.split(':').map(Number);
        const tiempoRestante = ((nextHorarioHoursMinutesSeconds[0] - nowHoursMinutesSeconds[0]) * 60 * 60
          + (nextHorarioHoursMinutesSeconds[1] - nowHoursMinutesSeconds[1]) * 60
          + (nextHorarioHoursMinutesSeconds[2] - nowHoursMinutesSeconds[2])) / 60;
        buses[routeShortName].tiempoRestante = Math.round(tiempoRestante);
      } else {
        buses[routeShortName].tiempoRestante = null;
      }
    }
  }

  // Convertir el objeto buses a una matriz
  buses = Object.values(buses);

  return {
    parada: {
      nombre: stopInfo[0].stop_name,
      numero: stopInfo[0].stop_code
    },
    buses: buses
  };
}

const NodeCache = require('node-cache');
const myCache = new NodeCache({ stdTTL: 600 }); // Caché con un TTL de 60 segundos

async function actualizarDatos() {
  try{
    await gtfs.updateGtfsRealtime(config);

    // Recuperar los datos actualizados
    const stopTimesUpdates = await getStoptimesUpdates();

    // Fusionar con los datos del caché
    const cacheKey = 'stopTimesUpdates';
    const cachedUpdates = myCache.get(cacheKey) || {};

    stopTimesUpdates.forEach(update => {
      // Crear una clave única para cada actualización
      const uniqueKey = `${update.trip_id}-${update.stop_sequence}`;

      // Almacenar o actualizar la información en el caché
      cachedUpdates[uniqueKey] = update;
    });

    // Almacenar los datos fusionados en el caché
    myCache.set(cacheKey, cachedUpdates);

    return 'OK';
  } catch (error) {
    console.error('Error al actualizar datos GTFS Realtime:', error);

    return 'Error al actualizar los datos: '+ error;
  }
}

async function obtenerDatosRTCacheados() {
  const cacheKey = 'stopTimesUpdates';
  let datos = myCache.get(cacheKey);

  if (!datos) {
    // Si no hay datos en el caché, actualiza los datos y llena el caché
    await actualizarDatos();
    datos = myCache.get(cacheKey);
  }

  // Ahora 'datos' contiene la información más reciente, ya sea del caché o recién actualizada

  // Convertir los datos del objeto a un array
  return Object.values(datos);
}

main();

module.exports = { main, gtfs, mostrarTiempoProgramado, mostrarTiemposDeLlegadaParaParada, mostrarParadas, mostrarLineas, actualizarDatos };