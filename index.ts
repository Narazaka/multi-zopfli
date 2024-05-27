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
    },
    handler: async (args) => {
        const queue = new PQueue({concurrency: args.concurrency, autoStart: false});
        const sizes: {[input: string]: {beforeSize: number; afterSize?: number}} = {};
        for await (const entry of globbyStream(slash(args.glob), {onlyFiles: true})) {
            if (path.extname(entry as string) !== ".png") continue;
            const input = entry as string;
            const output = input.replace(/\.png$/, ".zopfli.png");
            const beforeSize = fs.statSync(input).size;
            sizes[input] = {beforeSize};
            queue.add(() =>
                new Promise<void>((resolve, reject) => {
                    console.warn(`Optimizing [${filesize(beforeSize).human()}] ${input}`);
                    execFile(zopflipng, ['-m', '--lossy_transparent', input, output], (err) => {
                        if (err) return reject(err);
                        fs.renameSync(output, input);
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
