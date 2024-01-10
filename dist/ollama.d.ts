import { ModalProviderPropsBase } from "./model-provider.js";
type OllamaProps = Omit<ModalProviderPropsBase, 'model'> & {
    model?: string;
};
export declare const Ollama: ({ children, model, ...defaults }: OllamaProps) => import("ai-jsx/jsx-runtime").JSX.Element;
export {};
