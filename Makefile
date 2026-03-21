fmt:
	find . -name '*.go' -not -path './vendor/*' -exec gofumpt -extra -s -w {} \;
	find . -name '*.js' -not -path './vendor/*' -exec prettier --write {} \;

wasm:
	GOOS=js GOARCH=wasm go build -o static/gamelaunch.wasm ./cmd/gamelaunch-wasm
	@if [ ! -f static/wasm_exec.js ]; then \
		GOROOT=$$(go env GOROOT); \
		if [ -f "$$GOROOT/misc/wasm/wasm_exec.js" ]; then \
			cp "$$GOROOT/misc/wasm/wasm_exec.js" static/wasm_exec.js; \
		elif [ -f "$$GOROOT/lib/wasm/wasm_exec.js" ]; then \
			cp "$$GOROOT/lib/wasm/wasm_exec.js" static/wasm_exec.js; \
		else \
			echo "Warning: wasm_exec.js not found in $$GOROOT/misc/wasm or $$GOROOT/lib/wasm"; \
		fi; \
	fi

prompt: fmt
	code2prompt --output prompt.md .

godoc:
	godocdown -o pkg/webui/DOC.md pkg/webui