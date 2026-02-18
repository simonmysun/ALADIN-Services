SERVICES := $(wildcard services/*)
PACKAGES := $(wildcard packages/*/*)
ALL := $(SERVICES) $(PACKAGES)

.PHONY: prep build test lint clean help

## prep: Prep all services and packages
prep:
	for dir in $(ALL); do $(MAKE) -C $$dir prep || exit 1; done

## build: Build all services and packages
build:
	for dir in $(ALL); do $(MAKE) -C $$dir build || exit 1; done

## test: Run tests for all services and packages
test:
	for dir in $(ALL); do $(MAKE) -C $$dir test || exit 1; done

## lint: Lint all services and packages
lint:
	for dir in $(ALL); do $(MAKE) -C $$dir lint || exit 1; done

## clean: Clean build artifacts for all services and packages
clean:
	for dir in $(ALL); do $(MAKE) -C $$dir clean || exit 1; done

## help: Print this help message
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## //'
