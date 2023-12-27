import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "ai-jsx/jsx-runtime";
import * as AI from "ai-jsx";
import { ChatCompletion, Completion, UserMessage } from "ai-jsx/core/completion";
import { Ollama, OllamaImage } from '../ollama.js';
function ImageDescriptor() {
    return (_jsx(Ollama, { model: "llava", children: _jsxs(Completion, { children: ["Look at this image ", _jsx(OllamaImage, { url: './plage.png' }), ". How hot do you think the water is ?"] }) }));
}
function Chat() {
    return (_jsx(Ollama, { children: _jsx(ChatCompletion, { children: _jsx(UserMessage, { children: "Write a little haiku about life" }) }) }));
}
function App() {
    return (_jsxs(_Fragment, { children: [_jsx(ImageDescriptor, {}), "\n\n", _jsx(Chat, {})] }));
}
const renderContext = AI.createRenderContext();
const response = await renderContext.render(_jsx(App, {}));
console.log(response);
