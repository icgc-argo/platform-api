FROM node:12.13.1-alpine

ARG APP_FOLDER=/appDir
ENV APP_UID=1000
ENV APP_GID=1000
ARG APP_USER=node

RUN apk --no-cache add curl g++ make python3 shadow \
    && groupmod -g $APP_GID $APP_USER \
	&& usermod -u $APP_UID -g $APP_GID $APP_USER

WORKDIR $APP_FOLDER
RUN chown -R $APP_USER $APP_FOLDER

USER $APP_USER

COPY . .

RUN npm ci

EXPOSE 9000

CMD ["npm", "run", "start::prod"]