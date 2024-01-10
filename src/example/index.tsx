import * as AI from "ai-jsx";
import { ChatCompletion, Completion, UserMessage} from "ai-jsx/core/completion";

import { Ollama, LlavaImage, Llamafile } from '../index.js'

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

function App() {
  return (
    <>
      <Multimodal />
      {"\n\n"}
      <Chat />
    </>
  )
}
const renderContext = AI.createRenderContext();
const response = await renderContext.render(<App />);
console.log(response);
