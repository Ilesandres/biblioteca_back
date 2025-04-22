FROM node:16-alpine

WORKDIR /app
#copiar archivos necesarios para las dependencias antes de copiar los demas archivos
COPY package.json package-lock.json ./

#instalar dependencias para bcrypt
RUN apk add --no-cache python3 make g++

#instalar demas dependencias
RUN npm install

#copyar los demas archivos
COPY . .

#asegurarse que bcrypt se ejecuta en el contenedor
RUN npm rebuild bcrypt --build-from-source

#esponer un puerto
EXPOSE 3005

CMD ["npm","start"]