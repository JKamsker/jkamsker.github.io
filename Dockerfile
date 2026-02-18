FROM ruby:3.3.4-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/jekyll

# Match the Bundler version pinned in Gemfile.lock (BUNDLED WITH).
RUN gem install bundler:2.5.15

# Install gems with Docker layer caching.
COPY Gemfile Gemfile.lock ./
RUN bundle _2.5.15_ install --frozen

COPY . .

# Allow overriding the container command via docker-compose build args.
ARG build_command="bundle exec jekyll serve --host 0.0.0.0 --livereload --watch --force_polling"
ENV BUILD_COMMAND=${build_command}

EXPOSE 4000 35729

CMD sh -lc "$BUILD_COMMAND"
