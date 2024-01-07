# ai-jsx-ollama

[AI-JSX](https://docs.ai-jsx.com/) component to work with [Ollama.ai](https://ollama.ai/)


### Foreword

I'm not working for or am affiliated with [Fixie.ai](https://www.fixie.ai/). This is to be considered as a third party project.

That being said, I find using declarative syntax (JSX) to build AI apps (and web apps in general) a great idea (from them) ! And I'm thankful to them for bringing it to reality

This little library is my contribution to that great idea : i wanted to use it with open source model/platform, and especially with [Ollama](https://ollama.ai). So here it is !

### Usage

Prerequisites : You need to have a Ollama server ready to use (with at least one model already pulled) and running (see https://github.com/jmorganca/ollama/blob/main/docs/README.md)

to customize the endpoint of your ollama server set the `AI_JSX_OLLAMA_API_BASE` environment variable to something like `http://your-server-domain:11434/api` (no tailling slash). If the variable doesn't exists the default value will be `http://127.0.0.1:11434/api`

#### Hello world

As you would have done for other model provider already existing in AI-JSX library (see https://docs.ai-jsx.com/guides/models), just wrap your conponent into the `<Ollama>` component

```tsx
function App () {
  return (
    <Ollama>
      <ChatCompletion>
        <UserMessage>
          Write a haiku about winter 
        </UserMessage>
      </ChatCompletion>
    </Ollama>
  )
}

console.log( await AI.createRenderContext().render(<App />) );
```

#### Image to Text

With Ollama you can run the Llava model wich achieve a near "GPT-4 vision" capability in term of "image to text". To leverage this capability in you app you need to have pulled the Llava model for Ollama (see https://ollama.ai/library/llava). Then you just need to tell the `<Ollama>` component which model to use :


```tsx
function ImageToText () {
  return (
    <Ollama model="llava">
      {/* The llava model does not support "chat completion" */}
      <Completion>
        Look at this image <OllamaImage url={'./plage.png'}/>.
        How hot do you think the water is ?
      </Completion>
    </Ollama>
  )
}

console.log( await AI.createRenderContext().render(<ImageToText />) );
```

By using the OllamaImage component, the image will be automatically encoded to a base64 string (as required by the Llava model). Note that in this example the image is a local file but you can also use remote images with an absolute url : http://domain/path/file.jpg.

Note : the `<OllamaImage />` component will only work with the llava model (if used with another model the base64 encoded image will be added as is to the prompt, which will probably make the LLM ouput weird things)
