const express = require('express');
const { readFile } = require('fs').promises;
const path = require('path');
const { openDb, mostrarTiempoProgramado, mostrarTiemposDeLlegadaParaParada, mostrarLineas, mostrarParadas, actualizarDatos } = require('./index.js');
const cors = require('cors');

const app = express();

// Permitir todas las peticiones CORS
app.use(cors({ origin: '*' }));

(async () => {
    // Abre la conexión a la base de datos cuando la aplicación se inicia
    let gtfs;
    await import('gtfs').then(module => {
        gtfs = module;
    });
    const config = JSON.parse(
        await readFile(path.join(__dirname, './config.json'), 'utf-8')
    );
    const db = gtfs.openDb(config);

    app.get('/parada/:parada/:linea', async (req, res) => {
        const parada = req.params.parada;
        const linea = req.params.linea;
        try {
            // Pasa la conexión a la base de datos a mostrarTiempoProgramado
            const resultado = await mostrarTiempoProgramado(parada, linea);
            res.json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/parada/:parada', async (req, res) => {
        const parada = req.params.parada;
        try {
            // Pasa la conexión a la base de datos a mostrarTiempoProgramado
            const resultado = await mostrarTiempoProgramado(parada);
            res.json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/paradas', async (req, res) => {
        const paradas = await mostrarParadas();
        res.json(paradas);
    });
      
    app.get('/realtime/:parada', async (req, res) => {
        const parada = await mostrarTiemposDeLlegadaParaParada(req.params.parada);
        res.json(parada);
    });
      
    app.get('/lineas', async (req, res) => {
        const lineas = await mostrarLineas();
        res.json(lineas);
    });

    app.get('/actualizardatos', async (req, res) => {
        const datos = await actualizarDatos();
        res.json(datos);
    });

    app.listen(3333, () => {
        console.log('Server is running on port 3333');
    });

    // Iniciar la actualización periódica
    setInterval(() => {
        actualizarDatos()
        .then(resultado => console.log('Datos actualizados:', resultado))
        .catch(error => console.error('Error al actualizar datos:', error));
    }, 30000); 
})();