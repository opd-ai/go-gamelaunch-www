fmt:
	find . -name '*.go' -not -path './vendor/*' -exec gofumpt -extra -s -w {} \;
	find . -name '*.js' -not -path './vendor/*' -exec prettier --write {} \;

prompt: fmt
	code2prompt --output prompt.md .

godoc:
	godocdown -o pkg/webui/DOC.md pkg/webui