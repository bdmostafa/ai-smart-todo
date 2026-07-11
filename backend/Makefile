.PHONY: build-TodoFunction

build-TodoFunction:
	npm ci
	npm run build
	cp -r dist $(ARTIFACTS_DIR)/
	cp package.json $(ARTIFACTS_DIR)/
	cp package-lock.json $(ARTIFACTS_DIR)/
	cd $(ARTIFACTS_DIR) && npm ci --omit=dev
