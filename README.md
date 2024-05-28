# multi-zopflipng

parallel zopflipng

## Usage

```
$ .\multi-zopflipng.exe --help
multi-zopflipng

ARGUMENTS:
  <glob> - Glob pattern to match files

OPTIONS:
  --concurrency, -c <number> - Number of parallel processes to run [optional]
  --iterations <number>      - number of iterations, more iterations makes it slower but provides slightly better compression. Default: 15 for small files, 5 for large files. [optional]
  --filters <str>            - filter strategies to try:
   0-4: give all scanlines PNG filter type 0-4
   m: minimum sum
   e: entropy
   p: predefined (keep from input, this likely overlaps another strategy)
   b: brute force (experimental)
   By default, if this argument is not given, one that is most likely the best for this image is chosen by trying faster compression with each type.
   If this argument is used, all given filter types are tried with slow compression and the best result retained. A good set of filters to try is --filters=0me. [optional]
  --keepchunks <str>         - keep metadata chunks with these names that would normally be removed, e.g. tEXt,zTXt,iTXt,gAMA, ...
   Due to adding extra data, this increases the result size. Keeping bKGD or sBIT chunks may cause additional worse compression due to forcing a certain color type, it is advised to not keep these for web images because web browsers do not use these chunks. By default ZopfliPNG only keeps (and losslessly modifies) the following chunks because they are essential: IHDR, PLTE, tRNS, IDAT and IEND. [optional]

FLAGS:
  --m, -m             - compress more: use more iterations (depending on file size)
  --lossy_transparent - remove colors behind alpha channel 0. No visual difference, removes hidden information.
  --lossy_8bit        - convert 16-bit per channel image to 8-bit per channel.
  --q, -q             - use quick, but not very good, compression (e.g. for only trying the PNG filter and color types)
  --debug, -d         - print debug information
  --help, -h          - show help
```

## build

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## License

[Zlib License](LICENSE)
