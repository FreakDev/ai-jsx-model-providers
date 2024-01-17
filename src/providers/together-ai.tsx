import { LLM_QUERY_TYPE, LlmQueryType, ModelProviderProps, ModelProvider, ModelProviderApiArgs, StreamedChunk, ModelProviderPropsBase, doQueryLlm, MapPropsToArgs, LlmQueryReturnFormat, GenerateEmbedding, LLM_QUERY_RETURN_FORMAT } from "../lib/model-provider.js";
import * as AI from 'ai-jsx';
import _ from "lodash";

const AI_JSX_TOGETHERAI_API_BASE = 'https://api.together.xyz'

export async function queryTogetherAi(
  queryType: LlmQueryType,
  input: any,
  logger: AI.ComponentContext['logger'], 
  returnFormat?: LlmQueryReturnFormat
) {
  const url = `${AI_JSX_TOGETHERAI_API_BASE}${{
    [LLM_QUERY_TYPE.CHAT]: '/v1/chat/completions',
    [LLM_QUERY_TYPE.COMPLETION]: '/api/inference',
    [LLM_QUERY_TYPE.EMBEDDING]: '/v1/embeddings'
  }[queryType]}`

  return doQueryLlm(url, input, logger, {
    'Authorization': `Bearer ${process.env.AI_JSX_TOGETHERAI_API_KEY}`
  }, returnFormat)
}

export const togetherAiChunkDecoder = (streamedChunk: StreamedChunk, queryType: LlmQueryType) => { 
  if (typeof streamedChunk === 'string') {
    return streamedChunk;
  } else {
    let streamedChunkAsString = (new TextDecoder().decode(streamedChunk)).trim();

    const chunks = streamedChunkAsString.split("\n")
    return _.compact(chunks.map(c => c.trim())).reduce<string>((result: string, chunk: string) => {
      let chunkString = chunk

      if (!chunk.startsWith('{')) {
        if (chunkString.includes('[DONE]'))
          return null;

        chunkString = chunkString.substring(chunkString.indexOf('{'))
      }
      const chunkData = JSON.parse(chunkString)

      if (chunkData) {
        if (queryType === LLM_QUERY_TYPE.CHAT) {
          return chunkData.choices[0].message?.content ?? 
            _.entries(chunkData.choices[0].delta).map(([k, v]) => k === 'content' ? v : '').join('')
        } else {

          if (chunkData.output) {
            return `${chunkData.output.choices[0].text}`
          }

          return `${result}${chunkData.choices[0].text}`
        }
      }
      throw 'Invalid JSON'
    }, '')
  }
}

const togetherAiMapPropsToArgs: MapPropsToArgs = (props: TogetherAiProps, queryType: LlmQueryType) => {
  if (queryType === LLM_QUERY_TYPE.EMBEDDING) {
    return {
      model: props.model,
      input: props.children
    }
  } else {
    return {
      ...props,
      "stream_tokens": props.stream ?? false,
    }
  }
}

const getEmbeddingGenerator = (model: string, logger: AI.ComponentContext['logger']): GenerateEmbedding => async (input) => {
  const embeddingQueryResponse = await queryTogetherAi(LLM_QUERY_TYPE.EMBEDDING, {
      model,
      input
    }, logger, LLM_QUERY_RETURN_FORMAT.JSON) as any
  
    return embeddingQueryResponse.data[0].embedding
  }

interface TogetherAiProps extends ModelProviderPropsBase {
  queryLlm?: ModelProviderProps['queryLlm'],
  chunkDecoder?: ModelProviderProps['chunkDecoder'],
  generateEmbedding?: GenerateEmbedding;
  promptFormatString?: string,
}

export const TogetherAi = (
  { 
    children, 
    model,
    queryLlm,
    chunkDecoder,
    generateEmbedding,
    ...defaults 
  }: TogetherAiProps,
  { logger }: AI.ComponentContext
) => {
  return (
  <ModelProvider 
    queryLlm={queryLlm ?? queryTogetherAi} 
    chunkDecoder={chunkDecoder ?? togetherAiChunkDecoder} 
    mapPropsToArgs={togetherAiMapPropsToArgs}
    generateEmbedding={generateEmbedding ?? getEmbeddingGenerator(model, logger)}
    model={model}
    {...defaults}
  >
    {children}
  </ModelProvider>
  );
}