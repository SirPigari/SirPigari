# Portfolio

how to build wasm:

```console
cd ./wasm-raylib
emcc main.c ./libraylib.a -o main.html -O3 -std=gnu99 -s USE_GLFW=3 -s ALLOW_MEMORY_GROWTH=1 -s WASM=1 -I /usr/include -DPLATFORM_WEB -sASYNCIFY  -sASSERTIONS=1 -sEXPORTED_FUNCTIONS='["_main","_updateMousePosition","_toggleDebugMode"]' -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]'
```

to run a local server:

```console
cd ..
python3 -m http.server
```
