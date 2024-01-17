import { LLM_QUERY_TYPE, LlmQueryType, ModelProviderPropsBase, ModelProvider, ModelProviderApiArgs, ModelProviderProps, StreamedChunk, doQueryLlm, mapModelPropsToArgs, LlmQueryReturnFormat, GenerateEmbedding, LLM_QUERY_RETURN_FORMAT } from "../lib/model-provider.js";
import * as AI from 'ai-jsx';

const AI_JSX_OLLAMA_API_BASE = process.env.AI_JSX_OLLAMA_API_BASE ?? 'http://127.0.0.1:11434/api'

/**
 * Run a model model on Ollama.
 */
export async function queryOllama(
  queryType: LlmQueryType,
  input: any,
  logger: AI.ComponentContext['logger'],
  returnFormat?: LlmQueryReturnFormat,
) {
  const url = `${AI_JSX_OLLAMA_API_BASE}${{
    [LLM_QUERY_TYPE.CHAT]: '/chat',
    [LLM_QUERY_TYPE.COMPLETION]: '/generate',
    [LLM_QUERY_TYPE.EMBEDDING]: '/embeddings'
  }[queryType]}`

  return doQueryLlm(url, input, logger, {}, returnFormat)
}

export const ollamaChunkDecoder = (chunk: StreamedChunk, queryType: LlmQueryType) => { 
  if (typeof chunk === 'string') {
    return chunk;
  } else {
    if (queryType === LLM_QUERY_TYPE.CHAT) {
      return JSON.parse(new TextDecoder().decode(chunk)).message.content
    } else {
      return JSON.parse(new TextDecoder().decode(chunk)).response
    }
  }
}

export const mapPropsToArgs = (input: any, queryType: LlmQueryType) => {
  if (queryType === LLM_QUERY_TYPE.EMBEDDING) {
    return {
      model: input.model ? input.model : 'llama2',
      prompt: input.children
    }
  } else {
    return mapModelPropsToArgs(input, queryType)
  }
}

const getEmbeddingGenerator = (model: string, logger: AI.ComponentContext['logger']): GenerateEmbedding => async (input) => {
  const embeddingQueryResponse = await queryOllama(LLM_QUERY_TYPE.EMBEDDING, {
      model,
      prompt: input
    }, logger, LLM_QUERY_RETURN_FORMAT.JSON) as any
  
    return embeddingQueryResponse.embedding
  }

type OllamaProps = Omit<ModelProviderPropsBase, 'model'> & { 
  model?: string;
  queryLlm?: ModelProviderProps['queryLlm'];
  chunkDecoder?: ModelProviderProps['chunkDecoder'];
  generateEmbedding?: GenerateEmbedding;
}

export const Ollama = (
  { 
    children, 
    model,
    queryLlm,
    chunkDecoder,
    generateEmbedding,
    ...defaults 
  }: OllamaProps,
  { logger }: AI.ComponentContext
) => {
  const defaultModel = model ?? "llama2"

  return (
  <ModelProvider 
    queryLlm={queryLlm ?? queryOllama} 
    mapPropsToArgs={mapPropsToArgs}
    chunkDecoder={chunkDecoder ?? ollamaChunkDecoder} 
    generateEmbedding={generateEmbedding ?? getEmbeddingGenerator(defaultModel, logger)}
    model={defaultModel} 
    {...defaults
  }>
    {children}
  </ModelProvider>
  );
}