# n8n-nodes-gateway-memory

This is an n8n community node that provides **Memory Gateway** - a powerful middleware for filtering and transforming chat memory content in AI workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Features

- 🔄 **Memory Middleware** - Acts as a gateway between AI Agent and any Memory storage
- 🧹 **Content Filtering** - Filter data before saving and after retrieving from memory
- 💻 **Custom JavaScript Code** - Write custom filter logic with full JavaScript support
- 🎯 **Universal Compatibility** - Works with Postgres, Redis, MongoDB, and any other Memory node
- ⚡ **Performance** - Minimal overhead, processes data on-the-fly
- 🔒 **Data Control** - Remove sensitive information, limit message length, clean technical logs

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Manual Installation (Self-Hosted)

1. Navigate to your n8n installation directory
2. Install the package:
```bash
npm install n8n-nodes-gateway-memory
```
3. Restart n8n

### Local Development

1. Clone this repository
2. Mount to n8n custom nodes directory
3. Restart n8n
```bash
docker-compose down
docker-compose up --build
```

## Operations

### Memory Gateway

The Memory Gateway node provides filtering capabilities for chat memory.

#### Connection Flow
```
AI Agent
    ↓ (Memory slot)
Memory Gateway
    ↓ (Internal Memory slot)
Postgres Chat Memory (or any other Memory node)
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| **Filter Before Save** | Code Editor | JavaScript function to filter data BEFORE saving to memory |
| **Filter After Retrieve** | Code Editor | JavaScript function to filter data AFTER retrieving from memory |

## Usage

### Basic Setup

1. **Add Memory Gateway** to your workflow
2. **Connect a Memory node** (e.g., Postgres Chat Memory) to Memory Gateway's input
3. **Connect Memory Gateway** to AI Agent's Memory slot
4. **Configure filters** in Memory Gateway settings

### Filter Before Save

This filter runs when AI Agent saves a message to memory.

**Available variables:**
- `input` (string) - User's input message
- `output` (string) - AI's response message

**Must return:**
- Object with `{ input: string, output: string }`

**Example - Remove tool execution logs:**
```javascript
function filterBeforeSave(input, output) {
  // Remove [Used tools: ...] from output
  if (output) {
    output = output.replace(/\[Used tools:[\s\S]*?\]\s*/g, '');
  }
  
  // Limit message length
  const MAX_LENGTH = 3000;
  if (output && output.length > MAX_LENGTH) {
    output = output.substring(0, MAX_LENGTH) + '... [truncated]';
  }
  
  return { input, output };
}
```

### Filter After Retrieve

This filter runs when AI Agent loads messages from memory.

**Available variables:**
- `messages` (Array) - Array of message objects from memory

**Must return:**
- Modified messages array

**Example - Limit number of messages:**
```javascript
function filterAfterRetrieve(messages) {
  // Keep only last 10 messages
  if (messages && Array.isArray(messages) && messages.length > 10) {
    messages = messages.slice(-10);
  }
  
  // Filter out system messages
  messages = messages.filter(msg => msg.type !== 'system');
  
  return messages;
}
```

## Examples

### Example 1: Clean AI Tool Logs

Remove technical information from AI responses before storing:
```javascript
function filterBeforeSave(input, output) {
  // Remove [Used tools: ...]
  output = output.replace(/\[Used tools:[\s\S]*?\]\s*/g, '');
  
  // Remove JSON metadata
  output = output.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
  
  return { input, output };
}
```

### Example 2: Privacy Filter

Remove sensitive information:
```javascript
function filterBeforeSave(input, output) {
  // Remove email addresses
  input = input.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  output = output.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  
  // Remove phone numbers
  input = input.replace(/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[PHONE]');
  output = output.replace(/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[PHONE]');
  
  return { input, output };
}
```

### Example 3: Context Window Management

Keep only relevant messages:
```javascript
function filterAfterRetrieve(messages) {
  // Keep only last 5 messages
  if (messages.length > 5) {
    messages = messages.slice(-5);
  }
  
  // Remove messages older than 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  messages = messages.filter(msg => {
    return !msg.timestamp || msg.timestamp > oneDayAgo;
  });
  
  return messages;
}
```

### Example 4: Content Summarization

Summarize long messages:
```javascript
function filterBeforeSave(input, output) {
  const MAX_LENGTH = 500;
  
  if (output.length > MAX_LENGTH) {
    // Keep first and last parts
    const start = output.substring(0, 200);
    const end = output.substring(output.length - 200);
    output = start + '\n\n[... content summarized ...]\n\n' + end;
  }
  
  return { input, output };
}
```

## Compatibility

### Tested with:
- n8n version: 1.0.0+
- Node.js: 18.x, 20.x

### Compatible Memory Nodes:
- ✅ Postgres Chat Memory
- ✅ Redis Chat Memory
- ✅ MongoDB Chat Memory
- ✅ Window Buffer Memory
- ✅ Buffer Memory
- ✅ All LangChain-compatible memory nodes

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [LangChain Memory documentation](https://js.langchain.com/docs/modules/memory/)
* [AI Agent documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

[MIT](LICENSE.md)

## Author

**vyunak**

* GitHub: [@vyunak](https://github.com/vyunak)

## Support

If you find this node helpful, please give it a ⭐️ on GitHub!

---

Made with ❤️ for the n8n community
