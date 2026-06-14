# kbcf-clipper — common tasks. Targets use the project venv at .venv.
VENV ?= .venv
BIN  := $(VENV)/bin
PY   := $(BIN)/python

.DEFAULT_GOAL := help

.PHONY: help setup setup-full doctor test demo latest run clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## macOS bootstrap (core deps + ffmpeg)
	./setup.sh

setup-full: ## macOS bootstrap incl. WhisperX + mediapipe (real render)
	./setup.sh --full

doctor: ## Check this machine is ready to run
	$(BIN)/kbcf-clipper doctor

test: ## Run the unit tests
	$(BIN)/pytest -q

demo: ## Offline end-to-end on the sample sermon (no ffmpeg/API needed)
	$(BIN)/kbcf-clipper run --from-transcript fixtures/sample_transcript.json --mock-score --no-render
	@echo "Open: output/transcript/index.html"

latest: ## Show the latest completed KBCF broadcast
	$(BIN)/kbcf-clipper latest

run: ## Full pipeline on the latest broadcast
	$(BIN)/kbcf-clipper run

clean: ## Remove generated output + caches
	rm -rf output/* .pytest_cache
	find src tests -name '__pycache__' -type d -prune -exec rm -rf {} +
	@echo cleaned
