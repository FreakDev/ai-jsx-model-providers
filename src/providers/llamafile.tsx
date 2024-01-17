import { LLM_QUERY_TYPE, LlmQueryType, ModelProviderProps, ModelProvider, ModelProviderApiArgs, StreamedChunk, ModelProviderPropsBase, doQueryLlm, LlmQueryReturnFormat, GenerateEmbedding, LLM_QUERY_RETURN_FORMAT } from "../lib/model-provider.js";
import * as AI from 'ai-jsx';
import _ from "lodash";

const AI_JSX_LLAMAFILE_API_BASE = process.env.AI_JSX_LLAMAFILE_API_BASE ?? 'http://127.0.0.1:8080'

export async function queryLlamafile(
  queryType: LlmQueryType,
  input: any,
  logger: AI.ComponentContext['logger'],
  returnFormat?: LlmQueryReturnFormat
) {
  const url = `${AI_JSX_LLAMAFILE_API_BASE}${{
    [LLM_QUERY_TYPE.CHAT]: '/v1/chat/completions',
    [LLM_QUERY_TYPE.COMPLETION]: '/completion',
    [LLM_QUERY_TYPE.EMBEDDING]: '/embedding'
  }[queryType]}`

  return doQueryLlm(url, input, logger, {}, returnFormat)
}

export const llamafileChunkDecoder = (streamedChunk: StreamedChunk, queryType: LlmQueryType) => { 
  if (typeof streamedChunk === 'string') {
    return streamedChunk;
  } else {
    let streamedChunkAsString = (new TextDecoder().decode(streamedChunk)).trim();

    const chunks = streamedChunkAsString.split("\n")
    return _.compact(chunks.map(c => c.trim())).reduce<string>((result: string, chunk: string) => {
      let chunkString = chunk
      if (!chunk.startsWith('{')) {
        chunkString = chunkString.substring(chunkString.indexOf('{'))
      }
      const chunkData = JSON.parse(chunkString)
      if (chunkData) {
        if (queryType === LLM_QUERY_TYPE.CHAT) {
          return chunkData.choices[0].message?.content ?? 
            _.entries(chunkData.choices[0].delta).map(([k, v]) => k === 'content' ? v : '').join('')
        } else {
          return `${result}${chunkData.content}`
        }
      }
      throw 'Invalid JSON'
    }, '')
  }
}

const mapPropsToArgs = (props: any, queryType: LlmQueryType) => {
  if (queryType === LLM_QUERY_TYPE.EMBEDDING) {
    return {
      content: props.children
    }
  } else {
    return {
      ...props
    }
  }
}

const getEmbeddingGenerator = (logger: AI.ComponentContext['logger']): GenerateEmbedding => async (input) => {
  const embeddingQueryResponse = await queryLlamafile(LLM_QUERY_TYPE.EMBEDDING, {
      content: input
    }, logger, LLM_QUERY_RETURN_FORMAT.JSON) as any
  
    return embeddingQueryResponse.embedding
  }

type LlamafileProps = Omit<ModelProviderPropsBase, 'model'> & {
  queryLlm?: ModelProviderProps['queryLlm'],
  chunkDecoder?: ModelProviderProps['chunkDecoder']
  generateEmbedding?: GenerateEmbedding;
}

export const Llamafile = (
  { 
    children, 
    queryLlm,
    chunkDecoder,
    generateEmbedding,
    ...defaults 
  }: LlamafileProps,
  { logger }: AI.ComponentContext
) => {
  return (
  <ModelProvider 
    mapPropsToArgs={mapPropsToArgs}
    queryLlm={queryLlm ?? queryLlamafile} 
    chunkDecoder={chunkDecoder ?? llamafileChunkDecoder} 
    generateEmbedding={generateEmbedding ?? getEmbeddingGenerator(logger)}
    model="" 
    {...defaults}
  >
    {children}
  </ModelProvider>
  );
}