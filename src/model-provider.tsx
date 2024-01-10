import { ChatProvider, CompletionProvider, ModelComponent, ModelPropsWithChildren } from 'ai-jsx/core/completion';
import { AssistantMessage, renderToConversation } from 'ai-jsx/core/conversation';
import { AIJSXError, ErrorCode } from 'ai-jsx/core/errors';
import * as AI from 'ai-jsx';
import { debugRepresentation } from 'ai-jsx/core/debug';
import _ from 'lodash';
import { streamToAsyncIterator } from './utils/srteamToAsyncIterator.js';

/**
 * Base 64 encoded image
 */
type LlavaImageArg = string 

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
  tfs_z?: number
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
  model: string
  options?: ModelProviderOptions;
  stream?: boolean
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
  messages: ModelProviderChatMessage[]
}

export type ModelProviderApiArgs = ModelProviderApiChatArgs | ModelProviderApiCompletionArgs

export const isModelProviderApiChatArgs = (args: ModelProviderApiArgs): args is ModelProviderApiChatArgs => Object.prototype.hasOwnProperty.call(args, 'messages')
export const isModelProviderApiCompletionArgs = (args: ModelProviderApiArgs): args is ModelProviderApiCompletionArgs => Object.prototype.hasOwnProperty.call(args, 'prompt')

export type ModalProviderPropsBase = ModelPropsWithChildren 
                        & Omit<ModelProviderOptions, 
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
                        & {
                          model: string
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

export const LLM_QUERY_TYPE = {
  CHAT: 'chat',
  COMPLETION: 'completion'
} as const

export type LlmQueryType = typeof LLM_QUERY_TYPE[keyof typeof LLM_QUERY_TYPE]

const mapModelPropsToArgs = (props: ModalProviderPropsBase): Omit<ModelProviderApiArgs, 'prompt' | 'messages'> => {
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
  }
}

type QureryLlmFunction = (
  queryType: LlmQueryType,
  input: ModelProviderApiArgs,
  logger: AI.ComponentContext['logger']
) => Promise<ReturnType<typeof streamToAsyncIterator> | undefined>

export type StreamedChunk = ArrayBuffer | string
export type ChunkDecoder = (chunk: StreamedChunk, responseType: LlmQueryType) => string

const QueryLlmContext = AI.createContext<{
  queryLlm: QureryLlmFunction,
  chunkDecoder: ChunkDecoder,
}>({queryLlm: () => { throw 'function queryLlm is not defined' }, chunkDecoder: () => { throw 'function chunkDecoder is not defined' } })

const getResponseStreamConsumer = (
  queryType: LlmQueryType,
  iterator: ReturnType<typeof streamToAsyncIterator>, 
  chunkDecoder: ChunkDecoder, 
  logger:AI.ComponentContext['logger']
) => async () => {
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
}

export async function* ModelProviderChatModel(
  props: ModalProviderPropsBase,
  { render, logger, memo, getContext }: AI.ComponentContext
): AI.RenderableStream {
  yield AI.AppendOnlyStream;

  const messageElements = await renderToConversation(props.children, render, logger, 'prompt');

  if (messageElements.find((e) => e.type == 'functionCall')) {
    throw new AIJSXError(
      'ModelProvider does not support <FunctionCall>. Please use <SystemMessage> instead.',
      ErrorCode.Llama2DoesNotSupportFunctionCalls,
      'user'
    );
  }
  if (messageElements.find((e) => e.type == 'functionResponse')) {
    throw new AIJSXError(
      'ModelProvider does not support <FunctionResponse>. Please use <SystemMessage> instead.',
      ErrorCode.Llama2DoesNotSupportFunctionResponse,
      'user'
    );
  }

  const messages = _.compact(await Promise.all(
    messageElements.map(async (message): Promise<ModelProviderChatMessage | undefined> => {
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
  const chatCompletionRequest: ModelProviderApiChatArgs = {
    ...mapModelPropsToArgs(props),
    messages,
  };

  const {queryLlm, chunkDecoder} = getContext(QueryLlmContext)

  const chatResponse = await queryLlm(LLM_QUERY_TYPE.CHAT, chatCompletionRequest, logger)
  
  const outputMessages = [] as AI.Node[];

  if (chatResponse) {
    const iterator = chatResponse[Symbol.asyncIterator]()
  
    const advance = getResponseStreamConsumer(
      LLM_QUERY_TYPE.CHAT,
      iterator, 
      chunkDecoder,
      logger
    )

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
export async function* ModelProviderCompletionModel(
  props: ModalProviderPropsBase,
  { render, logger, memo, getContext }: AI.ComponentContext
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

  const llama2Args: ModelProviderApiCompletionArgs = {
    ...mapModelPropsToArgs(props),
    ...prompt,
  };

  logger.debug({ llama2Args }, 'Calling Ollama');

  const {queryLlm, chunkDecoder} = getContext(QueryLlmContext)

  const response = await queryLlm(
  LLM_QUERY_TYPE.COMPLETION,
    llama2Args,
    logger
  );

  if (response) {
    const iterator = response[Symbol.asyncIterator]()
  
    const advance = getResponseStreamConsumer(
      LLM_QUERY_TYPE.COMPLETION,
      iterator,
      chunkDecoder,
      // (chunk) => typeof chunk.value === 'string' ? chunk.value : JSON.parse(new TextDecoder().decode(chunk.value)).response,
      logger
    )

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

interface ModelProviderProps extends ModalProviderPropsBase {
  queryLlm: QureryLlmFunction,
  chunkDecoder: ChunkDecoder,
  chatModel?: ModelComponent<ModalProviderPropsBase>, 
  completionModel?: ModelComponent<ModalProviderPropsBase>
}

/**
 * This component causes all children `ChatCompletion` and `Completion` components to use Ollama.
 *
 * You must set env var OLLAMA_API_BASE.
 *
 * Drawbacks to Llama2:
 *  * No support for functions
 */
export function ModelProvider(
  { 
    children, 
    queryLlm, 
    chunkDecoder,
    chatModel = ModelProviderChatModel, 
    completionModel = ModelProviderCompletionModel, 
    ...defaults 
  }: ModelProviderProps, 
  {
    getContext
  }: AI.RenderContext
) {
  return (
    <QueryLlmContext.Provider value={{queryLlm, chunkDecoder}}>
      <ChatProvider component={chatModel} {...defaults}>
        <CompletionProvider component={completionModel} {...defaults}>
          {children}
        </CompletionProvider>
      </ChatProvider>
    </QueryLlmContext.Provider>
  );
}
