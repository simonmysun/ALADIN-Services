.PHONY: build test lint start clean compile-schemas

prep:
	npm i

build:
	npm run build

test:
	npm run test

lint:
	npm run prettier
	npm run lint

start:
	docker compose up -d
	npm run dev

clean:
	rm -rf dist/ test/coverage/ test/results/ node_modules/

compile-schemas:
	npm run compile-schemas
