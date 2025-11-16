let logWrapper;
try {
    logWrapper = require('/usr/local/lib/node_modules/n8n/dist/utils/logWrapper').logWrapper;
} catch (e) {
    logWrapper = null;
}

const NodeConnectionTypes = { AiMemory: 'ai_memory' };

class MemoryGateway {
    constructor() {
        this.description = {
            displayName: 'Memory Gateway',
            name: 'memoryGateway',
            icon: 'fa:filter',
            group: ['transform'],
            version: 1,
            description: 'Filter and transform memory content before storage',
            defaults: {
                name: 'Memory Gateway',
            },
            credentials: [],
            codex: {
                categories: ['AI'],
                subcategories: {
                    AI: ['Memory'],
                    Memory: ['Other memories'],
                },
                resources: {
                    primaryDocumentation: [
                        {
                            url: 'https://github.com/vyunak/n8n-nodes-gateway-memory',
                        },
                    ],
                },
            },
            inputs: [
                {
                    displayName: 'Internal Memory',
                    type: 'ai_memory',
                    required: true,
                    maxConnections: 1,
                }
            ],
            outputs: [
                {
                    displayName: 'Memory',
                    type: 'ai_memory',
                    required: true,
                    maxConnections: 1,
                }
            ],
            outputNames: ['Memory'],
            properties: [
                {
                    displayName: 'Internal Memory Connected',
                    name: 'internalMemoryNotice',
                    type: 'notice',
                    default: 'Connect ONE Memory node (Postgres, Redis, etc.) to the input above ↑',
                },
                {
                    displayName: 'Filter Before Save',
                    name: 'filterBeforeSave',
                    type: 'string',
                    typeOptions: {
                        editor: 'codeNodeEditor',
                        editorLanguage: 'javaScript',
                        rows: 15,
                    },
                    default: `/**
 * Filter data BEFORE saving to internal memory
 * @param {string} input - User input message
 * @param {string} output - AI response message
 * @returns {object} - { input: string, output: string }
 */
function filterBeforeSave(input, output) {
  if (output) {
    // Remove [Used tools: ...] format
    output = output.replace(/\\[Used tools:[\\s\\S]*?\\]\\s*/g, '');
    
    // Remove "; Tool: ..., Input: ..., Result: ..." format
    output = output.replace(/;\\s*Tool:[\\s\\S]*?Result:\\s*\\[[\\s\\S]*?\\]\\]/g, '');
    
    // Remove orphaned semicolons and brackets at the start
    output = output.replace(/^[;\\]\\s]+/g, '');
    
    // Remove JSON metadata
    output = output.replace(/\\{[\\s\\S]*?"action"[\\s\\S]*?\\}/g, '');
    
    // Clean up multiple spaces/newlines
    output = output.replace(/\\s+/g, ' ');
    
    // Trim whitespace
    output = output.trim();
  }
  
  // Limit message length
  const MAX_LENGTH = 1000;
  if (output && output.length > MAX_LENGTH) {
    output = output.substring(0, MAX_LENGTH) + '... [truncated]';
  }
  
  return { input, output };
}`,
                    description: 'JavaScript function to filter data BEFORE saving to internal memory',
                    noDataExpression: true,
                },
                {
                    displayName: 'Filter After Retrieve',
                    name: 'filterAfterRetrieve',
                    type: 'string',
                    typeOptions: {
                        editor: 'codeNodeEditor',
                        editorLanguage: 'javaScript',
                        rows: 12,
                    },
                    default: `/**
 * Filter data AFTER retrieving from internal memory
 * @param {Array<string>} messages - Array of message objects from memory
 * @returns {Array<string>} - Modified messages array
 */
function filterAfterRetrieve(messages) {
  return messages;
}`,
                    description: 'JavaScript function to filter data AFTER retrieving from internal memory',
                    noDataExpression: true,
                },
            ],
        };
    }

    async supplyData(context, itemIndex) {
        const filterBeforeSave = this.getNodeParameter('filterBeforeSave', itemIndex, '');
        const filterAfterRetrieve = this.getNodeParameter('filterAfterRetrieve', itemIndex, '');

        const connectedMemory = await this.getInputConnectionData('ai_memory', 0);

        if (!connectedMemory) {
            throw new Error('No internal memory connected!');
        }

        const { BufferMemory } = require('langchain/memory');

        class MemoryGatewayWrapper extends BufferMemory {
            constructor(internalMemory, beforeSaveCode, afterRetrieveCode, executeFunctions) {
                super({
                    returnMessages: true,
                    inputKey: 'input',
                    outputKey: 'output',
                });

                this.internalMemory = internalMemory;
                this.beforeSaveCode = beforeSaveCode;
                this.afterRetrieveCode = afterRetrieveCode;
                this.executeFunctions = executeFunctions;
                this.chatHistory = internalMemory.chatHistory;
            }

            get memoryKeys() {
                return this.internalMemory.memoryKeys || ['chat_history'];
            }

            async loadMemoryVariables(values) {
                const connectionType = NodeConnectionTypes.AiMemory;
                const { index } = this.executeFunctions.addInputData(connectionType, [
                    [{ json: { action: 'loadMemoryVariables', values } }],
                ]);

                let memoryData = await this.internalMemory.loadMemoryVariables(values);

                if (this.afterRetrieveCode && this.afterRetrieveCode.trim()) {
                    try {
                        let messages = memoryData.chat_history || memoryData.history || [];

                        let codeToExecute = this.afterRetrieveCode.trim();

                        if (codeToExecute.includes('function filterAfterRetrieve')) {
                            codeToExecute += '\nreturn filterAfterRetrieve(messages);';
                        } else {
                            codeToExecute = 'return (function(messages) { ' + codeToExecute + ' })(messages);';
                        }

                        const filterFunc = new Function('messages', codeToExecute);
                        const filtered = filterFunc(messages);

                        if (memoryData.chat_history !== undefined) {
                            memoryData.chat_history = filtered;
                        } else if (memoryData.history !== undefined) {
                            memoryData.history = filtered;
                        }
                    } catch (error) {
                        console.error('[Memory Gateway] Error in Filter After Retrieve:', error.message);
                    }
                }

                const chatHistory = memoryData.chat_history || memoryData.history || [];
                this.executeFunctions.addOutputData(connectionType, index, [
                    [{ json: { action: 'loadMemoryVariables', chatHistory } }],
                ]);

                return memoryData;
            }

            async saveContext(inputValues, outputValues) {
                const connectionType = NodeConnectionTypes.AiMemory;
                let input = inputValues.input || inputValues.question || '';
                let output = outputValues.output || outputValues.response || '';

                const { index } = this.executeFunctions.addInputData(connectionType, [
                    [{ json: { action: 'saveContext', input, output } }],
                ]);

                if (this.beforeSaveCode && this.beforeSaveCode.trim()) {
                    try {
                        let codeToExecute = this.beforeSaveCode.trim();

                        if (codeToExecute.includes('function filterBeforeSave')) {
                            codeToExecute += '\nreturn filterBeforeSave(input, output);';
                        } else {
                            codeToExecute = 'return (function(input, output) { ' + codeToExecute + ' })(input, output);';
                        }

                        const filterFunc = new Function('input', 'output', codeToExecute);
                        const filtered = filterFunc(input, output);

                        if (filtered && typeof filtered === 'object') {
                            input = filtered.input !== undefined ? filtered.input : input;
                            output = filtered.output !== undefined ? filtered.output : output;
                        }
                    } catch (error) {
                        console.error('[Memory Gateway] Error in Filter Before Save:', error.message);
                    }
                }

                const result = await this.internalMemory.saveContext({ input }, { output });

                const chatHistory = await this.chatHistory.getMessages();
                this.executeFunctions.addOutputData(connectionType, index, [
                    [{ json: { action: 'saveContext', chatHistory } }],
                ]);

                return result;
            }

            async clear() {
                if (this.internalMemory.clear) {
                    return this.internalMemory.clear();
                }
            }
        }

        const memory = new MemoryGatewayWrapper(
            connectedMemory,
            filterBeforeSave,
            filterAfterRetrieve,
            this
        );

        return {
            response: memory,
        };
    }
}

module.exports = { MemoryGateway };
