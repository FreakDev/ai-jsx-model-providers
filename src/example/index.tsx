import * as AI from "ai-jsx";
import { ChatCompletion, Completion, UserMessage} from "ai-jsx/core/completion";

import { Ollama, LlavaImage, Llamafile, ReplicateModel, QueryLlmContext } from '../index.js'
import { TogetherAi } from "../providers/together-ai.js";

function Multimodal () {
  return (
    <Ollama model="llava">
      {/* The llava model deosn't support "ChatCompletion" */}
      <Completion>
        Look at this image <LlavaImage url={'./plage.png'}/>.
        How hot do you think the water is ?
      </Completion>
    </Ollama>
  )
}

function Chat () {
  return (
    <Llamafile>
      <ChatCompletion>
        <UserMessage>
          Write a little haiku about life 
        </UserMessage>
      </ChatCompletion>
    </Llamafile>
  )
}

function Together () {
  return (
    <TogetherAi model="mistralai/Mistral-7B-Instruct-v0.2">
      <Completion>
        Write a little haiku about life 
      </Completion>
    </TogetherAi>
  )
}

function Replicate () {
  return (
    <ReplicateModel 
      model="mistralai/mistral-7b-instruct-v0.1:5fe0a3d7ac2852264a25279d1dfb798acbc4d49711d126646594e212cb821749" 
    >
      Write a little haiku about life 
    </ReplicateModel>
  )
}

function EmbeddingDemo () { 
  // embedding is implemented for Ollama, Llamafile, and TogetherAi

  const Embedding = async (_props: any, {getContext}: AI.ComponentContext) => {
    const { generateEmbedding } = getContext(QueryLlmContext);

    return JSON.stringify(await generateEmbedding('Hello World'))
  }

  return <Ollama model="llava">
    <Embedding />
  </Ollama>
}

function App() {
  return (
    <>
      <Multimodal />
      <Chat />
      <Together />
      <Replicate />
      <EmbeddingDemo />
    </>
  )
}
const renderContext = AI.createRenderContext();
const response = await renderContext.render(<App />);
console.log(response);
