FROM node:12.13.1-alpine

RUN mkdir -p /appDir
RUN chown -R node /appDir
USER node
WORKDIR /appDir

COPY . .

RUN npm ci

EXPOSE 9000

# we're using numeric user to fit kubernetes. this is the same node user
USER 1000
CMD ["node", "index.js"]