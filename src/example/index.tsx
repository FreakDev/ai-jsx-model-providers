import * as AI from "ai-jsx";
import { ChatCompletion, Completion, UserMessage} from "ai-jsx/core/completion";

import { Ollama, OllamaImage } from '../ollama.js'

function ImageDescriptor () {
  return (
    <Ollama model="llava">
      {/* The llava model deosn't support "ChatCompletion" */}
      <Completion>
        Look at this image <OllamaImage url={'./plage.png'}/>.
        How hot do you think the water is ?
      </Completion>
    </Ollama>
  )
}

function Chat () {
  return (
    <Ollama>
      {/* default model is llama2 */}
      <ChatCompletion>
        <UserMessage>
          Write a little haiku about life 
        </UserMessage>
      </ChatCompletion>
    </Ollama>
  )
}

function App() {
  return (
    <>
      <ImageDescriptor />
      {"\n\n"}
      <Chat />
    </>
  )
}
const renderContext = AI.createRenderContext();
const response = await renderContext.render(<App />);
console.log(response);
