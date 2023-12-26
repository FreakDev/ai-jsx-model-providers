import * as AI from "ai-jsx";
import { ChatCompletion, UserMessage } from "ai-jsx/core/completion";

import { Ollama } from './ollama.tsx'

function App() {
  return (
    <Ollama stream={false}>
      <ChatCompletion>
        <UserMessage>
          Generate a Shakespearean sonnet about large language models.
        </UserMessage>
      </ChatCompletion>
    </Ollama>
  );
}
const renderContext = AI.createRenderContext();
const response = await renderContext.render(<App />);
console.log(response);
