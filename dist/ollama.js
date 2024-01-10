import { jsx as _jsx } from "ai-jsx/jsx-runtime";
import { LLM_QUERY_TYPE, ModelProvider } from "./model-provider.js";
import { streamToAsyncIterator } from "./utils/srteamToAsyncIterator.js";
const AI_JSX_OLLAMA_API_BASE = process.env.AI_JSX_OLLAMA_API_BASE ?? 'http://127.0.0.1:11434/api';
/**
 * Run a model model on Ollama.
 */
async function doQueryLlm(queryType, input, logger) {
    logger.debug({ model: input.model, input }, 'Calling model');
    const controller = new AbortController();
    try {
        const apiEndpoint = `${AI_JSX_OLLAMA_API_BASE}${queryType === LLM_QUERY_TYPE.CHAT ? '/chat' : '/generate'}`;
        const response = await fetch(apiEndpoint, {
            method: 'post',
            signal: controller.signal,
            body: JSON.stringify(input)
        });
        if (!response.ok || !response.body) {
            throw await response.text();
        }
        return streamToAsyncIterator(response.body);
    }
    catch (ex) {
        controller.abort();
        console.error(`${ex}`);
    }
}
const chunkDecoder = (chunk, queryType) => {
    if (typeof chunk === 'string') {
        return chunk;
    }
    else {
        if (queryType === LLM_QUERY_TYPE.CHAT) {
            return JSON.parse(new TextDecoder().decode(chunk)).message.content;
        }
        else {
            return JSON.parse(new TextDecoder().decode(chunk)).response;
        }
    }
};
export const Ollama = ({ children, model, ...defaults }) => {
    return (_jsx(ModelProvider, { queryLlm: doQueryLlm, chunkDecoder: chunkDecoder, model: model ?? "llama2", children: children }));
};
