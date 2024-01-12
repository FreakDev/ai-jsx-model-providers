import * as AI from "ai-jsx";
import { ChatCompletion, Completion, UserMessage} from "ai-jsx/core/completion";

import { Ollama, LlavaImage, Llamafile } from '../index.js'
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


function App() {
  return (
    <>
      <Multimodal />
      <Chat />
      <Together />
    </>
  )
}
const renderContext = AI.createRenderContext();
const response = await renderContext.render(<App />);
console.log(response);
