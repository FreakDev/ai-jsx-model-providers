import { jsx as _jsx } from "ai-jsx/jsx-runtime";
import { ChatProvider, CompletionProvider } from 'ai-jsx/core/completion';
import { AssistantMessage, renderToConversation } from 'ai-jsx/core/conversation';
import { AIJSXError, ErrorCode } from 'ai-jsx/core/errors';
import * as AI from 'ai-jsx';
import { debugRepresentation } from 'ai-jsx/core/debug';
import fetch from 'node-fetch';
import _ from 'lodash';
import { promises as fs } from 'fs';
const isOllamaApiChatArgs = (args) => Object.prototype.hasOwnProperty.call(args, 'messages');
const isOllamaApiCompletionArgs = (args) => Object.prototype.hasOwnProperty.call(args, 'prompt');
const mapModelPropsToArgs = (props) => {
    return {
        model: props.model ?? 'llama2',
        stream: props.stream,
        options: Object.keys(props).length > 0 ? {
            mirostat: props.mirostat,
            mirostat_eta: props.mirostatEta,
            mirostat_tau: props.mirostatTau,
            num_ctx: props.numCtx,
            num_gqa: props.numGqa,
            num_gpu: props.numGpu,
            num_thread: props.numThread,
            repeat_last_n: props.repeatLastN,
            repeat_penalty: props.repeatPenalty,
            temperature: props.temperature,
            seed: props.seed,
            stop: props.stop,
            tfs_z: props.tfsZ,
            num_predict: props.numPredict,
            top_k: props.topK,
            top_p: props.topP,
        } : undefined
    };
};
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434/api';
/**
 * Run a model model on Ollama.
 */
async function doOllamaRequest(input, logger) {
    logger.debug({ model: input.model, input }, 'Calling model');
    const controller = new AbortController();
    try {
        const apiEndpoint = `${OLLAMA_API_BASE}${isOllamaApiChatArgs(input) ? '/chat' : '/generate'}`;
        const response = await fetch(apiEndpoint, {
            method: 'post',
            signal: controller.signal,
            body: JSON.stringify(input)
        });
        if (!response.ok || !response.body) {
            throw await response.text();
        }
        return response.body;
    }
    catch (ex) {
        controller.abort();
        console.error(`${ex}`);
    }
}
export async function* OllamaChatModel(props, { render, logger, memo }) {
    yield AI.AppendOnlyStream;
    const messageElements = await renderToConversation(props.children, render, logger, 'prompt');
    if (messageElements.find((e) => e.type == 'functionCall')) {
        throw new AIJSXError('Ollama does not support <FunctionCall>. Please use <SystemMessage> instead.', ErrorCode.Llama2DoesNotSupportFunctionCalls, 'user');
    }
    if (messageElements.find((e) => e.type == 'functionResponse')) {
        throw new AIJSXError('Ollama does not support <FunctionResponse>. Please use <SystemMessage> instead.', ErrorCode.Llama2DoesNotSupportFunctionResponse, 'user');
    }
    const messages = _.compact(await Promise.all(messageElements.map(async (message) => {
        switch (message.type) {
            case 'system':
                return {
                    role: 'system',
                    content: await render(message.element),
                };
            case 'user':
                return {
                    role: 'user',
                    content: await render(message.element),
                };
            case 'assistant':
                return {
                    role: 'assistant',
                    content: await render(message.element),
                };
        }
    })));
    if (!messages.length) {
        throw new AIJSXError("ChatCompletion must have at least one child that's a SystemMessage, UserMessage, AssistantMessage but no such children were found.", ErrorCode.ChatCompletionMissingChildren, 'user');
    }
    yield AI.AppendOnlyStream;
    const chatCompletionRequest = {
        ...mapModelPropsToArgs(props),
        messages,
    };
    const chatResponse = await doOllamaRequest(chatCompletionRequest, logger);
    const outputMessages = [];
    if (chatResponse) {
        const iterator = chatResponse[Symbol.asyncIterator]();
        async function advance() {
            // Eat any empty chunks, typically seen at the beginning of the stream.
            let next;
            let nextValue;
            do {
                next = await iterator.next();
                if (next.done) {
                    return null;
                }
                nextValue = typeof next.value === 'string' ? next.value : JSON.parse(next.value.toString('utf-8'));
            } while (!nextValue.message.content);
            logger.trace({ message: next.value }, 'Got message');
            return nextValue.message;
        }
        let token = await advance();
        while (token !== null) {
            if (token.content) {
                // Memoize the stream to ensure it renders only once.
                let accumulatedContent = '';
                let complete = false;
                const Stream = async function* () {
                    yield AI.AppendOnlyStream;
                    while (token !== null) {
                        if (token.content) {
                            accumulatedContent += token.content;
                            yield token.content;
                        }
                        token = await advance();
                    }
                    complete = true;
                    return AI.AppendOnlyStream;
                };
                const assistantMessage = memo(_jsx(AssistantMessage, { children: _jsx(Stream, { ...debugRepresentation(() => `${accumulatedContent}${complete ? '' : '▮'}`) }) }));
                yield assistantMessage;
                // Ensure the assistant stream is flushed by rendering it.
                await render(assistantMessage);
                outputMessages.push(assistantMessage);
                if (token !== null) {
                    token = await advance();
                }
            }
        }
    }
    // Render it so that the conversation is logged.
    await renderToConversation(outputMessages, render, logger, 'completion');
    return AI.AppendOnlyStream;
}
/**
 * Don't use this directly. Instead, wrap your `<Completion>` element in `<Ollama>`.
 *
 * @hidden
 */
export async function* OllamaCompletionModel(props, { render, logger, memo }) {
    yield AI.AppendOnlyStream;
    async function buildPromptFromNodes(children) {
        const { textNodes, imageNodes } = children?.reduce((nodes, child) => {
            // @ts-ignore
            if (child && child.tag && child.tag.name === 'OllamaImage') {
                return {
                    textNodes: [...nodes.textNodes, `[img-${nodes.imageNodes.length}]`],
                    imageNodes: [...nodes.imageNodes, child]
                };
            }
            return {
                textNodes: [...nodes.textNodes, child],
                imageNodes: nodes.imageNodes
            };
        }, { textNodes: [], imageNodes: [] });
        return {
            prompt: await render(textNodes),
            images: await Promise.all(imageNodes.map((node) => render(node)))
        };
    }
    let prompt = { prompt: '' };
    if (_.isArray(props.children)) {
        prompt = await buildPromptFromNodes(props.children);
    }
    else {
        prompt = { prompt: await render(props.children) };
    }
    const llama2Args = {
        ...mapModelPropsToArgs(props),
        ...prompt,
    };
    logger.debug({ llama2Args }, 'Calling Ollama');
    const response = await doOllamaRequest(llama2Args, logger);
    if (response) {
        const iterator = response[Symbol.asyncIterator]();
        async function advance() {
            // Eat any empty chunks, typically seen at the beginning of the stream.
            let next;
            let nextValue;
            do {
                next = await iterator.next();
                if (next.done) {
                    return null;
                }
                nextValue = typeof next.value === 'string' ? next.value : JSON.parse(next.value.toString('utf-8'));
            } while (!nextValue.response);
            logger.trace({ message: next.value }, 'Got message');
            return nextValue.response;
        }
        let token = await advance();
        while (token !== null) {
            if (token) {
                // Memoize the stream to ensure it renders only once.
                let accumulatedContent = '';
                let complete = false;
                const Stream = async function* () {
                    yield AI.AppendOnlyStream;
                    while (token !== null) {
                        if (token) {
                            accumulatedContent += token;
                            yield token;
                        }
                        token = await advance();
                    }
                    complete = true;
                    return AI.AppendOnlyStream;
                };
                const reponseMessage = memo(_jsx(Stream, { ...debugRepresentation(() => `${accumulatedContent}${complete ? '' : '▮'}`) }));
                yield reponseMessage;
                // Ensure the response stream is flushed by rendering it.
                await render(reponseMessage);
                if (token !== null) {
                    token = await advance();
                }
            }
        }
    }
    return AI.AppendOnlyStream;
}
/**
 * This component causes all children `ChatCompletion` and `Completion` components to use Ollama.
 *
 * You must set env var OLLAMA_API_BASE.
 *
 * Drawbacks to Llama2:
 *  * No support for functions
 */
export function Ollama({ children, ...defaults }) {
    return (_jsx(ChatProvider, { component: OllamaChatModel, ...defaults, children: _jsx(CompletionProvider, { component: OllamaCompletionModel, ...defaults, children: children }) }));
}
export async function OllamaImage({ url }) {
    return await fs.readFile(url, { encoding: 'base64' });
}
