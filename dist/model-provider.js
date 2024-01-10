import { jsx as _jsx } from "ai-jsx/jsx-runtime";
import { ChatProvider, CompletionProvider } from 'ai-jsx/core/completion';
import { AssistantMessage, renderToConversation } from 'ai-jsx/core/conversation';
import { AIJSXError, ErrorCode } from 'ai-jsx/core/errors';
import * as AI from 'ai-jsx';
import { debugRepresentation } from 'ai-jsx/core/debug';
import _ from 'lodash';
export const isModelProviderApiChatArgs = (args) => Object.prototype.hasOwnProperty.call(args, 'messages');
export const isModelProviderApiCompletionArgs = (args) => Object.prototype.hasOwnProperty.call(args, 'prompt');
export const LLM_QUERY_TYPE = {
    CHAT: 'chat',
    COMPLETION: 'completion'
};
const mapModelPropsToArgs = (props) => {
    return {
        model: props.model,
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
const QueryLlmContext = AI.createContext({ queryLlm: () => { throw 'function queryLlm is not defined'; }, chunkDecoder: () => { throw 'function chunkDecoder is not defined'; } });
const getResponseStreamConsumer = (queryType, iterator, chunkDecoder, logger) => async () => {
    // Eat any empty chunks, typically seen at the beginning of the stream.
    let next;
    let nextValue;
    do {
        next = await iterator.next();
        if (next.done) {
            return null;
        }
        nextValue = chunkDecoder(next.value, queryType);
    } while (!nextValue);
    logger.trace({ message: next.value }, 'Got message');
    return nextValue;
};
export async function* ModelProviderChatModel(props, { render, logger, memo, getContext }) {
    yield AI.AppendOnlyStream;
    const messageElements = await renderToConversation(props.children, render, logger, 'prompt');
    if (messageElements.find((e) => e.type == 'functionCall')) {
        throw new AIJSXError('ModelProvider does not support <FunctionCall>. Please use <SystemMessage> instead.', ErrorCode.Llama2DoesNotSupportFunctionCalls, 'user');
    }
    if (messageElements.find((e) => e.type == 'functionResponse')) {
        throw new AIJSXError('ModelProvider does not support <FunctionResponse>. Please use <SystemMessage> instead.', ErrorCode.Llama2DoesNotSupportFunctionResponse, 'user');
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
    const { queryLlm, chunkDecoder } = getContext(QueryLlmContext);
    const chatResponse = await queryLlm(LLM_QUERY_TYPE.CHAT, chatCompletionRequest, logger);
    const outputMessages = [];
    if (chatResponse) {
        const iterator = chatResponse[Symbol.asyncIterator]();
        const advance = getResponseStreamConsumer(LLM_QUERY_TYPE.CHAT, iterator, chunkDecoder, logger);
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
export async function* ModelProviderCompletionModel(props, { render, logger, memo, getContext }) {
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
    const { queryLlm, chunkDecoder } = getContext(QueryLlmContext);
    const response = await queryLlm(LLM_QUERY_TYPE.COMPLETION, llama2Args, logger);
    if (response) {
        const iterator = response[Symbol.asyncIterator]();
        const advance = getResponseStreamConsumer(LLM_QUERY_TYPE.COMPLETION, iterator, chunkDecoder, 
        // (chunk) => typeof chunk.value === 'string' ? chunk.value : JSON.parse(new TextDecoder().decode(chunk.value)).response,
        logger);
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
export function ModelProvider({ children, queryLlm, chunkDecoder, chatModel = ModelProviderChatModel, completionModel = ModelProviderCompletionModel, ...defaults }, { getContext }) {
    return (_jsx(QueryLlmContext.Provider, { value: { queryLlm, chunkDecoder }, children: _jsx(ChatProvider, { component: chatModel, ...defaults, children: _jsx(CompletionProvider, { component: completionModel, ...defaults, children: children }) }) }));
}
