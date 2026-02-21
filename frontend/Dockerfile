FROM node:20-alpine
WORKDIR /app

# Instalar dependencias primero para aprovechar caché
COPY package*.json ./
RUN npm install

# Copiar el resto y compilar
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Ojo: Servir la app de forma estática pura
RUN npm install -g serve
EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
