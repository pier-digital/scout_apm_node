.PHONY: all dev-setup git-hook-install clean \
				check-tool-docker check-tool-yarn check-tool-entr \
				lint lint-watch build build-watch \
				test test-unit test-int test-e2e \
				test-dashboard-send test-integrations \
				ensure-docker-images ensure-pg-docker-image test-integration-pg \
				ensure-mysql-docker-image test-integration-mysql \
				generate-agent-configs

all: install build

YARN ?= yarn
NPM ?= npm
ENTR ?= entr
DEV_SCRIPTS ?= .dev/scripts
TAPE ?= ./node_modules/.bin/tape
DOCKER ?= docker

GIT_HOOKS_DIR = .dev/git/hooks

check-tool-entr:
	@which entr > /dev/null || (echo -e "\n[ERROR] please install entr (http://entrproject.org/)" && exit 1)

check-tool-yarn:
	@which yarn > /dev/null || (echo -e "\n[ERROR] please install yarn (http://yarnpkg.com/)" && exit 1)

check-tool-docker:
	@which docker > /dev/null || (echo -e "\n[ERROR] please install docker (http://docs.docker.com/)" && exit 1)

install:
	@echo -e "=> running yarn install..."
	$(YARN) install

git-hook-install:
	@echo -e "=> copying hooks from [$(GIT_HOOKS_DIR)] to [.git/hooks]..."
	cp -r $(GIT_HOOKS_DIR)/* .git/hooks

dist:
	@echo -e "=> creating dist directory..."
	mkdir -p dist

dev-setup: dist install git-hook-install

lint:
	$(YARN) lint

lint-watch: check-tool-entr
	find . -name "*.ts" | $(ENTR) -rc $(YARN) lint

build: dist
	$(YARN) build

build-watch: dist
	$(YARN) build-watch

clean:
	rm -rf dist/*

test: test-unit test-int test-e2e test-integrations

test-unit: check-tool-yarn
	$(YARN) test-unit

test-int: check-tool-yarn
	$(YARN) test-int

test-e2e: ensure-docker-images check-tool-docker check-tool-yarn
	$(YARN) test-e2e

test-dashboard-send: check-tool-yarn
	@echo -e "running a test that will send a test to the dashboard, it should take ~ 30 seconds to run..."
	$(YARN) test-dashboard-send

test-integrations: test-integration-pg test-integration-mysql

ensure-docker-images: ensure-mysql-docker-image ensure-pg-docker-image

PG_DOCKER_IMAGE ?= postgres:alpine
ensure-pg-docker-image:
	$(DOCKER) pull $(PG_DOCKER_IMAGE)

test-integration-pg:
	$(YARN) test-integration-pg

MYSQL_DOCKER_IMAGE ?= mysql:5.7.29
ensure-mysql-docker-image:
	$(DOCKER) pull $(MYSQL_DOCKER_IMAGE)

test-integration-mysql:
	$(YARN) test-integration-mysql

generate-agent-configs:
	$(DEV_SCRIPTS)/generate-download-configs.js lib/download-configs.ts
