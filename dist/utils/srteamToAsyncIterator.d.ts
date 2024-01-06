/// <reference types="node" resolution-mode="require"/>
import { ReadableStream } from "stream/web";
export declare function streamAsyncIterator(stream: ReadableStream): {
    next(): Promise<import("stream/web").ReadableStreamDefaultReadResult<any>>;
    return(): {};
    [Symbol.asyncIterator](): any;
};
