require('dotenv').config();
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const helmet = require('helmet');

// Inicializar app
const app = express();

// Configuración de base de datos
const db = require('./config/db');

// Configuración de Passport
require('./config/passport');

// Middlewares globales
app.use(helmet());
app.use(cors({
  origin: process.env.APP_URL, // e.g., http://localhost:5173
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar store de sesiones en MySQL
const sessionStoreOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 604800000 // 7 días
};
const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(session({
  key: 'vacation_system_cookie',
  secret: process.env.SESSION_SECRET || 'secret_fallback',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 días
  }
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const requestRoutes = require('./routes/requestRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Definir endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/reports', reportRoutes);

// Ruta base
app.get('/api', (req, res) => {
  res.json({ message: 'Bienvenido a la API del Sistema de Vacaciones MAR Fund' });
});

// Arrancar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV}`);
});
