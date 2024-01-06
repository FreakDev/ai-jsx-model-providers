import { ChatProvider, CompletionProvider, ModelPropsWithChildren } from 'ai-jsx/core/completion';
import { AssistantMessage, renderToConversation } from 'ai-jsx/core/conversation';
import { AIJSXError, ErrorCode } from 'ai-jsx/core/errors';
import * as AI from 'ai-jsx';
import { debugRepresentation } from 'ai-jsx/core/debug';
import _ from 'lodash';
import { streamAsyncIterator } from './utils/srteamToAsyncIterator.js';

/**
 * Base 64 encoded image
 */
type LlavaImageArg = string 

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
  tfs_z?: number
  num_predict?: number;
  top_k?: number;
  top_p?: number;
}

interface OllamaChatMessage {
  role: string;
  content: string;
  images?: LlavaImageArg[];
}

interface OllamaApiBaseArgs {
  model: string
  options?: OllamaModelOptions;
  stream?: boolean
}

/**
 * Arguments to the Ollama's completion API.
 *
 * @see https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-completion
 */
interface OllamaApiCompletionArgs extends OllamaApiBaseArgs {
  prompt: string;
  images?: LlavaImageArg[];
  context?: number[];
}

/**
 * Arguments to the Ollama's chat completion API.
 *
 * @see https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */
interface OllamaApiChatArgs extends OllamaApiBaseArgs {
  messages: OllamaChatMessage[]
}

type OllamaApiArgs = OllamaApiChatArgs | OllamaApiCompletionArgs

const isOllamaApiChatArgs = (args: OllamaApiArgs): args is OllamaApiChatArgs => Object.prototype.hasOwnProperty.call(args, 'messages')
const isOllamaApiCompletionArgs = (args: OllamaApiArgs): args is OllamaApiCompletionArgs => Object.prototype.hasOwnProperty.call(args, 'prompt')

type OllamaModalPropsBase = ModelPropsWithChildren 
                            & Omit<OllamaModelOptions, 
                                    'mirostat_eta' | 
                                    'mirostat_tau' | 
                                    'num_ctx' | 
                                    'num_gqa' | 
                                    'num_gpu' | 
                                    'num_thread' | 
                                    'repeat_last_n' | 
                                    'repeat_penalty' | 
                                    'tfs_z' | 
                                    'num_predict' |
                                    'top_k' |
                                    'top_p'
                                  >
interface OllamaModelProps extends OllamaModalPropsBase {
  model?: string
  mirostatEta?: number;
  mirostatTau?: number;
  numCtx?: number;
  numGqa?: number;
  numGpu?: number;
  numThread?: number;
  repeatLastN?: number;
  repeatPenalty?: number;
  tfsZ?: number
  numPredict?: number;
  topK?: number;
  topP?: number;
  stream?:boolean;
}

interface OllamaResponseMessageChunkBase {
  model:string;
  created_at:string;
  done:boolean;
}

interface OllamaResponseLastMessageChunk extends OllamaResponseMessageChunkBase {
  total_duration:number;
  load_duration:number;
  prompt_eval_count:number;
  prompt_eval_duration:number;
  eval_count:number;
  eval_duration:number;
}

type OllamaCompletionResponseChunk = (OllamaResponseMessageChunkBase | OllamaResponseLastMessageChunk) & {
  response: string };

type OllamaChatResponseChunk = (OllamaResponseMessageChunkBase | OllamaResponseLastMessageChunk) & {
  message: {
  role: string;
  content: string;
} };


const mapModelPropsToArgs = (props: OllamaModelProps): Omit<OllamaApiArgs, 'promt' | 'messages'> => {
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
  }
}

const AI_JSX_OLLAMA_API_BASE = process.env.AI_JSX_OLLAMA_API_BASE ?? 'http://127.0.0.1:11434/api'

/**
 * Run a model model on Ollama.
 */
async function doOllamaRequest<ModelArgs extends OllamaApiArgs>(
  input: ModelArgs,
  logger: AI.ComponentContext['logger']
) {
  logger.debug({ model: input.model, input }, 'Calling model');

  const controller = new AbortController();
  try {
    const apiEndpoint = `${AI_JSX_OLLAMA_API_BASE}${isOllamaApiChatArgs(input) ? '/chat' : '/generate'}`

    const response = await fetch(apiEndpoint, { 
      method: 'post', 
      signal: controller.signal,
      body: JSON.stringify(input)
    })

    if (!response.ok || !response.body) {
      throw await response.text()
    }

    return streamAsyncIterator(response.body);

  } catch (ex) {
    controller.abort()
    console.error(`${ex}`)
  }
}

export async function* OllamaChatModel(
  props: OllamaModelProps,
  { render, logger, memo }: AI.ComponentContext
): AI.RenderableStream {
  yield AI.AppendOnlyStream;

  const messageElements = await renderToConversation(props.children, render, logger, 'prompt');

  if (messageElements.find((e) => e.type == 'functionCall')) {
    throw new AIJSXError(
      'Ollama does not support <FunctionCall>. Please use <SystemMessage> instead.',
      ErrorCode.Llama2DoesNotSupportFunctionCalls,
      'user'
    );
  }
  if (messageElements.find((e) => e.type == 'functionResponse')) {
    throw new AIJSXError(
      'Ollama does not support <FunctionResponse>. Please use <SystemMessage> instead.',
      ErrorCode.Llama2DoesNotSupportFunctionResponse,
      'user'
    );
  }

  const messages = _.compact(await Promise.all(
    messageElements.map(async (message): Promise<OllamaChatMessage | undefined> => {
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
    })
  ));

  if (!messages.length) {
    throw new AIJSXError(
      "ChatCompletion must have at least one child that's a SystemMessage, UserMessage, AssistantMessage but no such children were found.",
      ErrorCode.ChatCompletionMissingChildren,
      'user'
    );
  }

  yield AI.AppendOnlyStream;
  const chatCompletionRequest: OllamaApiChatArgs = {
    ...mapModelPropsToArgs(props),
    messages,
  };

  const chatResponse = await doOllamaRequest(chatCompletionRequest, logger)
  
  const outputMessages = [] as AI.Node[];

  if (chatResponse) {
    const iterator = chatResponse[Symbol.asyncIterator]()
  
    async function advance() {
      // Eat any empty chunks, typically seen at the beginning of the stream.
      let next;
      let nextValue;
      do {
        next = await iterator.next();
        if (next.done) {
          return null;
        }

        nextValue = typeof next.value === 'string' ? next.value : JSON.parse(new TextDecoder().decode(next.value))
      } while (!nextValue.message.content);
    
      logger.trace({ message: next.value }, 'Got message');
    
      return nextValue.message as OllamaChatResponseChunk['message'];
    }

    let token = await advance();
  
    while (token !== null) {
      if (token.content) {
        // Memoize the stream to ensure it renders only once.
        let accumulatedContent = '';
        let complete = false;
        const Stream = async function* (): AI.RenderableStream {
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
        const assistantMessage = memo(
          <AssistantMessage>
            <Stream {...debugRepresentation(() => `${accumulatedContent}${complete ? '' : '▮'}`)} />
          </AssistantMessage>
        );
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
export async function* OllamaCompletionModel(
  props: OllamaModelProps,
  { render, logger, memo }: AI.ComponentContext
): AI.RenderableStream {
  yield AI.AppendOnlyStream;

  async function buildPromptFromNodes (children: AI.Node[]) {
      const { textNodes, imageNodes } = children?.reduce((nodes, child) => {
        // @ts-ignore
        if (child && child.tag && child.tag.name === 'OllamaImage') {
          return {
            textNodes: [...nodes.textNodes, `[img-${nodes.imageNodes.length}]`],
            imageNodes: [...nodes.imageNodes, child]
          }
        }
        return {
          textNodes: [...nodes.textNodes, child],
          imageNodes: nodes.imageNodes
        }
      }, {textNodes: [] as AI.Node[], imageNodes: [] as AI.Node[]})
  
      return {
        prompt: await render(textNodes),
        images: await Promise.all(imageNodes.map((node) => render(node)))
      };
  }
  
  let prompt = {prompt: ''}
  if (_.isArray(props.children)) {
    prompt = await buildPromptFromNodes(props.children as AI.Node[])
  } else {
    prompt = { prompt: await render(props.children) }
  }

  const llama2Args: OllamaApiCompletionArgs = {
    ...mapModelPropsToArgs(props),
    ...prompt,
  };

  logger.debug({ llama2Args }, 'Calling Ollama');

  const response = await doOllamaRequest(
    llama2Args,
    logger
  );

  if (response) {
    const iterator = response[Symbol.asyncIterator]()
  
    async function advance() {
      // Eat any empty chunks, typically seen at the beginning of the stream.
      let next;
      let nextValue;
      do {
        next = await iterator.next();
        if (next.done) {
          return null;
        }
        nextValue = typeof next.value === 'string' ? next.value : JSON.parse(new TextDecoder().decode(next.value))
      } while (!nextValue.response);
    
      logger.trace({ message: next.value }, 'Got message');
    
      return nextValue.response as OllamaCompletionResponseChunk['response'];
    }

    let token = await advance();
  
    while (token !== null) {
      if (token) {
        // Memoize the stream to ensure it renders only once.
        let accumulatedContent = '';
        let complete = false;
        const Stream = async function* (): AI.RenderableStream {
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
        const reponseMessage = memo(
          <Stream {...debugRepresentation(() => `${accumulatedContent}${complete ? '' : '▮'}`)} />
        );
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
export function Ollama({ children, ...defaults }: OllamaModelProps) {
  return (
    <ChatProvider component={OllamaChatModel} {...defaults}>
      <CompletionProvider component={OllamaCompletionModel} {...defaults}>
        {children}
      </CompletionProvider>
    </ChatProvider>
  );
}
