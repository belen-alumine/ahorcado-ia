const path = require('path');

const tools = [
  require('./read-file'),
  require('./write-file'),
  require('./edit-file'),
  require('./search-code'),
  require('./run-command'),
  require('./run-tests'),
  require('./read-url')
];

const registry = {};
for (const tool of tools) {
  if (registry[tool.name]) {
    throw new Error(`Tool duplicada: ${tool.name}`);
  }
  registry[tool.name] = tool;
}

function getToolDescriptions() {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters
  }));
}

function getTool(name) {
  return registry[name] || null;
}

module.exports = { getToolDescriptions, getTool, tools };
