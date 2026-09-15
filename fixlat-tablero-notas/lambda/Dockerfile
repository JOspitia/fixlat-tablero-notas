FROM node:20-alpine

WORKDIR /var/task

# Copiar manifiestos e instalar todas las dependencias (incluidas devDependencies para compilar)
COPY package*.json tsconfig.json ./
RUN npm install

# Copiar el código fuente TypeScript y compilar
COPY app.ts ./
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
