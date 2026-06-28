require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// API Routes
// ========================

// GET /api/stations — все заправки (без фото для скорости)
app.get('/api/stations', async (req, res) => {
  try {
    const stations = await prisma.station.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        lat: true,
        lng: true,
        priceAi92: true,
        priceAi95: true,
        priceAi98: true,
        priceDt: true,
        createdAt: true,
        updatedAt: true,
        // photoBase64 excluded for performance
      },
      orderBy: { createdAt: 'desc' }
    });

    // Добавляем флаг hasPhoto через отдельный запрос
    const stationsWithPhotoFlag = await Promise.all(
      stations.map(async (s) => {
        const hasPhoto = await prisma.station.count({
          where: { id: s.id, photoBase64: { not: null } }
        });
        return { ...s, hasPhoto: hasPhoto > 0 };
      })
    );

    res.json(stationsWithPhotoFlag);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Ошибка загрузки заправок' });
  }
});

// GET /api/stations/:id — одна заправка (с фото)
app.get('/api/stations/:id', async (req, res) => {
  try {
    const station = await prisma.station.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!station) {
      return res.status(404).json({ error: 'Заправка не найдена' });
    }

    res.json(station);
  } catch (error) {
    console.error('Error fetching station:', error);
    res.status(500).json({ error: 'Ошибка загрузки заправки' });
  }
});

// POST /api/stations — добавить заправку
app.post('/api/stations', async (req, res) => {
  try {
    const { name, address, lat, lng, priceAi92, priceAi95, priceAi98, priceDt, photoBase64 } = req.body;

    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Название и координаты обязательны' });
    }

    const hasPrices = [priceAi92, priceAi95, priceAi98, priceDt].some(p => p !== null && p !== undefined);
    if (!hasPrices) {
      return res.status(400).json({ error: 'Введите хотя бы одну цену' });
    }

    const station = await prisma.station.create({
      data: {
        name,
        address: address || '',
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        priceAi92: priceAi92 ? parseFloat(priceAi92) : null,
        priceAi95: priceAi95 ? parseFloat(priceAi95) : null,
        priceAi98: priceAi98 ? parseFloat(priceAi98) : null,
        priceDt: priceDt ? parseFloat(priceDt) : null,
        photoBase64: photoBase64 || null
      }
    });

    // Возвращаем без фото
    const { photoBase64: _, ...stationWithoutPhoto } = station;
    res.status(201).json({ ...stationWithoutPhoto, hasPhoto: !!station.photoBase64 });
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Ошибка сохранения заправки' });
  }
});

// SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Zapravki server running on port ${PORT}`);
  console.log(`📍 Open http://localhost:${PORT}`);
});
