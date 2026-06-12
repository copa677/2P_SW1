# Etapa de compilación
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Etapa de ejecución
FROM nginx:alpine
COPY --from=build /app/dist/front2/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY certs /etc/nginx/certs
EXPOSE 4200
CMD ["nginx", "-g", "daemon off;"]
