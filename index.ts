import { command, run, string, number, flag, positional, option } from 'cmd-ts';
import PQueue from 'p-queue';
import {globbyStream} from 'globby';
import path from 'path';
import slash from 'slash';
import filesize from 'file-size';
import fs from 'fs';
import os from 'os';
import {execFile} from 'child_process';
import zopflipng from "zopflipng-bin";

function displaySize(beforeSize: number, afterSize: number) {
    return `${filesize(beforeSize).human()} -> ${filesize(afterSize).human()} / -${filesize(beforeSize - afterSize).human()} -${((1 - afterSize / beforeSize) * 100).toFixed(1)}%`;
}

const cmd = command({
    name: "multi-zopfli",
    args: {
        glob: positional({type: string, displayName: "glob", description: "Glob pattern to match files"}),
        concurrency: option({type: number, long: "concurrency", short: "c", description: "Number of parallel processes to run", defaultValue: () => Math.ceil(os.cpus().length / 2)}),
        m: flag({long: "m", short: "m", description: "compress more: use more iterations (depending on file size)"}),
        lossy_transparent: flag({long: "lossy_transparent", description: "remove colors behind alpha channel 0. No visual difference, removes hidden information."}),
        lossy_8bit: flag({long: "lossy_8bit", description: "convert 16-bit per channel image to 8-bit per channel."}),
        q: flag({long: "q", short: "q", description: "use quick, but not very good, compression (e.g. for only trying the PNG filter and color types)"}),
        iterations: option({type: number, long: "iterations", defaultValue: () => -1, description: "number of iterations, more iterations makes it slower but provides slightly better compression. Default: 15 for small files, 5 for large files."}),
        filters: option({
            type: string, long: "filters", defaultValue: () => "",
            description:
                "filter strategies to try:"
                + "\n   0-4: give all scanlines PNG filter type 0-4"
                + "\n   m: minimum sum"
                + "\n   e: entropy"
                + "\n   p: predefined (keep from input, this likely overlaps another strategy)"
                + "\n   b: brute force (experimental)"
                + "\n   By default, if this argument is not given, one that is most likely the best for this image is chosen by trying faster compression with each type."
                + "\n   If this argument is used, all given filter types are tried with slow compression and the best result retained. A good set of filters to try is --filters=0me."
        }),
        keepchunks: option({
            long: "keepchunks", type: string, defaultValue: () => "",
            description:
                "keep metadata chunks with these names that would normally be removed, e.g. tEXt,zTXt,iTXt,gAMA, ..."
                + "\n   Due to adding extra data, this increases the result size. Keeping bKGD or sBIT chunks may cause additional worse compression due to forcing a certain color type, it is advised to not keep these for web images because web browsers do not use these chunks. By default ZopfliPNG only keeps (and losslessly modifies) the following chunks because they are essential: IHDR, PLTE, tRNS, IDAT and IEND."
        }),
    },
    handler: async (args) => {
        const options: string[] = [];
        if (args.m) options.push("-m");
        if (args.lossy_transparent) options.push("--lossy_transparent");
        if (args.lossy_8bit) options.push("--lossy_8bit");
        if (args.q) options.push("-q");
        if (args.iterations !== -1) options.push(`--iterations=${args.iterations}`);
        if (args.filters) options.push(`--filters=${args.filters}`);
        if (args.keepchunks) options.push(`--keepchunks=${args.keepchunks}`);

        const queue = new PQueue({concurrency: args.concurrency, autoStart: false});
        const sizes: {[input: string]: {beforeSize: number; afterSize?: number}} = {};
        for await (const entry of globbyStream(slash(args.glob), {onlyFiles: true})) {
            if (path.extname(entry as string) !== ".png") continue;
            const input = entry as string;
            const beforeSize = fs.statSync(input).size;
            sizes[input] = {beforeSize};
            queue.add(() =>
                new Promise<void>((resolve, reject) => {
                    const allOptions = options.concat(['-y', input, input]);
                    console.warn([">", path.basename(zopflipng)].concat(allOptions).join(" "));
                    console.warn(`Optimizing [${filesize(beforeSize).human()}] ${input}`);
                    execFile(zopflipng, allOptions, (err) => {
                        if (err) return reject(err);
                        const afterSize = fs.statSync(input).size;
                        sizes[input].afterSize = afterSize;
                        console.warn(`Optimized [${displaySize(beforeSize, afterSize)}] ${input}`);
                        resolve();
                    });
                })
            );
        }
        queue.on("completed", () => {
            const {totalBeforeSize, totalAfterSize} = Object.values(sizes)
                .filter(({afterSize}) => afterSize != null)
                .reduce(
                    ({totalBeforeSize, totalAfterSize}, {beforeSize, afterSize}) => ({
                        totalBeforeSize: totalBeforeSize + beforeSize,
                        totalAfterSize: totalAfterSize + afterSize!,
                    }),
                {totalBeforeSize: 0, totalAfterSize: 0});
            console.warn(`Total optimized (${Object.values(sizes).filter(({afterSize}) => afterSize != null).length} / ${Object.keys(sizes).length}) [${displaySize(totalBeforeSize, totalAfterSize)}]`)
        });
        console.warn(`Total before optimized (${Object.keys(sizes).length}) [${filesize(Object.values(sizes).reduce((sum, {beforeSize}) => sum + beforeSize, 0)).human()}]`);
        queue.start();
        await queue;
    }
})

run(cmd, process.argv.slice(2));
