import { ModelPropsWithChildren } from 'ai-jsx/core/completion';
import * as AI from 'ai-jsx';
/**
 * Model parameters
 *
 * @see https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
 */
interface OllamaModelOptions {
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
type OllamaModalPropsBase = ModelPropsWithChildren & Omit<OllamaModelOptions, 'mirostat_eta' | 'mirostat_tau' | 'num_ctx' | 'num_gqa' | 'num_gpu' | 'num_thread' | 'repeat_last_n' | 'repeat_penalty' | 'tfs_z' | 'num_predict' | 'top_k' | 'top_p'>;
interface OllamaModelProps extends OllamaModalPropsBase {
    model?: string;
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
}
export declare function OllamaChatModel(props: OllamaModelProps, { render, logger, memo }: AI.ComponentContext): AI.RenderableStream;
/**
 * Don't use this directly. Instead, wrap your `<Completion>` element in `<Ollama>`.
 *
 * @hidden
 */
export declare function OllamaCompletionModel(props: OllamaModelProps, { render, logger, memo }: AI.ComponentContext): AI.RenderableStream;
/**
 * This component causes all children `ChatCompletion` and `Completion` components to use Ollama.
 *
 * You must set env var OLLAMA_API_BASE.
 *
 * Drawbacks to Llama2:
 *  * No support for functions
 */
export declare function Ollama({ children, ...defaults }: OllamaModelProps): import("ai-jsx/jsx-runtime").JSX.Element;
export declare function OllamaImage({ url }: {
    url: string;
}): Promise<string>;
export {};
