import { LLM_QUERY_TYPE, LlmQueryType, ModelProviderProps, ModelProvider, ModelProviderApiArgs, StreamedChunk, ModelProviderPropsBase, doQueryLlm } from "../model-provider.js";
import * as AI from 'ai-jsx';
import _ from "lodash";

const AI_JSX_LLAMAFILE_API_BASE = process.env.AI_JSX_LLAMAFILE_API_BASE ?? 'http://127.0.0.1:8080'

export async function queryLlamafile(
  queryType: LlmQueryType,
  input: any,
  logger: AI.ComponentContext['logger']
) {
  return doQueryLlm(`${AI_JSX_LLAMAFILE_API_BASE}${queryType === LLM_QUERY_TYPE.CHAT ? '/v1/chat/completions' : '/completion'}`, input, logger)
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

type LlamafileProps = Omit<ModelProviderPropsBase, 'model'> & {
  queryLlm?: ModelProviderProps['queryLlm'],
  chunkDecoder?: ModelProviderProps['chunkDecoder']
}

export const Llamafile = (
  { 
    children, 
    queryLlm,
    chunkDecoder,
    ...defaults 
  }: LlamafileProps
) => {
  return (
  <ModelProvider 
    queryLlm={queryLlm ?? queryLlamafile} 
    chunkDecoder={chunkDecoder ?? llamafileChunkDecoder} 
    model="" 
    {...defaults}
  >
    {children}
  </ModelProvider>
  );
}