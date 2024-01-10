import { ModelComponent, ModelPropsWithChildren } from 'ai-jsx/core/completion';
import * as AI from 'ai-jsx';
import { streamToAsyncIterator } from './utils/srteamToAsyncIterator.js';
/**
 * Base 64 encoded image
 */
type LlavaImageArg = string;
/**
 * Model parameters
 *
 * @see https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
 */
interface ModelProviderOptions {
    mirostat?: number;
    mirostat_eta?: number;
    mirostat_tau?: number;
    num_ctx?: number;
    num_gqa?: number;
    num_gpu?: number;
    num_thread?: number;
    repeat_last_n?: number;
    repeat_penalty?: number;
    temperature?: number;
    seed?: number;
    stop?: string;
    tfs_z?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
}
interface ModelProviderChatMessage {
    role: string;
    content: string;
    images?: LlavaImageArg[];
}
interface ModelProviderApiBaseArgs {
    model: string;
    options?: ModelProviderOptions;
    stream?: boolean;
}
/**
 * Arguments to the Ollama's completion API.
 *
 * @see https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-completion
 */
interface ModelProviderApiCompletionArgs extends ModelProviderApiBaseArgs {
    prompt: string;
    images?: LlavaImageArg[];
    context?: number[];
}
/**
 * Arguments to the Ollama's chat completion API.
 *
 * @see https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */
interface ModelProviderApiChatArgs extends ModelProviderApiBaseArgs {
    messages: ModelProviderChatMessage[];
}
export type ModelProviderApiArgs = ModelProviderApiChatArgs | ModelProviderApiCompletionArgs;
export declare const isModelProviderApiChatArgs: (args: ModelProviderApiArgs) => args is ModelProviderApiChatArgs;
export declare const isModelProviderApiCompletionArgs: (args: ModelProviderApiArgs) => args is ModelProviderApiCompletionArgs;
export type ModalProviderPropsBase = ModelPropsWithChildren & Omit<ModelProviderOptions, 'mirostat_eta' | 'mirostat_tau' | 'num_ctx' | 'num_gqa' | 'num_gpu' | 'num_thread' | 'repeat_last_n' | 'repeat_penalty' | 'tfs_z' | 'num_predict' | 'top_k' | 'top_p'> & {
    model: string;
    mirostatEta?: number;
    mirostatTau?: number;
    numCtx?: number;
    numGqa?: number;
    numGpu?: number;
    numThread?: number;
    repeatLastN?: number;
    repeatPenalty?: number;
    tfsZ?: number;
    numPredict?: number;
    topK?: number;
    topP?: number;
    stream?: boolean;
};
export declare const LLM_QUERY_TYPE: {
    readonly CHAT: "chat";
    readonly COMPLETION: "completion";
};
export type LlmQueryType = typeof LLM_QUERY_TYPE[keyof typeof LLM_QUERY_TYPE];
type QureryLlmFunction = (queryType: LlmQueryType, input: ModelProviderApiArgs, logger: AI.ComponentContext['logger']) => Promise<ReturnType<typeof streamToAsyncIterator> | undefined>;
export type StreamedChunk = ArrayBuffer | string;
export type ChunkDecoder = (chunk: StreamedChunk, responseType: LlmQueryType) => string;
export declare function ModelProviderChatModel(props: ModalProviderPropsBase, { render, logger, memo, getContext }: AI.ComponentContext): AI.RenderableStream;
/**
 * Don't use this directly. Instead, wrap your `<Completion>` element in `<Ollama>`.
 *
 * @hidden
 */
export declare function ModelProviderCompletionModel(props: ModalProviderPropsBase, { render, logger, memo, getContext }: AI.ComponentContext): AI.RenderableStream;
interface ModelProviderProps extends ModalProviderPropsBase {
    queryLlm: QureryLlmFunction;
    chunkDecoder: ChunkDecoder;
    chatModel?: ModelComponent<ModalProviderPropsBase>;
    completionModel?: ModelComponent<ModalProviderPropsBase>;
}
/**
 * This component causes all children `ChatCompletion` and `Completion` components to use Ollama.
 *
 * You must set env var OLLAMA_API_BASE.
 *
 * Drawbacks to Llama2:
 *  * No support for functions
 */
export declare function ModelProvider({ children, queryLlm, chunkDecoder, chatModel, completionModel, ...defaults }: ModelProviderProps, { getContext }: AI.RenderContext): import("ai-jsx/jsx-runtime").JSX.Element;
export {};
